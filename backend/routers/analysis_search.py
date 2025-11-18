from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os
from google import genai
from google.genai import types
import traceback
import base64
import json
from serpapi import GoogleSearch # Thư viện tìm kiếm

load_dotenv()

router = APIRouter()

# --- Cài đặt Khóa API ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY") 
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in .env")
if not SERPAPI_API_KEY:
    raise ValueError("Missing SERPAPI_API_KEY in .env")


client = genai.Client(api_key=GEMINI_API_KEY)

# Hàm trợ giúp để chuyển bytes sang base64
def array_buffer_to_base64(data: bytes) -> str:
    return base64.b64encode(data).decode('utf-8')

## ĐỊNH NGHĨA HÀM TÌM KIẾM SERPAPI (Đã giới hạn num=3)
def search_products(query: str):
    """Tìm kiếm sản phẩm trên Google Shopping bằng SerpAPI, giới hạn 3 kết quả."""
    try:
        search = GoogleSearch({
            "api_key": SERPAPI_API_KEY,
            "engine": "google_shopping",
            "q": query,
            "location": "Vietnam",  
            "hl": "vi",
            "gl": "vn",
            "num": 3  # <-- Đã giới hạn chỉ 3 kết quả mỗi món đồ
        })
        results = search.get_dict()
        
        product_links = []
        if "shopping_results" in results:
            for item in results["shopping_results"]:
                product_links.append({
                    "title": item.get("title"),
                    "link": item.get("link"),
                    "price": item.get("price"),
                    "source": item.get("source"),
                    "thumbnail": item.get("thumbnail")
                })
        return product_links
    except Exception as e:
        print(f"SerpAPI search failed: {e}")
        traceback.print_exc()
        return []


@router.post("/analyze-and-search")
async def analyze_and_search(
    uploaded_image: UploadFile = File(...)
):
    try:
        # --- 1. Xử lý ảnh và kiểm tra kích thước ---
        MAX_IMAGE_SIZE_MB = 10
        ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

        if uploaded_image.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported file type.")

        image_bytes = await uploaded_image.read()
        if len(image_bytes) / (1024 * 1024) > MAX_IMAGE_SIZE_MB:
            raise HTTPException(status_code=400, detail="Image exceeds 10MB size limit.")
        
        image_b64 = array_buffer_to_base64(image_bytes)
        
        # --- 2. Prompt Gemini ĐÃ TỐI ƯU HÓA ĐỘ GIỐNG ---
        prompt = """
        Analyze the uploaded room image. Identify the 3 to 5 most significant pieces of furniture (e.g., bed, sofa, coffee table, prominent chair, large lamp) that define the room's style. 

        For each item identified, generate a *highly specific search query* (in English, optimized for Google Shopping) that would return products that are the *closest visual match* to the item in the image. Include material, style, color, and key design features in the query to ensure maximum similarity.

        Your output must be a single JSON object (formatted as a string) with two keys:
        1. "description": A brief description of the room's overall style and key features (e.g., "Bohemian style bedroom/living area with rattan accents").
        2. "search_queries": A LIST of objects, where each object contains a descriptive name for the item and a highly specific search query.
        
        Return only the JSON string.
        """
        
        contents=[
            prompt,
            types.Part.from_bytes(
                data=image_b64,
                mime_type=uploaded_image.content_type,
            )
        ]
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents
        )
        
        # --- 3. Trích xuất NHIỀU TRUY VẤN ---
        if not response.text:
            raise HTTPException(status_code=500, detail="Gemini failed to generate a response.")
            
        try:
            json_string = response.text.strip().replace("```json", "").replace("```", "").strip()
            analysis_data = json.loads(json_string)
            
            queries_to_run = analysis_data.get("search_queries", [])
            description = analysis_data.get("description", "No detailed description generated.")

        except json.JSONDecodeError:
            print("Gemini response was not valid JSON:", response.text)
            queries_to_run = [] 
            description = "Error parsing AI response. Cannot extract multiple queries."

        # --- 4. Tìm kiếm sản phẩm bằng SerpAPI ---
        all_product_links = []
        
        for item in queries_to_run:
            query_name = item.get("name", "Item")
            search_query = item.get("query")
            
            if search_query:
                # Gọi hàm search_products đã giới hạn 3 kết quả
                product_results = search_products(search_query) 
                
                # Gắn tên món đồ vào từng kết quả để frontend nhóm lại
                for product in product_results:
                    product['item_name'] = query_name 
                
                all_product_links.extend(product_results)
                
        # --- 5. Trả về kết quả (đã bao gồm ảnh gốc) ---
        return JSONResponse(content={
            "description": description,
            "product_links": all_product_links,
            "image_data": f"data:{uploaded_image.content_type};base64,{image_b64}" # TRẢ VỀ ẢNH GỐC
        })

    except Exception as e:
        print(f"Error in /analyze-and-search endpoint: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal Server Error")