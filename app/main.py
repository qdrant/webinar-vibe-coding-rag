from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api import router as api_router
from app.services.video_service import get_video_by_id

app = FastAPI(title="In-Video Search", docs_url=None, redoc_url=None, openapi_url=None)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates
templates = Jinja2Templates(directory="app/templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html", {"request": request, "title": "In-Video Search"}
    )


@app.get("/video/{video_id}", response_class=HTMLResponse)
async def video_page(request: Request, video_id: str):
    # Try to get video info from database
    video = get_video_by_id(video_id)
    title = "Video Player"

    # If video exists and has a title, use it
    if video and video.title:
        title = video.title

    return templates.TemplateResponse(
        "video.html",
        {"request": request, "title": title, "video_id": video_id},
    )


@app.get("/watch")
async def watch_redirect(request: Request, v: str):
    # Redirect YouTube-style URLs to our video page
    return RedirectResponse(url=f"/video/{v}")


# Include API routers
app.include_router(api_router.router, prefix="/api")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
