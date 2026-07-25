# Stage 1: Build the frontend
FROM node:22-alpine AS builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve the backend + frontend and run code
FROM python:3.11-slim

# Install JDK for running Java code
RUN apt-get update && apt-get install -y default-jdk g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY *.py ./

# Copy built frontend from Stage 1
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose the API port
EXPOSE 8000

# Start the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
