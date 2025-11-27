# Use official Python image
FROM python:3.11-slim

# Set UTF-8 locale (IMPORTANT)
ENV PYTHONIOENCODING=utf-8
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

ENV GOOGLE_CLOUD_PROJECT=pothole-webapp
ENV BUCKET_NAME=pothole-images-sriram


# Set working directory inside the container
WORKDIR /app

# Copy requirements first (for caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Expose port (Cloud Run always uses $PORT)
EXPOSE 8080

# Start the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
