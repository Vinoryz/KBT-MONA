# MONA - Financial Planner & AI Chatbot Assistant

MONA adalah aplikasi perencana keuangan cerdas yang dilengkapi dengan fitur **OCR Scan Struk Belanja** dan **AI Chatbot Finansial** berbasis RAG (Retrieval-Augmented Generation) menggunakan Google Gemini API.

---

## 🛠️ Prasyarat (Prerequisites)

Pastikan komputer Anda sudah menginstal:
- **PHP** (versi `>= 8.2`) & **Composer**
- **Node.js** & **NPM**
- **Python** (versi `>= 3.10`)
- **MySQL Server** (seperti XAMPP atau Laragon di Windows)

---

## 🚀 Panduan Instalasi (Cloning dari Nol)

Ikuti langkah-langkah di bawah ini untuk menjalankan aplikasi secara lokal setelah men-clone repositori ini:

### 1. Konfigurasi Environment & Database Laravel
1. Duplikat file `.env.example` dan ubah namanya menjadi **`.env`**.
2. Buka file `.env`, lalu konfigurasikan:
   - **Database**: Sesuaikan `DB_DATABASE=mona`, `DB_USERNAME`, dan `DB_PASSWORD` dengan setelan MySQL lokal Anda.
   - **API Key**:
     ```env
     GEMINI_API_KEY="API_KEY_GEMINI_ANDA"
     RAG_API_URL="http://127.0.0.1:8001/api/rag-query"
     ```
     *(Dapatkan API Key Gemini gratis di [Google AI Studio](https://aistudio.google.com/)).*

### 2. Setup Laragon/MySQL
1. Jalankan MySQL di Laragon atau XAMPP Anda.
2. Buat database kosong bernama **`mona`**.

### 3. Instalasi Dependensi PHP & Frontend
Buka terminal di root folder proyek, lalu jalankan perintah berikut secara berurutan:
```bash
# Instal library Laravel/PHP
composer install

# Instal library React/Frontend
npm install

# Generate key aplikasi Laravel
php artisan key:generate

# Migrasi database dan isi data awal (seed)
php artisan migrate --seed
```

### 4. Setup Python RAG Service
Buka terminal baru, masuk ke folder `python_services`:
```bash
# Pindah ke folder python service
cd python_services

# Buat virtual environment
python -m venv venv

# Aktifkan virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Mac/Linux:
source venv/bin/activate

# Instal dependensi Python
pip install uvicorn fastapi chromadb python-dotenv

# Masukkan dokumen dasar finansial ke database Chroma lokal
python ingest.py
```

---

## 💻 Cara Menjalankan Aplikasi

Aplikasi berjalan di dua service utama (Laravel & Python). Jalankan keduanya secara bersamaan:

### Service 1: Laravel Web & Frontend Vite
Di terminal utama proyek (root), jalankan:
```bash
composer run dev
```
*(Website Anda sekarang dapat diakses di **`http://localhost:8000`**).*

### Service 2: Python FastAPI (RAG)
Di terminal folder `python_services` (dengan virtual environment aktif), jalankan:
```bash
uvicorn main:app --reload --port 8001
```

---

## 💡 Troubleshooting / Tips tambahan

* **Error Route Not Found (404/CSRF)**:
  Jika chatbot menampilkan error rute tidak ditemukan setelah pembaruan kode, jalankan perintah berikut di terminal Laravel Anda:
  ```bash
  php artisan optimize:clear
  ```
* **Database Vektor Lokal**:
  Database pengetahuan finansial disimpan secara lokal di folder `python_services/chroma_db/`. Jika ingin mereset pengetahuan chatbot, Anda bisa menghapus folder `chroma_db` tersebut dan menjalankan `python ingest.py` kembali.
