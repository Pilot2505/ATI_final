from fastapi import FastAPI
from routers import tryon, furniture_placement
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tryon.router, prefix="/api")
app.include_router(furniture_placement.router, prefix="/api")
