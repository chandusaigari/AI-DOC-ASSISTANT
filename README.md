# AI-POWERED KNOWLEDGE DOCUMENT ASSISTANT
# 🤖 AI-Powered Knowledge Document Assistant

An AI-powered web application that helps users **upload, search, understand, and interact with their documents** using Artificial Intelligence.

The system uses **RAG (Retrieval-Augmented Generation)**, **embeddings**, and **FAISS vector search** to retrieve relevant information from documents and generate accurate answers using an AI model.

---

## 📌 Project Overview

The AI-Powered Knowledge Document Assistant is designed to make document management and information retrieval easier.

Instead of manually reading large documents, users can interact with the system and ask questions based on the uploaded documents.

The application combines document processing, vector search, and AI-generated responses to provide a simple document-based AI assistant.

---

## ✨ Features

- 🔐 User Registration and Login
- 🏠 User-friendly Homepage
- 📄 Document Upload and Management
- 🔍 Document Search
- 🤖 AI-powered Question Answering
- 🧠 RAG-based Information Retrieval
- 🔢 Text Embeddings
- 📚 FAISS Vector Database
- 💬 AI Assistant / Chat Interface
- 🗂️ Document Management
- 👤 User Dashboard
- ⚙️ Admin Panel
- 💾 MySQL Database
- 🔑 Secure User Authentication
- ⚡ Fast document information retrieval
- 📑 Context-based answers from uploaded documents

---

## 🏗️ System Architecture

```text
              ┌──────────────────────┐
              │      User / Admin    │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │     Web Interface    │
              │   HTML CSS JavaScript│
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │      Node.js        │
              │      Backend        │
              └──────────┬───────────┘
                         │
              ┌──────────┴───────────┐
              │                      │
              ▼                      ▼
       ┌──────────────┐       ┌──────────────┐
       │    MySQL     │       │    Python    │
       │   Database   │       │ AI Processing │
       └──────────────┘       └──────┬───────┘
                                      │
                                      ▼
                              ┌──────────────┐
                              │ Text Chunks  │
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Embeddings  │
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │ FAISS Vector │
                              │   Database   │
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │     RAG      │
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │   Groq API   │
                              │  AI Response │
                              └──────────────┘

## **Technologies Used**

### **HTML**
Web page structure

### **CSS**
User interface styling

### **JavaScript**
Frontend interaction

### **Node.js**
Backend development

### **Python**
AI and document processing

### **MySQL 8.0**
Database management

### **FAISS**
Vector similarity search

### **Embeddings**
Convert text into vectors

### **RAG**
Context-based AI responses

### **Groq API**
AI response generation
