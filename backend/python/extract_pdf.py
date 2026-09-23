import sys
import json
import os
import pypdf

def extract_pdf(file_path):
    if not os.path.exists(file_path):
        return {"success": False, "error": f"File not found: {file_path}"}
    
    try:
        reader = pypdf.PdfReader(file_path)
        pages_data = []
        full_text_list = []
        
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            text = text.strip()
            pages_data.append({
                "page": idx + 1,
                "text": text
            })
            if text:
                full_text_list.append(text)
                
        full_text = "\n\n".join(full_text_list)
        return {
            "success": True,
            "filename": os.path.basename(file_path),
            "total_pages": len(reader.pages),
            "pages": pages_data,
            "full_text": full_text
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
        
    path = sys.argv[1]
    result = extract_pdf(path)
    print(json.dumps(result, ensure_ascii=False))
