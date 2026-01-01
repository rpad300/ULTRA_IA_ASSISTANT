import os
import logging
from typing import Optional, List, Dict, Any, Union
import pypdf
import docx

# SOTA Dependencies
try:
    import fitz # PyMuPDF
except ImportError:
    fitz = None

try:
    import pandas as pd
except ImportError:
    pd = None

logger = logging.getLogger(__name__)

class TextExtractionService:
    @staticmethod
    def extract_text(file_path: str) -> Optional[str]:
        """
        Legacy simple extraction (returns just text).
        Delegates to structured extraction and joins content.
        """
        structured = TextExtractionService.extract_text_with_metadata(file_path)
        if not structured:
            return None
        return "\n\n".join([page['content'] for page in structured])

    @staticmethod
    def extract_text_with_metadata(file_path: str) -> List[Dict[str, Any]]:
        """
        SOTA Extraction: Returns list of pages/chunks with metadata.
        Output format: [{'page_label': '1', 'content': '...'}, ...]
        """
        if not os.path.exists(file_path):
            logger.error(f"File not found: {file_path}")
            return []

        ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if ext in ['.txt', '.md', '.py', '.js', '.ts', '.tsx', '.json', '.sql']:
                content = TextExtractionService._read_text_file(file_path)
                return [{"page_label": "1", "content": content}]
            elif ext == '.pdf':
                return TextExtractionService._read_pdf_sota(file_path)
            elif ext == '.docx':
                content = TextExtractionService._read_docx(file_path)
                return [{"page_label": "1", "content": content}] # Docx pagination is hard without rendering
            elif ext in ['.csv', '.xlsx', '.xls']:
                return TextExtractionService._read_tabular_data(file_path)
            else:
                logger.warning(f"Unsupported file extension for text extraction: {ext}")
                return []
        except Exception as e:
            logger.error(f"Failed to extract text from {file_path}: {e}")
            return []

    @staticmethod
    def _read_text_file(file_path: str) -> str:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

    @staticmethod
    def _read_pdf_sota(file_path: str) -> List[Dict[str, Any]]:
        """
        Uses PyMuPDF (fitz) for layout-aware extraction.
        Captures Headers (H1, H2) and Tables.
        """
        pages_content = []
        
        # Fallback to pypdf if fitz not installed
        if not fitz:
            logger.warning("PyMuPDF (fitz) not installed. Falling back to pypdf.")
            return TextExtractionService._read_pdf_legacy(file_path)

        try:
            doc = fitz.open(file_path)
            total_text_len = 0
            
            for i, page in enumerate(doc):
                # SOTA: Structure Analysis
                # We extract blocks to detect headers based on font size/flags
                blocks = page.get_text("dict")["blocks"]
                page_text = ""
                file_metadata = {"headers": []}

                for b in blocks:
                    if b["type"] == 0:  # Text block
                        for line in b["lines"]:
                            for span in line["spans"]:
                                text_segment = span["text"].strip()
                                if not text_segment: continue
                                
                                # Heuristic for Headers: Font size > 11 or Bold flags
                                # flags: 4 is bold (usually, depends on font)
                                is_header = False
                                if span["size"] > 14: # H1 roughly
                                     file_metadata["headers"].append({"type": "H1", "text": text_segment})
                                     is_header = True
                                elif span["size"] > 12 or (span["flags"] & 4): # H2 or Bold
                                     file_metadata["headers"].append({"type": "H2", "text": text_segment})
                                     is_header = True
                                
                                # Append text generally
                                if is_header:
                                    page_text += f"\n# {text_segment}\n"
                                else:
                                    page_text += f" {text_segment}"
                            page_text += "\n"
                
                # SOTA: Table Detection (Basic)
                # find_tables is available in newer PyMuPDF
                if hasattr(page, "find_tables"):
                    tables = page.find_tables()
                    if tables.tables:
                        page_text += "\n\n[DETECTED TABLES]\n"
                        for tab in tables:
                            page_text += pd.DataFrame(tab.extract()).to_markdown() + "\n\n" if pd else str(tab.extract()) + "\n"

                # Metadata
                pages_content.append({
                    "page_label": str(i + 1),
                    "content": page_text.strip(),
                    "structure": file_metadata
                })
                total_text_len += len(page_text)
            
            # OCR Fallback Detection (Heuristic)
            if len(doc) > 0 and (total_text_len / len(doc)) < 50:
                 logger.warning(f"PDF {os.path.basename(file_path)} seems to be a scan (low text count). OCR required.")
                 pages_content.append({
                     "page_label": "SYSTEM_WARNING",
                     "content": "[WARNING] This document appears to be a scanned image. Text extraction may be incomplete."
                 })
            
            doc.close()
            return pages_content
        except Exception as e:
            logger.error(f"PyMuPDF failed: {e}. Falling back to pypdf.")
            return TextExtractionService._read_pdf_legacy(file_path)

    @staticmethod
    def _read_pdf_legacy(file_path: str) -> List[Dict[str, Any]]:
        """Fallback using pypdf."""
        pages_content = []
        try:
            with open(file_path, 'rb') as f:
                reader = pypdf.PdfReader(f)
                for i, page in enumerate(reader.pages):
                     pages_content.append({
                        "page_label": str(i + 1),
                        "content": page.extract_text() or ""
                    })
        except Exception as e:
             logger.error(f"pypdf fallback failed: {e}")
        return pages_content

    @staticmethod
    def _read_docx(file_path: str) -> str:
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])

    @staticmethod
    def _read_tabular_data(file_path: str) -> List[Dict[str, Any]]:
        """Reads CSV/Excel using Pandas."""
        if not pd:
            logger.warning("Pandas not installed. Cannot read tabular data.")
            return []
        
        try:
            # Read all sheets if excel
            if file_path.endswith(('.xlsx', '.xls')):
                dfs = pd.read_excel(file_path, sheet_name=None) # Returns dict of dfs
                output = []
                for sheet_name, df in dfs.items():
                    text = df.to_string(index=False)
                    output.append({
                        "page_label": f"Sheet: {sheet_name}",
                        "content": text
                    })
                return output
            else:
                 # CSV
                 df = pd.read_csv(file_path)
                 return [{
                     "page_label": "CSV",
                     "content": df.to_string(index=False)
                 }]
        except Exception as e:
            logger.error(f"Pandas read failed: {e}")
            return []
