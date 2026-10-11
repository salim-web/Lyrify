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

# Prevent torchaudio C++ ABI load failure on cloud platforms (Render, Hugging Face Spaces)
try:
    import torchaudio._extension.utils as _tau
    _orig_load_lib = _tau._load_lib
    def _safe_load_lib(lib):
        try:
            return _orig_load_lib(lib)
        except Exception:
            return False
    _tau._load_lib = _safe_load_lib
except Exception:
    pass

from main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
