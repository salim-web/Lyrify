import os
import uvicorn

# ZeroGPU requires @spaces.GPU to be defined in app.py
try:
    import spaces
    @spaces.GPU
    def _gpu_worker():
        pass
except Exception:
    pass

from main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
