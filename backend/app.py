import os
import uvicorn
import gradio as gr
from main import app as fastapi_app

# Optional Gradio dashboard interface
with gr.Blocks(title="Lyrify Backend API") as demo:
    gr.Markdown("""
    # 🎵 Lyrify Backend API is Running!
    
    This Hugging Face Space powers the **Lyrify** AI-synced lyrics platform.
    
    - **Status:** Healthy & Active
    - **Endpoints:**
      - `POST /transcribe/upload`
      - `POST /transcribe/link`
      - `GET /static/{filename}`
      - `GET /`
    """)

# Mount Gradio onto the existing FastAPI application
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
