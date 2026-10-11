import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

try:
    print("Testing generate_content timeout...")
    model = genai.GenerativeModel('gemini-2.5-pro')
    # Use a dummy prompt to see if it even connects
    res = model.generate_content("hello", request_options={"timeout": 600})
    print("Response:", res.text)
except Exception as e:
    print(f"Failed: {e}")
