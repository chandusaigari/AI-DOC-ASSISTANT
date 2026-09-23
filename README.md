# KnowledgeAI — Document Intelligence & RAG Platform

KnowledgeAI is an enterprise-grade document intelligence platform featuring hybrid vector search (FAISS + Keyword matching), AI Assistant RAG queries, interactive practice panels (Objective MCQs and Viva Voice exams), and **Embedded Document Image Extraction**.

---

## 🖼️ Embedded Document Image Extraction

KnowledgeAI automatically extracts embedded diagrams, figures, charts, and images from uploaded PDF and Word (`.docx`) documents, serving them securely and displaying them alongside AI Assistant answers, vector search cards, and document preview modals.

### 1. Word (`.docx`) Image Extraction
- **Zero System Dependencies**: Uses `mammoth` natively in Node.js.
- Embedded images are automatically extracted and saved to `backend/uploads/images/<documentId>/`.

### 2. PDF Image Extraction (System Dependency & Graceful Fallback)
PDF image extraction uses `pdf-poppler` (which wraps the Poppler binaries `pdftocairo` / `pdfimages`).

#### 📦 Installation Instructions for Poppler:
- **Ubuntu / Debian Linux**:
  ```bash
  sudo apt-get update && sudo apt-get install -y poppler-utils
  ```
- **macOS**:
  ```bash
  brew install poppler
  ```
- **Windows**:
  - Install via Chocolatey:
    ```powershell
    choco install poppler
    ```
  - Or download Poppler for Windows binaries and add the `bin/` directory to your system `PATH`.

#### 🛡️ Graceful Fallback Behavior:
If Poppler is **not** installed on the deployment server:
- The upload pipeline handles it gracefully: it logs a clear warning (`[PDF Image Extractor Warning]: PDF image extraction skipped...`) and continues processing normally.
- Document text extraction, page chunking, FAISS vector indexing, and AI Assistant RAG queries will finish **100% successfully** without breaking document uploads.

---

## 🔒 Secure Image Serving
Documents and their extracted images are private per user.
- Images are served via `GET /api/documents/images/:imageId`.
- Ownership verification ensures users can only view images extracted from their own documents (or admin accounts).
- Physical image directories (`backend/uploads/images/`) are **never** exposed directly via static public middleware.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Create a `.env` file in the `backend/` directory:
```env
PORT=3000
JWT_SECRET=knowledgeai_super_secret_jwt_key_2026
GROK_API_KEY=your_grok_api_key_here
```

### 3. Start Backend Server
```bash
npm start
```
The server will initialize MySQL database tables cleanly and run on `http://localhost:3000`.
