import os
import time
import redis
from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
from groq import Groq

# 1. Initialize Connections
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
r = redis.Redis.from_url(redis_url, decode_responses=True)

# Initialize the Groq client
groq_client = Groq()

print("🧠 AI Worker connected. Ready for real AI processing...", flush=True)

def extract_video_id(url):
    """Helper function to get the 'v=' part out of a YouTube URL"""
    parsed_url = urlparse(url)
    if parsed_url.hostname == 'youtu.be':
        return parsed_url.path[1:]
    if parsed_url.hostname in ('www.youtube.com', 'youtube.com'):
        if parsed_url.path == '/watch':
            return parse_qs(parsed_url.query)['v'][0]
    return None

def process_video_with_ai(video_url):
    """The actual Data Science / API pipeline"""
    try:
        # Step 1: Parse the URL
        print(f"🔗 Extracting Video ID from {video_url}...", flush=True)
        video_id = extract_video_id(video_url)
        if not video_id:
            return "Error: Could not extract a valid YouTube Video ID."

        # Step 2: Fetch the Transcript (The "Global Translation" Upgrade)
        print("🎧 Downloading and translating subtitle track...", flush=True)
        try:
            # THE FIX: Initialize the API first, then call .list()
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)
            try:
                transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB'])
            except NoTranscriptFound:
                for t in transcript_list:
                    transcript = t.translate('en')
                    break
            transcript_data = transcript.fetch()

        except TranscriptsDisabled:
            return "❌ AI Error: The creator of this video has disabled subtitles."
        except Exception as e:
            # We are now asking Python to print the EXACT system error to your screen
            return f"❌ AI Error Details: {str(e)}"

        # Combine snippets (Bulletproof: Handles both Dictionaries and Objects)
        try:
            transcript_text = " ".join([snippet['text'] for snippet in transcript_data])
        except TypeError:
            transcript_text = " ".join([snippet.text for snippet in transcript_data])
            
        transcript_text = transcript_text[:20000]

        # Step 3: Send to the LLM for Summarization
        print("📝 Generating summary using Llama-3 via Groq...", flush=True)
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an expert content summarizer. Provide a concise, bulleted summary of the provided video transcript. Focus on the core concepts and key takeaways."},
                {"role": "user", "content": f"Please summarize this video:\n\n{transcript_text}"}
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
        )
        return chat_completion.choices[0].message.content

    except Exception as e:
        return f"⚠️ Processing System Error: {str(e)}"

# 2. The Infinite Worker Loop
while True:
    try:
        queue_item = r.blpop('video_processing_queue', timeout=0)
        
        if queue_item:
            job_id = queue_item[1]
            print(f"\n🚀 Picked up new task: {job_id}", flush=True)
            
            job_data = r.hgetall(job_id)
            if not job_data:
                continue
                
            video_url = job_data.get('url')
            
            # Run the AI pipeline
            ai_result = process_video_with_ai(video_url)
            
            # Update Redis with the final result
            r.hset(job_id, mapping={
                'status': 'completed',
                'result': ai_result
            })
            
            print(f"✅ Finished task: {job_id}\n", flush=True)
            
    except Exception as e:
        print(f"❌ Worker Error: {e}", flush=True)
        time.sleep(5)