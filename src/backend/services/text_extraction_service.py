import os
import logging
from typing import Optional
import pypdf
import docx

logger = logging.getLogger(__name__)

class TextExtractionService:
    @staticmethod
    def extract_text(file_path: str) -> Optional[str]:
        """
        Extracts text from a file based on its extension.
        Supports: .txt, .md, .pdf, .docx
        """
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            return None

        ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if ext in ['.txt', '.md', '.py', '.js', '.ts', '.tsx', '.json', '.sql']:
                return TextExtractionService._read_text_file(file_path)
            elif ext == '.pdf':
                return TextExtractionService._read_pdf(file_path)
            elif ext == '.docx':
                return TextExtractionService._read_docx(file_path)
            else:
                logger.warning(f"Unsupported file extension for text extraction: {ext}")
                return None
        except Exception as e:
            logger.error(f"Failed to extract text from {file_path}: {e}")
            return None

    @staticmethod
    def _read_text_file(file_path: str) -> str:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

    @staticmethod
    def _read_pdf(file_path: str) -> str:
        text = ""
        with open(file_path, 'rb') as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text

    @staticmethod
    def _read_docx(file_path: str) -> str:
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])
