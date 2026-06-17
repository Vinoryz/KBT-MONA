FROM python:3.11-slim

WORKDIR /app

# Install dependensi sistem yang dibutuhkan untuk kompilasi C++ (jika ada dependency yang butuh build dari source)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Salin file requirements.txt
COPY requirements.txt .

# Edit requirements.txt otomatis untuk menghapus versi onnxruntime jika menyebabkan error
RUN sed -i 's/onnxruntime==1.23.2/onnxruntime/g' requirements.txt || true

# Instal dependensi Python
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir uvicorn fastapi chromadb python-dotenv

# Salin sisa file Python service
COPY . .

# Expose port untuk FastAPI
EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
