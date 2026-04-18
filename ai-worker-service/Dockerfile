FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# The -u flag forces Python to print logs to the console immediately
CMD ["python", "-u", "worker.py"]