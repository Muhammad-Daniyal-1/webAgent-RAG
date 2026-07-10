from pypdf import PdfReader
from pathlib import Path

def load_document(file_path: str) -> str:
    path = Path(file_path)
    
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    
    elif path.suffix.lower() == ".txt":
        return path.read_text(encoding="utf-8")
    
    else:
        raise ValueError(f"Unsupported file type: {path.suffix}")