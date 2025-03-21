import uuid
from typing import List, Dict, Any, Optional
import re
from datetime import datetime
from sentence_transformers import SentenceTransformer
from qdrant_client.http import models
from youtube_transcript_api import YouTubeTranscriptApi
import yt_dlp
from app.models.video import VideoSegment, Video, SearchResult
from app.services.qdrant_service import qdrant_client

# Initialize the sentence transformer model
model = SentenceTransformer("sentence-transformers/static-retrieval-mrl-en-v1")

# Collection names
COLLECTION_NAME = "video_segments"
PROCESSED_VIDEOS_COLLECTION = "processed_videos"


def _fetch_youtube_metadata(video_id: str, video: Optional[Video] = None) -> Video:
    """Helper function to fetch video metadata from YouTube using yt-dlp."""
    import logging

    if not video:
        video = Video(video_id=video_id)

    try:
        logging.info(f"Fetching metadata for video {video_id} from YouTube")

        # Configure yt-dlp options
        ydl_opts = {
            "skip_download": True,  # Don't download the video
            "quiet": True,  # Don't print progress
            "no_warnings": True,  # Don't print warnings
            "extract_flat": True,  # Don't extract videos in playlists
            "format": "best",  # Best quality (doesn't matter since we're not downloading)
        }

        # Use yt-dlp to extract video info
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )

            # Set video properties if available
            if info.get("title"):
                video.title = info.get("title")

            if info.get("description"):
                video.description = info.get("description")

            if info.get("uploader"):
                video.channel = info.get("uploader")

        logging.info(
            f"Successfully retrieved video metadata: title='{video.title}', channel='{video.channel}'"
        )
    except Exception as meta_error:
        logging.warning(f"Could not fetch metadata from YouTube: {str(meta_error)}")
        if not video.title:
            video.title = f"Video {video_id}"

    return video


# Ensure collections exist
def ensure_collection_exists():
    """Ensure the required collections exist in Qdrant."""
    import logging

    try:
        logging.info("Checking Qdrant collections")
        collections = qdrant_client.get_collections().collections
        collection_names = [collection.name for collection in collections]
        logging.info(f"Existing collections: {collection_names}")

        # Create video segments collection if it doesn't exist
        if COLLECTION_NAME not in collection_names:
            logging.info(f"Creating collection: {COLLECTION_NAME}")
            vector_size = model.get_sentence_embedding_dimension()
            qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE,
                ),
            )
            logging.info(
                f"Successfully created {COLLECTION_NAME} collection with vector size {vector_size}"
            )

        # Create processed videos collection if it doesn't exist
        if PROCESSED_VIDEOS_COLLECTION not in collection_names:
            logging.info(f"Creating collection: {PROCESSED_VIDEOS_COLLECTION}")
            vector_size = model.get_sentence_embedding_dimension()
            qdrant_client.create_collection(
                collection_name=PROCESSED_VIDEOS_COLLECTION,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE,
                ),
            )
            qdrant_client.create_payload_index(
                collection_name=PROCESSED_VIDEOS_COLLECTION,
                field_name="video_id",
                field_schema=models.PayloadSchemaType.KEYWORD,
            )
            qdrant_client.create_payload_index(
                collection_name=PROCESSED_VIDEOS_COLLECTION,
                field_name="created_at",
                field_schema=models.IntegerIndexParams(
                    type=models.IntegerIndexType.INTEGER,
                    range=True,
                ),
            )
            logging.info(
                f"Successfully created {PROCESSED_VIDEOS_COLLECTION} collection with vector size {vector_size}"
            )
    except Exception as e:
        import traceback

        logging.error(f"Error ensuring collections exist: {str(e)}")
        logging.error(traceback.format_exc())
        raise


def get_embeddings(text: str) -> List[float]:
    """Get embeddings for the given text using SentenceTransformer."""
    return model.encode(text).tolist()


def extract_video_id(youtube_url: str) -> str:
    """Extract YouTube video ID from URL."""
    import logging

    logging.info(f"Extracting video ID from URL: {youtube_url}")

    # Match patterns like: https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]+)",
        r"(?:youtube\.com/embed/)([\w-]+)",
        r"(?:youtube\.com/v/)([\w-]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, youtube_url)
        if match:
            video_id = match.group(1)
            logging.info(f"Extracted video ID: {video_id}")
            return video_id

    # If no pattern matches, assume the input might be a direct video ID
    if re.match(r"^[\w-]+$", youtube_url):
        logging.info(f"Using direct video ID: {youtube_url}")
        return youtube_url

    logging.error(f"Failed to extract video ID from URL: {youtube_url}")
    raise ValueError(f"Could not extract video ID from URL: {youtube_url}")


