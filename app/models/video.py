from pydantic import BaseModel, Field
from typing import Optional


class VideoSegment(BaseModel):
    """Model for a video segment with transcript."""

    text: str = Field(..., description="Transcript text of the segment")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    segment_id: str = Field(..., description="Unique identifier for the segment")
    video_id: str = Field(..., description="YouTube video ID this segment belongs to")


class Video(BaseModel):
    """Model for a YouTube video with metadata."""

    video_id: str = Field(..., description="YouTube video ID")
    title: Optional[str] = Field(None, description="Video title")
    description: Optional[str] = Field(None, description="Video description")
    channel: Optional[str] = Field(None, description="Channel name")
    processed: bool = Field(False, description="Whether the video has been processed")
    created_at: Optional[int] = Field(
        None, description="Unix timestamp (seconds since epoch) when the video was processed"
    )


class SearchResult(BaseModel):
    """Model for a video segment search result."""

    score: float = Field(..., description="Similarity score")
    segment: VideoSegment = Field(..., description="The matching video segment")
