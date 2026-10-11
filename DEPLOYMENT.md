# Lyrify — Free Production Deployment Guide
## Architecture: Vercel (Frontend) + Hugging Face Spaces (Backend)

This guide walks you through deploying **Lyrify for 100% free** using:
- **Frontend**: [Vercel](https://vercel.com) (Next.js 16, Global Edge CDN, Free Hobby Tier)
- **Backend**: [Hugging Face Spaces](https://huggingface.co/spaces) (Docker Container, 16 GB RAM, 2 vCPUs, Free Tier)

---

## Part 1: Deploy Backend to Hugging Face Spaces (Free)

Hugging Face Spaces provides a free Docker environment with **16 GB of RAM** and **2 vCPUs**, which easily handles FFmpeg, yt-dlp, and Whisper `small`.

### Step 1.1: Create a Space on Hugging Face
1. Log in to [Hugging Face](https://huggingface.co/) (create a free account if needed).
2. Go to **[huggingface.co/new-space](https://huggingface.co/new-space)**.
3. Fill in the details:
   - **Space name**: `lyrify-backend` (or your preferred name)
   - **License**: `mit` or `apache-2.0`
   - **Space SDK**: Select **Gradio** (Template: **Blank**) — *This is 100% Free!*
   - **Space hardware**: Select **CPU Basic** (or **ZeroGPU Free** for free Nvidia GPU acceleration!)
   - **Visibility**: **Public** (Important: Must be Public so your Vercel frontend and friends can access it)
4. Click **Create Space**.

### Step 1.2: Add Your Gemini API Key Secret
1. In your newly created Space, click on **Settings** (top right tab).
2. Scroll down to **Variables and secrets**.
3. Under **Secrets**, click **New secret**:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: `Your_Gemini_API_Key`
4. Click **Save**.

### Step 1.3: Push Backend Code to Hugging Face
In your terminal, push the `backend/` directory directly to your Hugging Face Space repository:

```bash
# 1. Navigate to the backend directory
cd /home/salim/projects/Lyrify/backend

# 2. Initialize a git repository inside backend
git init
git checkout -b main

# 3. Add your Hugging Face Space as a remote
# Replace <YOUR_HF_USERNAME> and <YOUR_SPACE_NAME> with your details:
git remote add space https://huggingface.co/spaces/<YOUR_HF_USERNAME>/<YOUR_SPACE_NAME>

# 4. Add the required files:
# - app.py (Entrypoint that runs FastAPI + Gradio)
# - packages.txt (Installs FFmpeg on Hugging Face)
# - main.py & requirements.txt
git add app.py main.py packages.txt requirements.txt
git commit -m "Deploy Lyrify FastAPI backend with Gradio SDK"

# 5. Push to Hugging Face (enter your HF username and your HF Access Token with Write permissions)
git push --force space main
```

> **Note on HF Access Token**: You can generate a Hugging Face Personal Access Token with Write permissions at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).

### Step 1.4: Obtain Your Backend URL
Once the build completes (takes ~2 minutes):
- Your Space will show **Running**.
- Click the **Embed / Direct URL** button (or 3 vertical dots at top right) -> **Direct URL**.
- Your public backend URL will look like:
  ```
  https://<YOUR_HF_USERNAME>-<YOUR_SPACE_NAME>.hf.space
  ```
- Test health by opening: `https://<YOUR_HF_USERNAME>-<YOUR_SPACE_NAME>.hf.space/`
  (Should return: `{"message":"Lyrics Service Backend is running"}`)

---

## Part 2: Deploy Frontend to Vercel (Free)

### Step 2.1: Push Project to GitHub
Ensure your latest commits are pushed to your GitHub repository:
```bash
cd /home/salim/projects/Lyrify
git push origin master
```

### Step 2.2: Import to Vercel
1. Log in to [Vercel](https://vercel.com) using your GitHub account.
2. Click **Add New...** -> **Project**.
3. Select your repository: **`salim-web/Lyrify`**.
4. Configure Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and select **`frontend`**
   - **Build Command**: `next build` (Default)
   - **Output Directory**: `.next` (Default)
5. Expand the **Environment Variables** section:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://<YOUR_HF_USERNAME>-<YOUR_SPACE_NAME>.hf.space` (from Part 1)
6. Click **Deploy**.

---

## Part 3: Verification & Live Testing

1. Once Vercel finishes deployment, click on your live Vercel URL (e.g. `https://lyrify-*.vercel.app`).
2. **Test File Upload**:
   - Try both **Online (Gemini)** and **Offline (Whisper)**.
   - Test the **Romanize (Hinglish)** toggle.
3. **Test YouTube / Audio Link**:
   - Paste a YouTube URL.
   - Confirm audio extracts, plays, and syncs word-by-word with the lyrics visualizer.

---

## Cost Summary

| Service | Component | Specs | Cost |
| :--- | :--- | :--- | :--- |
| **Vercel** | Frontend (Next.js) | Global Edge CDN, SSL, DDoS protection | **$0 / month** (Free Hobby) |
| **Hugging Face** | Backend (FastAPI + Docker) | 16 GB RAM, 2 vCPUs, FFmpeg | **$0 / month** (Free CPU Space) |
| **Google Gemini** | AI Transcription Engine | Gemini 2.5 Flash Free Tier | **$0 / month** (Free tier rate limits) |
| **Total** | Full Platform | Complete Production Deployment | **$0 / month (100% Free)** |

