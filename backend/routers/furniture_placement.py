from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from utils.base64_helpers import array_buffer_to_base64
from utils.db_client import supabase
from dotenv import load_dotenv
import os
from google import genai
from google.genai import types
import traceback
import base64

load_dotenv()

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in .env")

client = genai.Client(api_key=GEMINI_API_KEY)

@router.get("/designs/{session_id}")
async def get_designs_by_session(session_id: str):
    try:
        result = supabase.table("room_designs").select("id, created_at, design_metadata, description").eq("session_id", session_id).order("created_at", desc=True).execute()

        designs = []
        if result.data:
            for design in result.data:
                designs.append({
                    "id": design.get("id"),
                    "created_at": design.get("created_at"),
                    "metadata": design.get("design_metadata"),
                    "description": design.get("description")
                })

        return JSONResponse(content={"designs": designs})
    except Exception as e:
        print(f"Error fetching designs: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch designs")

@router.get("/designs/{session_id}/{design_id}/image")
async def get_design_image(session_id: str, design_id: str):
    try:
        result = supabase.table("room_designs").select("generated_image_data").eq("id", design_id).eq("session_id", session_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Design not found")

        image_base64 = result.data.get("generated_image_data")
        if not image_base64:
            raise HTTPException(status_code=404, detail="Image data not found")

        image_url = f"data:image/png;base64,{image_base64}"

        return JSONResponse(content={"image": image_url})
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching design image: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch design image")

@router.post("/place-furniture")
async def place_furniture(
    design_id: str = Form(...),
    session_id: str = Form(...),
    furniture_image: UploadFile = File(...),
    furniture_description: str = Form("")
):
    try:
        MAX_IMAGE_SIZE_MB = 10
        ALLOWED_MIME_TYPES = {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
        }

        if furniture_image.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400, detail=f"Unsupported file type: {furniture_image.content_type}"
            )

        furniture_bytes = await furniture_image.read()
        size_in_mb = len(furniture_bytes) / (1024 * 1024)
        if size_in_mb > MAX_IMAGE_SIZE_MB:
            raise HTTPException(status_code=400, detail="Image exceeds 10MB size limit")

        result = supabase.table("room_designs").select("generated_image_data, design_metadata").eq("id", design_id).eq("session_id", session_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Room design not found")

        room_image_base64 = result.data.get("generated_image_data")
        room_metadata = result.data.get("design_metadata", {})

        if not room_image_base64:
            raise HTTPException(status_code=404, detail="Room image data not found")

        room_image_bytes = base64.b64decode(room_image_base64)
        furniture_b64 = array_buffer_to_base64(furniture_bytes)

        prompt = f"""
        You are a professional AI interior designer specializing in furniture placement and room visualization.

        You are given:
        1. A room design image (the base room)
        2. A furniture/object image that needs to be placed in the room

        ### Room Context
        - Room Type: {room_metadata.get('room_type', 'unknown')}
        - Style: {room_metadata.get('style', 'unknown')}
        - Design Type: {room_metadata.get('design_type', 'interior')}

        ### Furniture/Object Details
        - Description: {furniture_description if furniture_description else "Not provided"}

        ### Task:
        1. Analyze the room layout, perspective, lighting, and spatial dimensions
        2. Identify the most appropriate location for the furniture/object
        3. Scale the furniture appropriately to match the room's proportions
        4. Adjust the furniture orientation and perspective to match the room's viewpoint
        5. Ensure the furniture shadows and lighting match the room environment
        6. Blend the furniture naturally into the scene with realistic placement
        7. Maintain the room's existing design style and aesthetic

        ### Output:
        - Generate a photo-realistic composite image showing the furniture placed naturally in the room
        - Provide a brief description of where and how the furniture was placed, including any adjustments made for realism

        Important: The furniture should look like it belongs in the space naturally, with correct perspective, scale, lighting, and shadows.
        """

        contents = [
            prompt,
            types.Part.from_bytes(
                data=room_image_bytes,
                mime_type="image/png",
            ),
            types.Part.from_bytes(
                data=furniture_b64,
                mime_type=furniture_image.content_type,
            )
        ]

        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )

        image_data = None
        text_response = "No description available."

        if response.candidates and len(response.candidates) > 0:
            parts = response.candidates[0].content.parts

            if parts:
                for part in parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        image_data = part.inline_data.data
                        image_mime_type = getattr(part.inline_data, "mime_type", "image/png")
                        print(f"Generated furniture placement image, length: {len(image_data)}")
                    elif hasattr(part, "text") and part.text:
                        text_response = part.text
                        print(f"Placement description: {text_response[:100]}...")

        image_url = None
        if image_data:
            image_base64 = base64.b64encode(image_data).decode("utf-8")
            image_url = f"data:{image_mime_type};base64,{image_base64}"

        return JSONResponse(content={
            "image": image_url,
            "text": text_response,
            "original_design_id": design_id
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in furniture placement: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")
