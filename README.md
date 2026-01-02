# Antigravity Project

## Prerequisites
- Python 3.8+
- Node.js 16+
- FFmpeg (installed and added to PATH)

## Backend (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   *Note: This includes a specific PyTorch version for CUDA 11.8.*

3. Run the server:
   ```bash
   uvicorn main:app --reload
   ```
   The backend will start at `http://localhost:8000`.

## Frontend (Next.js)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000`.
