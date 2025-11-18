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

@router.get("/designs/all")
async def get_all_designs():
    try:
        result = supabase.table("room_designs").select("id, session_id, created_at, design_metadata, description").order("created_at", desc=True).execute()

        designs = []
        if result.data:
            for design in result.data:
                designs.append({
                    "id": design.get("id"),
                    "session_id": design.get("session_id"),
                    "created_at": design.get("created_at"),
                    "metadata": design.get("design_metadata"),
                    "description": design.get("description")
                })

        return JSONResponse(content={"designs": designs})
    except Exception as e:
        print(f"Error fetching all designs: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch designs")

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

@router.get("/design/{design_id}/image")
async def get_design_image_by_id(design_id: str):
    try:
        result = supabase.table("room_designs").select("generated_image_data").eq("id", design_id).maybeSingle().execute()

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

@router.get("/designs/{session_id}/{design_id}/image")
async def get_design_image(session_id: str, design_id: str):
    try:
        result = supabase.table("room_designs").select("generated_image_data").eq("id", design_id).eq("session_id", session_id).maybeSingle().execute()

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

@router.post("/furnitures/upload")
async def upload_furniture(
    session_id: str = Form(...),
    furniture_image: UploadFile = File(...),
    furniture_description: str = Form("")
):
    try:
        ALLOWED_MIME_TYPES = {
            "image/jpeg", "image/png", "image/webp",
            "image/heic", "image/heif"
        }

        if furniture_image.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(400, "Unsupported file type")

        furniture_bytes = await furniture_image.read()
        furniture_b64 = base64.b64encode(furniture_bytes).decode("utf-8")

        result = supabase.table("furnitures").insert({
            "session_id": session_id,
            "image_base64": furniture_b64,
            "description": furniture_description
        }).execute()

        return {"status": "success", "furniture_id": result.data[0]["id"]}

    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/place-furniture")
async def place_furniture(
    session_id: str = Form(...),
    design_id: str = Form(None),
    furniture_id: str = Form(None),
    furniture_image: UploadFile = File(None),
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

        if furniture_id:
            # fetch from library
            furniture_row = supabase.table("furnitures").select("image_base64, description") \
                .eq("id", furniture_id).maybeSingle().execute()
            if not furniture_row.data:
                raise HTTPException(404, "Furniture not found in library")
            furniture_b64 = furniture_row.data["image_base64"]
            if not furniture_description:
                furniture_description = furniture_row.data.get("description", "")
        else:
            # upload new furniture
            if not furniture_image:
                raise HTTPException(400, "Provide a furniture image or select from library")
            if furniture_image.content_type not in ALLOWED_MIME_TYPES:
                raise HTTPException(400, f"Unsupported file type: {furniture_image.content_type}")
            furniture_bytes = await furniture_image.read()
            size_in_mb = len(furniture_bytes) / (1024 * 1024)
            if size_in_mb > MAX_IMAGE_SIZE_MB:
                raise HTTPException(400, "Image exceeds 10MB size limit")
            furniture_b64 = array_buffer_to_base64(furniture_bytes)

        # === Get or generate room image ===
        room_image_bytes = None
        room_metadata = {}

        if design_id:
            # fetch existing room
            room_row = supabase.table("room_designs") \
                .select("generated_image_data, design_metadata") \
                .eq("id", design_id).eq("session_id", session_id).maybeSingle().execute()
            if not room_row.data:
                raise HTTPException(404, "Room design not found")
            room_base64 = room_row.data.get("generated_image_data")
            room_metadata = room_row.data.get("design_metadata", {})
            if not room_base64:
                raise HTTPException(404, "Room image data not found")
            room_image_bytes = base64.b64decode(room_base64)
        else:
            # generate default empty room
            prompt_empty_room = "Generate a neutral empty room with natural lighting for furniture placement"
            response_empty = client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=[prompt_empty_room],
                config=types.GenerateContentConfig(response_modalities=["IMAGE"])
            )
            if response_empty.candidates and response_empty.candidates[0].content.parts:
                room_part = response_empty.candidates[0].content.parts[0]
                if hasattr(room_part, "inline_data") and room_part.inline_data:
                    room_image_bytes = room_part.inline_data.data
                    room_metadata = {"room_type": "empty", "style": "neutral", "design_type": "interior"}
                else:
                    raise HTTPException(500, "Failed to generate empty room image")
            else:
                raise HTTPException(500, "Failed to generate empty room image")

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
            types.Part.from_bytes(data=room_image_bytes, mime_type="image/png"),
            types.Part.from_bytes(data=furniture_b64, mime_type=furniture_image.content_type if furniture_image else "image/png")
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
                    elif hasattr(part, "text") and part.text:
                        text_response = part.text

        if not image_data:
            raise HTTPException(500, "AI failed to generate furniture placement image")

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
    
    