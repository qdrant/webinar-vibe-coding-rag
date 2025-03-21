from fastapi import APIRouter
from app.api import video

router = APIRouter()

router.include_router(video.router, prefix="/video", tags=["video"])
