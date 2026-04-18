#  AI Video Summarizer (Microservices Architecture)

An enterprise-grade, asynchronous full-stack application that takes any YouTube video URL, bypasses subtitle restrictions to extract the transcript, and generates a concise, bulleted summary using Meta's **Llama 3.1** Large Language Model. 

This project demonstrates a highly scalable, event-driven microservices architecture containerized with Docker.

##  System Architecture

The application is split into distinct, decoupled services that communicate asynchronously:

1. **Client (Frontend):** Takes the user input and submits it to the Gateway. It then actively polls the Gateway for the job status.
2. **API Gateway (Backend):** Receives the request, generates a unique `Job ID`, and pushes the task into a Redis message queue. It instantly returns the Job ID to the client so the UI doesn't freeze.
3. **Message Broker (Redis):** Holds the queue of jobs and stores the final AI results.
4. **AI Worker (Python):** Continuously listens to the Redis queue. When a job appears, it pops it, executes the complex data extraction and AI processing, and saves the final summary back to Redis.

##  Tech Stack

* **Frontend:** Next.js, React, Tailwind CSS
* **API Gateway:** Node.js, Express.js
* **Message Queue & Cache:** Redis
* **AI Worker:** Python (FastAPI / Standard Library)
* **LLM Integration:** Groq Cloud API (Model: `llama-3.1-8b-instant`)
* **Infrastructure:** Docker & Docker Compose

## 📁 Project Structure & File Explanations

### `/client` (The Next.js Frontend)
* `app/page.tsx`: The main user interface. It handles submitting the YouTube URL, initiating the polling mechanism to check the job status, and displaying the success/error states to the user.

### `/gateway-service` (The Traffic Controller)
* `server.js`: An Express server running on port 3001. It has two main jobs:
  * `POST /api/process-video`: Accepts the URL, creates a job ticket, pushes it to Redis, and responds immediately (HTTP 202 Accepted).
  * `GET /api/status/:jobId`: Allows the frontend to check if the Python worker has finished processing the specific job.

### `/ai-worker-service` (The Brains)
* `worker.py`: An infinite loop script that pops jobs from Redis. It handles:
  * Extracting the Video ID from various YouTube URL formats.
  * Utilizing `youtube-transcript-api` to bypass YouTube restrictions and download subtitle objects.
  * Truncating transcripts to ~20,000 characters to safely manage LLM Token-Per-Minute (TPM) limits.
  * Prompting the Groq API (Llama 3.1) to generate the summary and returning it to the database.
* `requirements.txt`: Defines the Python dependencies (`redis`, `youtube-transcript-api`, `groq`).
* `Dockerfile`: Containerizes the Python script and forces the console outputs to flush instantly for real-time Docker logging.

### Root Infrastructure
* `docker-compose.yml`: The orchestrator file. It defines the four containers (`gateway`, `worker`, `redis`, and the frontend) and links them together on a shared virtual network so they can communicate seamlessly.
* `.env`: Stores secret environment variables (like the `GROQ_API_KEY`) securely.

##  Key Features & Technical Challenges Solved

* **Asynchronous Processing:** Prevented HTTP timeout errors on long video processing by implementing a Job ID polling system rather than making the user wait for a synchronous response.
* **Token Rate Limiting:** Built programmatic truncation to prevent massive 2-hour podcast transcripts from crashing the LLM's context window.
* **Robust Object Parsing:** Handled API updates gracefully by writing fallback logic to parse both legacy JSON dictionaries and modern Python objects from the transcript library.
* **Cache Busting & Containerization:** Successfully managed immutable Docker layers and forced cache-busting to ensure live code updates propagated properly across the microservices network.

##  How to Run Locally

**Prerequisites:** You must have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

1. Clone the repository:
   ```bash
   git clone [https://github.com/YOUR-USERNAME/ai-video-summarizer.git](https://github.com/YOUR-USERNAME/ai-video-summarizer.git)
   cd ai-video-summarizer
