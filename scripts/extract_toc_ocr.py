import os
import fitz
import easyocr
import json
import numpy as np

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(base_dir, "data")
toc_dump_path = os.path.join(data_dir, "toc_ocr_dump.json")

pdf_map = {
    "SS1": "Copy of NEW GENERAL MATHEMATICS SS1 (PDF-MADEAZY BOOKSHOP).pdf",
    "SS2": "Copy of NEW GENERAL MATHEMATICS SS2 (PDF-MADEAZY BARR KOLAWOLE).pdf",
    "SS3": "Copy of NEW GENERAL MATHEMATICS SS3 (PDF-MADEAZY BARR. KOLAWOLE).pdf"
}

def scan_for_toc():
    print("Initializing EasyOCR...")
    reader = easyocr.Reader(['en'], gpu=False, verbose=False) # Use CPU if GPU not available
    
    ocr_results = {"SS1": {}, "SS2": {}, "SS3": {}}
    
    for grade, filename in pdf_map.items():
        pdf_path = os.path.join(base_dir, filename)
        if not os.path.exists(pdf_path):
            print(f"File not found: {pdf_path}")
            continue
            
        print(f"\nScanning {grade} for TOC (first 15 pages)...")
        doc = fitz.open(pdf_path)
        
        # Scan first 15 pages
        for page_num in range(min(15, len(doc))):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=150) # Moderate DPI for OCR
            
            # Convert pixmap to numpy array for easyocr
            img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
            # If image is RGBA, convert to RGB
            if pix.n == 4:
                img_array = img_array[:, :, :3]
                
            # Perform OCR
            result = reader.readtext(img_array, detail=0)
            page_text = "\n".join(result)
            ocr_results[grade][str(page_num)] = page_text
            
            if "content" in page_text.lower():
                print(f" -> Possible TOC found on page {page_num}")
                
    with open(toc_dump_path, 'w') as f:
        json.dump(ocr_results, f, indent=4)
    print(f"\nSaved OCR dump to {toc_dump_path}")

if __name__ == "__main__":
    scan_for_toc()