def get_video_transcript(video_id: str) -> List[Dict[str, Any]]:
    """
    Get transcript for a YouTube video in any available language.
    Will try to get transcripts in this priority:
    1. English transcript (if available)
    2. Any available transcript translated to English (if translatable)
    3. Any available transcript in its original language
    """
    import logging
    import traceback

    try:
        # Try to get available transcript languages
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # First, look for English transcript
        english_transcript = None
        other_transcripts = []

        # Categorize available transcripts
        for transcript_item in transcript_list:
            if transcript_item.language_code == "en":
                english_transcript = transcript_item
            else:
                other_transcripts.append(transcript_item)

        # 1. Try English first if available
        if english_transcript:
            try:
                logging.info("Found English transcript, using it directly")
                return english_transcript.fetch()
            except Exception as e:
                logging.warning(f"Failed to fetch English transcript: {str(e)}")

        # 2. Try translatable transcripts
        translatable_transcripts = [t for t in other_transcripts if t.is_translatable]
        for transcript_item in translatable_transcripts:
            try:
                logging.info(
                    f"Trying to translate {transcript_item.language_code} transcript to English"
                )
                translated = transcript_item.translate("en").fetch()
                logging.info(
                    f"Successfully translated {transcript_item.language_code} transcript to English"
                )
                return translated
            except Exception as e:
                logging.warning(
                    f"Failed to translate {transcript_item.language_code} transcript: {str(e)}"
                )

        # 3. Try any transcript in original language
        for transcript_item in other_transcripts:
            try:
                logging.info(
                    f"Using non-translated {transcript_item.language_code} transcript"
                )
                return transcript_item.fetch()
            except Exception as e:
                logging.warning(
                    f"Failed to fetch {transcript_item.language_code} transcript: {str(e)}"
                )

        # If we get here, no transcripts worked
        available_langs = [t.language_code for t in transcript_list]
        raise ValueError(
            f"No usable transcripts found for video {video_id}. Available languages: {available_langs}"
        )

    except Exception as e:
        logging.error(f"Transcript API error for video {video_id}: {str(e)}")
        logging.error(traceback.format_exc())
        raise ValueError(f"Could not get transcript for video {video_id}: {str(e)}")


def store_processed_video(video: Video) -> bool:
    """Store a processed video in Qdrant."""
    try:
        # Get a simple embedding for the video ID
        vector = get_embeddings(f"video_{video.video_id}")

        # Prepare payload
        payload = video.model_dump()

        # Store in Qdrant
        qdrant_client.upsert(
            collection_name=PROCESSED_VIDEOS_COLLECTION,
            points=[
                models.PointStruct(
                    id=uuid.uuid4().hex,
                    vector=vector,
                    payload=payload,
                ),
            ],
        )
        return True
    except Exception as e:
        print(f"Error storing processed video: {e}")
        return False


def get_processed_videos(limit: int = 10) -> List[Video]:
    """Get recently processed videos ordered by creation time."""
    try:
        # Scroll through the processed videos collection
        scroll_result = qdrant_client.scroll(
            collection_name=PROCESSED_VIDEOS_COLLECTION,
            limit=limit,
            with_payload=True,
            order_by=models.OrderBy(key="created_at", direction=models.Direction.DESC),
        )

        # Extract videos from the result
        videos = []
        for point in scroll_result[0]:
            # Convert payload to Video
            video = Video(**point.payload)
            videos.append(video)

        # Sort by created_at timestamp (most recent first)
        videos.sort(key=lambda x: x.created_at or "", reverse=True)

        return videos[:limit]
    except Exception as e:
        print(f"Error getting processed videos: {e}")
        return []


