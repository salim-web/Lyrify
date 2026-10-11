import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

try:
    print("Testing generate_content with gemini-2.5-flash...")
    model = genai.GenerativeModel('gemini-2.5-flash')
    # Try a simple text prompt
    res = model.generate_content("hello", request_options={"timeout": 600})
    print("Text Response:", res.text)
    
    # Try uploading a dummy file and generating content
    with open("dummy.txt", "w") as f:
        f.write("This is a test file.")
    print("Uploading file...")
    audio_file = genai.upload_file(path="dummy.txt")
    print("Generating from file...")
    res2 = model.generate_content(["Describe this file", audio_file], request_options={"timeout": 600})
    print("File Response:", res2.text)
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Failed: {e}")
