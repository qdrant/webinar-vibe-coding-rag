from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.video import Video, SearchResult, VideoSegment
from app.services.video_service import (
    process_video,
    search_video_segments,
    get_all_segments,
    get_processed_videos,
    get_video_by_id,
)
from pydantic import BaseModel

router = APIRouter()


class VideoRequest(BaseModel):
    url: str


class VideoResponse(BaseModel):
    """Response model for video processing with additional status information."""

    video: Video
    newly_processed: bool = False


@router.post("/process", response_model=VideoResponse)
async def process_video_endpoint(video_request: VideoRequest) -> VideoResponse:
    """Process a YouTube video to extract and store transcript segments.
    If the video has already been processed, returns the existing data without reprocessing."""
    try:
        import logging

        # Get the video ID first
        from app.services.video_service import extract_video_id, get_video_by_id

        video_id = extract_video_id(video_request.url)

        # Check if already processed
        existing_video = get_video_by_id(video_id)
        already_processed = existing_video is not None and existing_video.processed

        if already_processed:
            logging.info(f"Video {video_id} already processed, returning existing data")
            return VideoResponse(video=existing_video, newly_processed=False)

        # Process the video if needed
        result = process_video(video_request.url)
        return VideoResponse(video=result, newly_processed=True)

    except Exception as e:
        import logging
        import traceback

        logging.error(f"Error processing video URL {video_request.url}: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_video_endpoint(
    query: str = Query(..., description="Search query for video content"),
    video_id: Optional[str] = Query(
        None, description="Optional YouTube video ID to limit search"
    ),
    limit: int = Query(5, description="Maximum number of results to return"),
) -> List[SearchResult]:
    """Search for video segments based on the provided query."""
    import logging

    # Check for invalid video_id
    if video_id and (video_id.lower() == "undefined" or video_id.lower() == "null"):
        logging.warning(f"Invalid video_id in search request: '{video_id}'")
        video_id = None  # Clear invalid video_id to perform a global search instead

    try:
        results = search_video_segments(query, video_id, limit)
        return results
    except Exception as e:
        logging.error(
            f"Error searching for query '{query}' with video_id '{video_id}': {str(e)}"
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/segments/{video_id}")
async def get_segments_endpoint(video_id: str) -> List[VideoSegment]:
    """Get all segments for a specific video, ordered by start time."""
    import logging

    # Check for invalid video ID
    if not video_id or video_id.lower() == "undefined" or video_id.lower() == "null":
        logging.warning(f"Invalid video ID requested: '{video_id}'")
        return []  # Return empty list for invalid IDs to avoid frontend errors

    try:
        segments = get_all_segments(video_id)
        if not segments:
            # Return an empty list instead of 404 to allow frontend to handle gracefully
            return []
        return segments
    except Exception as e:
        # Log the exception for debugging
        logging.error(f"Error getting segments for video {video_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Could not retrieve video segments: {str(e)}"
        )


@router.get("/recent")
async def get_recent_videos_endpoint(
    limit: int = Query(10, description="Maximum number of videos to return"),
) -> List[Video]:
    """Get recently processed videos ordered by creation time."""
    try:
        videos = get_processed_videos(limit=limit)
        return videos
    except Exception as e:
        # Log the exception for debugging
        import logging

        logging.error(f"Error getting recent videos: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Could not retrieve recent videos: {str(e)}"
        )


@router.get("/info/{video_id}")
async def get_video_info_endpoint(video_id: str) -> Video:
    """Get metadata for a specific video."""
    try:
        video = get_video_by_id(video_id)
        if not video:
            # Return a basic video object if not found in database
            return Video(video_id=video_id, title=f"Video {video_id}")
        return video
    except Exception as e:
        import logging

        logging.error(f"Error getting video info for {video_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Could not retrieve video info: {str(e)}"
        )