def process_video(youtube_url: str) -> Video:
    """Process a YouTube video to extract and store transcript segments."""
    import logging
    import traceback

    logging.info(f"Processing video URL: {youtube_url}")
    transcript = None
    video_id = None

    # Extract video ID and get transcript
    try:
        # Extract video ID
        video_id = extract_video_id(youtube_url)
        logging.info(f"Successfully extracted video ID: {video_id}")

        # Check if video has already been processed
        existing_video = get_video_by_id(video_id)
        if existing_video and existing_video.processed:
            logging.info(
                f"Video {video_id} has already been processed. Skipping processing."
            )
            return existing_video

        # Create basic video object with current timestamp
        current_time = int(datetime.utcnow().timestamp())
        video = Video(video_id=video_id, created_at=current_time)

        # Get video metadata from YouTube using the helper function
        try:
            video = _fetch_youtube_metadata(video_id, video)
        except Exception as meta_error:
            logging.warning(
                f"Error fetching YouTube metadata during processing: {str(meta_error)}"
            )
            # Continue with processing even if metadata fetch fails

        # Get transcript
        logging.info(f"Fetching transcript for video ID: {video_id}")
        transcript = get_video_transcript(video_id)
        logging.info(
            f"Successfully retrieved transcript with {len(transcript)} entries"
        )

        # If we couldn't get metadata and have a transcript, try to extract a title from transcript
        if (
            (not video.title or video.title == f"Video {video_id}")
            and transcript
            and len(transcript) > 0
        ):
            # Handle different transcript formats
            try:
                # Check if transcript is a list of dictionaries (original format)
                if isinstance(transcript[0], dict) and "text" in transcript[0]:
                    video.title = f"{transcript[0]['text'][:30]}..."
                # Check if transcript is a list of objects with text attribute
                elif hasattr(transcript[0], "text"):
                    video.title = f"{transcript[0].text[:30]}..."
                # If it's another format, just use the string representation of first item
                else:
                    first_item_str = str(transcript[0])[:30]
                    video.title = f"{first_item_str}..."
                logging.info(f"Set video title from transcript: {video.title}")
            except Exception as title_error:
                logging.warning(
                    f"Could not set title from transcript: {str(title_error)}"
                )
    except Exception as e:
        logging.error(f"Error in initial video processing: {str(e)}")
        logging.error(traceback.format_exc())
        raise

    # Process transcript into segments
    try:
        # Process transcript into overlapping 30-second segments with 10-second overlap
        logging.info(f"Processing {len(transcript)} transcript entries into segments")
        segments = []

        # First, normalize the transcript to a standard format
        normalized_transcript = []
        for item in transcript:
            if (
                isinstance(item, dict)
                and "text" in item
                and "start" in item
                and "duration" in item
            ):
                # Original dictionary format
                normalized_transcript.append(
                    {
                        "text": item["text"],
                        "start": item["start"],
                        "duration": item["duration"],
                    }
                )
            elif (
                hasattr(item, "text")
                and hasattr(item, "start")
                and hasattr(item, "duration")
            ):
                # Object with attributes
                normalized_transcript.append(
                    {"text": item.text, "start": item.start, "duration": item.duration}
                )
            else:
                # Unknown format, try to extract what we can
                logging.warning(
                    f"Encountered unknown transcript item format: {type(item)}"
                )
                try:
                    # Convert to string if we can't determine the structure
                    text = str(item)
                    # Use index as a timestamp approximation
                    idx = transcript.index(item)
                    normalized_transcript.append(
                        {
                            "text": text,
                            "start": float(idx * 5),  # Approximate 5 seconds per item
                            "duration": 5.0,
                        }
                    )
                except Exception as e:
                    logging.error(f"Failed to normalize transcript item: {str(e)}")
                    continue

        # Use the normalized transcript for segment processing
        for i in range(len(normalized_transcript)):
            # Find segments that form approximately 30 seconds
            segment_text = []
            start_time = normalized_transcript[i]["start"]
            end_time = start_time
            current_index = i

            while (
                current_index < len(normalized_transcript)
                and end_time - start_time < 30
            ):
                segment_text.append(normalized_transcript[current_index]["text"])
                end_time = (
                    normalized_transcript[current_index]["start"]
                    + normalized_transcript[current_index]["duration"]
                )
                current_index += 1

            if segment_text:  # Only create segment if we have text
                segment_id = f"{video_id}_{i}"
                text = " ".join(segment_text)

                # Create VideoSegment
                segment = VideoSegment(
                    text=text,
                    start=start_time,
                    end=end_time,
                    segment_id=segment_id,
                    video_id=video_id,
                )

                segments.append(segment)

            # Skip forward with 10-second overlap (if we're not at the end)
            if (
                i + 1 < len(normalized_transcript)
                and normalized_transcript[i + 1]["start"] < end_time - 10
            ):
                # Find the next segment that starts at least 20 seconds after our current start
                while (
                    i + 1 < len(normalized_transcript)
                    and normalized_transcript[i + 1]["start"] < start_time + 20
                ):
                    i += 1

        logging.info(f"Created {len(segments)} segments from transcript")

        # Store segments in Qdrant
        logging.info("Ensuring Qdrant collections exist")
        ensure_collection_exists()

        # Store each segment
        logging.info(f"Storing {len(segments)} segments in Qdrant")
        for segment in segments:
            store_segment(segment)
    except Exception as e:
        logging.error(f"Error processing transcript segments: {str(e)}")
        logging.error(traceback.format_exc())
        raise

    # Mark video as processed and store it
    try:
        logging.info(f"Marking video {video_id} as processed")
        video.processed = True

        # Store the processed video in Qdrant
        logging.info("Storing processed video in Qdrant")
        store_result = store_processed_video(video)
        if store_result:
            logging.info(f"Successfully stored processed video: {video_id}")
        else:
            logging.warning(f"Failed to store processed video in Qdrant: {video_id}")

        return video
    except Exception as e:
        logging.error(f"Error storing processed video: {str(e)}")
        logging.error(traceback.format_exc())
        raise


