import os
from qdrant_client import QdrantClient
import logging


def get_qdrant_client() -> QdrantClient:
    """
    Initialize a Qdrant client using environment variables or default to localhost.

    Environment variables:
    - QDRANT_URL: URL for Qdrant server (default: http://localhost:6333)
    - QDRANT_API_KEY: Optional API key for authentication

    Returns:
        QdrantClient: Configured Qdrant client
    """
    # Get configuration from environment variables with defaults
    url = os.getenv("QDRANT_URL", "http://localhost:6333")
    api_key = os.getenv("QDRANT_API_KEY")

    # Configure client with or without API key
    if api_key:
        client = QdrantClient(location=url, api_key=api_key)
        logging.info(f"Connecting to Qdrant at {url} with API key")
    else:
        client = QdrantClient(location=url)
        logging.info(f"Connecting to Qdrant at {url}")

    # Test connection
    try:
        client.get_collections()
        logging.info(f"Successfully connected to Qdrant at {url}")
    except Exception as e:
        logging.error(f"Failed to connect to Qdrant at {url}: {e}")
        # Connection will be tested again when used

    return client


# Initialize global client instance
qdrant_client = get_qdrant_client()
