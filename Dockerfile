FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Poetry
RUN pip install poetry==1.8.3

# Copy poetry configuration files
COPY pyproject.toml poetry.lock poetry.toml* ./

# Configure poetry to not create a virtual environment
RUN poetry config virtualenvs.create false

# Install dependencies
RUN poetry install --no-dev --no-interaction --no-ansi

# Copy application code
COPY app ./app

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHONPATH=/app
ENV QDRANT_URL=http://localhost:6333
# ENV QDRANT_API_KEY=your_api_key_here (uncomment and set if needed)

# Calculate the number of workers based on available CPUs
# Using the recommended formula: (2 * CPU cores) + 1
ENV WORKERS=4

# Create gunicorn config file
COPY gunicorn.conf.py ./

# Command to run the application with Gunicorn and Uvicorn workers
CMD ["gunicorn", "app.main:app", "-c", "gunicorn.conf.py"]