def store_segment(segment: VideoSegment) -> bool:
    """Store a video segment in Qdrant."""
    import logging

    try:
        # Get embeddings
        logging.debug(f"Getting embeddings for segment {segment.segment_id}")
        vector = get_embeddings(segment.text)

        # Prepare payload
        payload = segment.model_dump()

        # Store in Qdrant
        point_id = uuid.uuid4().hex
        logging.debug(
            f"Storing segment {segment.segment_id} in Qdrant with point ID {point_id}"
        )
        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                ),
            ],
        )
        return True
    except Exception as e:
        import traceback

        logging.error(f"Error storing segment {segment.segment_id}: {str(e)}")
        logging.error(traceback.format_exc())
        return False


def search_video_segments(
    query: str, video_id: Optional[str] = None, limit: int = 5
) -> List[SearchResult]:
    """Search for video segments based on the provided query."""
    # Get query embeddings
    query_vector = get_embeddings(query)

    # Prepare filter if video_id is provided
    filter_param = None
    if video_id:
        filter_param = models.Filter(
            must=[
                models.FieldCondition(
                    key="video_id",
                    match=models.MatchValue(value=video_id),
                ),
            ],
        )

    # Search in Qdrant
    search_result = qdrant_client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=limit,
        query_filter=filter_param,
    )

    # Format results
    results = []
    for scored_point in search_result:
        # Convert payload to VideoSegment
        segment = VideoSegment(**scored_point.payload)

        # Create SearchResult
        result = SearchResult(
            score=scored_point.score,
            segment=segment,
        )
        results.append(result)

    return results


def get_all_segments(video_id: str) -> List[VideoSegment]:
    """Get all segments for a specific video, ordered by start time."""
    # Prepare filter for the video_id
    filter_param = models.Filter(
        must=[
            models.FieldCondition(
                key="video_id",
                match=models.MatchValue(value=video_id),
            ),
        ],
    )

    # Search in Qdrant without vector, just to get all segments
    scroll_result = qdrant_client.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=filter_param,
        limit=10000,  # Adjust based on expected maximum segments
    )

    # Format results
    segments = []
    for point in scroll_result[0]:
        # Convert payload to VideoSegment
        segment = VideoSegment(**point.payload)
        segments.append(segment)

    # Sort by start time
    segments.sort(key=lambda x: x.start)

    return segments


def get_video_by_id(video_id: str) -> Optional[Video]:
    """Get a specific video by its video_id. If not found in database, attempt to fetch from YouTube."""
    import logging

    try:
        # Create filter for the video_id
        filter_param = models.Filter(
            must=[
                models.FieldCondition(
                    key="video_id",
                    match=models.MatchValue(value=video_id),
                ),
            ],
        )

        # Search in the processed_videos collection
        scroll_result = qdrant_client.scroll(
            collection_name=PROCESSED_VIDEOS_COLLECTION,
            scroll_filter=filter_param,
            limit=1,  # We only need one result
            with_payload=True,
        )

        # Check if any results were found
        if scroll_result[0]:
            # Convert payload to Video
            video = Video(**scroll_result[0][0].payload)

            # If video exists but doesn't have title, try to fetch it from YouTube
            if not video.title or video.title == f"Video {video_id}":
                video = _fetch_youtube_metadata(video_id, video)

            return video

        # If video not found in database, fetch basic metadata from YouTube
        logging.info(f"Video {video_id} not found in database, fetching from YouTube")
        video = Video(video_id=video_id)
        return _fetch_youtube_metadata(video_id, video)

    except Exception as e:
        logging.error(f"Error getting video by ID {video_id}: {str(e)}")
        # Return a basic video object with just the ID
        return Video(video_id=video_id, title=f"Video {video_id}")
