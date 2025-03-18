# Get the directory of this script
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
parent_dir="$(dirname "$script_dir")"
data_dir="$parent_dir/.data"
snapshot_file="$(cd "$data_dir" && pwd)/mcp-server-qdrant-knowledge-base.snapshot"

# Start the container
docker run -d \
    --name "qdrant" \
    -p 6333:6333 -p 6334:6334 \
    -v "$(pwd)/qdrant_storage:/qdrant/storage:z" \
    "qdrant/qdrant:v1.13.4"

# Wait for Qdrant to start
until $(curl --output /dev/null --silent --fail http://localhost:6333/healthz); do
    printf '.'
    sleep 5
done

# Load the data snapshot into Qdrant
curl -X POST \
    -H "Content-Type: multipart/form-data" \
    -F "snapshot=@$snapshot_file" \
    http://localhost:6333/collections/mcp-server-qdrant-knowledge-base/snapshots/upload?priority=snapshot

