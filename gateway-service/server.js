const express = require('express');
const { createClient } = require('redis');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Redis Client
// In Docker, the host will be 'redis'. Locally, it defaults to localhost.
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error:', err));
redisClient.connect().then(() => console.log('Connected to Redis Successfully'));

// Health Check Endpoint (Recruiters love seeing these for infrastructure monitoring)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Gateway Service is healthy and running' });
});

// Endpoint: Receive video link and assign to AI Worker
app.post('/api/process-video', async (req, res) => {
    const { videoUrl } = req.body;

    if (!videoUrl) {
        return res.status(400).json({ error: 'videoUrl is required' });
    }

    // Generate a unique Job ID for tracking
    const jobId = `job_${Date.now()}`;

    try {
        // 1. Store the initial job state in the Redis database
        await redisClient.hSet(jobId, {
            status: 'processing',
            url: videoUrl,
            result: ''
        });

        // 2. Push the Job ID into a message queue. 
        // Service B (FastAPI) will be actively listening to this queue.
        await redisClient.lPush('video_processing_queue', jobId);

        // 3. Immediately respond to the client with the Ticket/Job ID.
        // Status 202 means "Accepted for processing, but not yet complete".
        res.status(202).json({ 
            message: 'Video added to the AI processing queue', 
            jobId: jobId 
        });

    } catch (error) {
        console.error('Queue Error:', error);
        res.status(500).json({ error: 'Failed to enqueue task' });
    }
});

// Endpoint: Frontend polls this to check if the AI is done
app.get('/api/status/:jobId', async (req, res) => {
    const { jobId } = req.params;

    try {
        // Fetch the current state of the job from Redis
        const jobData = await redisClient.hGetAll(jobId);
        
        if (Object.keys(jobData).length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.status(200).json(jobData);
    } catch (error) {
        console.error('Status Error:', error);
        res.status(500).json({ error: 'Failed to fetch job status' });
    }
});

app.listen(PORT, () => {
    console.log(`Gateway Service running on port ${PORT}`);
});