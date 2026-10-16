FROM docker.io/library/python:3.12-slim

ENV HOST=0.0.0.0 \
    PORT=5000 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./

EXPOSE 5000
CMD ["python", "app.py"]