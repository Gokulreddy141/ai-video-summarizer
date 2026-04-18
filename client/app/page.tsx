'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [videoUrl, setVideoUrl] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle'); // idle, processing, completed
  const [result, setResult] = useState<string>('');

  // This function sends the video to the Node.js Gateway
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) return;

    setStatus('processing');
    setResult('');

    try {
      const response = await fetch('http://localhost:3001/api/process-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      });

      const data = await response.json();
      if (data.jobId) {
        setJobId(data.jobId); // Save the Ticket ID
      }
    } catch (error) {
      console.error('Error submitting video:', error);
      setStatus('idle');
    }
  };

  // This hook "polls" the backend every 2 seconds if a job is processing
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      if (!jobId) return;

      try {
        const response = await fetch(`http://localhost:3001/api/status/${jobId}`);
        const data = await response.json();

        if (data.status === 'completed') {
          setStatus('completed');
          setResult(data.result);
          setJobId(null); // Stop polling
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };

    if (jobId && status === 'processing') {
      intervalId = setInterval(checkStatus, 2000); // Ask every 2 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, status]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-24 bg-gray-50 text-gray-900">
      <div className="max-w-2xl w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-3xl font-bold mb-2 text-center text-blue-600">AI Video Summarizer</h1>
        <p className="text-gray-500 text-center mb-8">Powered by Next.js, Node, Python, & Redis</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="url"
            placeholder="Paste YouTube Link Here..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            required
          />
          <button
            type="submit"
            disabled={status === 'processing'}
            className="w-full bg-blue-600 text-white p-4 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition-all"
          >
            {status === 'processing' ? 'AI is Processing...' : 'Summarize Video'}
          </button>
        </form>

        {/* Status Indicator */}
        {status === 'processing' && (
          <div className="mt-8 p-6 bg-blue-50 text-blue-800 rounded-lg flex flex-col items-center border border-blue-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-800 mb-4"></div>
            <p className="font-semibold">Your video is in the queue.</p>
            <p className="text-sm mt-2 opacity-80">The Python AI worker is transcribing and summarizing...</p>
          </div>
        )}

        {/* Final Result - Dynamic Styling based on Success/Error */}
        {status === 'completed' && (
          <div className={`mt-8 p-6 rounded-lg border ${
            result.startsWith('❌') || result.startsWith('⚠️') 
              ? 'bg-red-50 text-red-900 border-red-200' 
              : 'bg-green-50 text-green-900 border-green-200'
          }`}>
            <h3 className="font-bold text-lg mb-2 flex items-center">
              {result.startsWith('❌') || result.startsWith('⚠️') ? (
                <><span className="mr-2">🚨</span> Processing Error</>
              ) : (
                <><span className="mr-2">✅</span> Summary Complete</>
              )}
            </h3>
            <p className="leading-relaxed whitespace-pre-wrap">{result}</p>
          </div>
        )}
      </div>
    </main>
  );
}