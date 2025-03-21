import os
import multiprocessing

# Get the number of workers from environment variable or calculate based on CPU cores
workers_env = os.getenv("WORKERS")
if workers_env:
    workers = int(workers_env)
else:
    # Use the recommended formula: (2 * CPU cores) + 1
    workers = (2 * multiprocessing.cpu_count()) + 1

# Use Uvicorn worker class for ASGI support
worker_class = "uvicorn.workers.UvicornWorker"

# Bind to 0.0.0.0:8000
bind = "0.0.0.0:8000"

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"

# Timeout configuration
timeout = 120  # 2 minutes
graceful_timeout = 30

# Worker settings
worker_connections = 1000  # Maximum number of connections each worker can handle
keepalive = 5  # Seconds to wait between client requests before closing connection

# For better performance with Uvicorn
proc_name = "vibe-coding-rag"