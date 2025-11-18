from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
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
        result = supabase.table("room_designs").select("generated_image_data").eq("id", design_id).maybe_single().execute()

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
        result = supabase.table("room_designs").select("generated_image_data").eq("id", design_id).eq("session_id", session_id).maybe_single().execute()

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
    furniture_ids: str = Form(None),
    furniture_images: list[UploadFile] = File([]),
    furniture_descriptions: str = Form("")
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

        # --- Prepare furniture images ---
        furniture_bytes_list = []
        furniture_desc_list = []

        # 1. From library
        if furniture_ids:
            ids = [fid.strip() for fid in furniture_ids.split(",")]
            for fid in ids:
                row = supabase.table("furnitures").select("image_base64, description") \
                    .eq("id", fid).maybe_single().execute()
                if not row or not row.data:
                    continue  # skip invalid IDs
                furniture_bytes_list.append(base64.b64decode(row.data["image_base64"]))
                furniture_desc_list.append(row.data.get("description", "Furniture"))

        # 2. From new uploads
        if furniture_images:
            for idx, img in enumerate(furniture_images):
                if img.content_type not in ALLOWED_MIME_TYPES:
                    raise HTTPException(400, f"Unsupported file type: {img.content_type}")
                data = await img.read()
                size_in_mb = len(data) / (1024*1024)
                if size_in_mb > MAX_IMAGE_SIZE_MB:
                    raise HTTPException(400, "Image exceeds 10MB size limit")
                furniture_bytes_list.append(data)
                # Use description if provided, else default
                descs = furniture_descriptions.split(",") if furniture_descriptions else []
                furniture_desc_list.append(descs[idx] if idx < len(descs) else "Furniture")

        if not furniture_bytes_list:
            raise HTTPException(400, "No furniture images provided")

        # === Get or generate room image ===
        room_image_bytes = None
        room_metadata = {}

        if design_id:
            # fetch existing room
            room_row = supabase.table("room_designs") \
                .select("*") \
                .eq("id", design_id).eq("session_id", session_id).maybe_single().execute()
            
            if row and row.data and row.data.get("generated_image_data"):
                room_image_bytes = base64.b64decode(row.data["generated_image_data"])
                room_metadata = row.data.get("design_metadata", {})
            else:
                # Fallback to empty room
                prompt_empty_room = "Generate a neutral empty room with natural lighting for furniture placement"
                response_empty = client.models.generate_content(
                    model="gemini-2.5-flash-image",
                    contents=[prompt_empty_room],
                    config=types.GenerateContentConfig(response_modalities=["IMAGE"])
                )
                if response_empty.candidates and response_empty.candidates[0].content.parts:
                    part = response_empty.candidates[0].content.parts[0]
                    if hasattr(part, "inline_data") and part.inline_data:
                        room_image_bytes = part.inline_data.data
                        room_metadata = {"room_type": "empty", "style": "neutral", "design_type": "interior"}
                if not room_image_bytes:
                    raise HTTPException(500, "Failed to get room image")
                
        else:
            # No design_id: generate empty room
            prompt_empty_room = "Generate a neutral empty room with natural lighting for furniture placement"
            response_empty = client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=[prompt_empty_room],
                config=types.GenerateContentConfig(response_modalities=["IMAGE"])
            )
            if response_empty.candidates and response_empty.candidates[0].content.parts:
                part = response_empty.candidates[0].content.parts[0]
                if hasattr(part, "inline_data") and part.inline_data:
                    room_image_bytes = part.inline_data.data
                    room_metadata = {"room_type": "empty", "style": "neutral", "design_type": "interior"}
            if not room_image_bytes:
                raise HTTPException(500, "Failed to generate empty room")

        # --- Prepare prompt for AI ---
        furniture_details = "\n".join([f"{i+1}. Description: {d}" for i, d in enumerate(furniture_desc_list)])
        prompt = f"""
        You are a professional AI interior designer specializing in furniture placement.

        Room context:
        - Room Type: {room_metadata.get('room_type', 'unknown')}
        - Style: {room_metadata.get('style', 'unknown')}
        - Design Type: {room_metadata.get('design_type', 'interior')}

        Furniture to place:
        {furniture_details}

        Task:
        - Place all furniture naturally in the room with correct scale, perspective, shadows, and lighting.
        - Maintain realism and aesthetic style.

        Output:
        - A single composite image with all furniture placed.
        - A short description of placement for each item.
        """

        contents = [prompt, types.Part.from_bytes(data=room_image_bytes, mime_type="image/png")]
        for fb in furniture_bytes_list:
            contents.append(types.Part.from_bytes(data=fb, mime_type="image/png"))

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
    
    