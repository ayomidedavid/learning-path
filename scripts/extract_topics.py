import os
import json
import shutil
import fitz  # PyMuPDF

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(base_dir, "data")
graph_path = os.path.join(data_dir, "ekg.json")
mapping_path = os.path.join(data_dir, "page_mapping.json")
extracted_dir = os.path.join(data_dir, "topics")

pdf_map = {
    "SS1": "Copy of NEW GENERAL MATHEMATICS SS1 (PDF-MADEAZY BOOKSHOP).pdf",
    "SS2": "Copy of NEW GENERAL MATHEMATICS SS2 (PDF-MADEAZY BARR KOLAWOLE).pdf",
    "SS3": "Copy of NEW GENERAL MATHEMATICS SS3 (PDF-MADEAZY BARR. KOLAWOLE).pdf"
}

def extract():
    if not os.path.exists(mapping_path):
        print(f"Error: Mapping file {mapping_path} not found.")
        print("Please run scripts/create_mapping_template.py and fill in the start/end pages.")
        return

    with open(mapping_path, 'r') as f:
        mapping = json.load(f)

    with open(graph_path, 'r') as f:
        graph = json.load(f)

    # Clean existing topics folder if you want, or just overwrite
    os.makedirs(extracted_dir, exist_ok=True)

    for grade, topics in mapping.items():
        pdf_filename = pdf_map.get(grade)
        if not pdf_filename:
            continue
            
        pdf_path = os.path.join(base_dir, pdf_filename)
        if not os.path.exists(pdf_path):
            print(f"Textbook not found: {pdf_path}")
            continue
            
        print(f"\nProcessing {grade} PDF...")
        
        # Open the source PDF only once per grade
        src_doc = fitz.open(pdf_path)
        total_pages = len(src_doc)
        
        for topic_id, pages in topics.items():
            start_page = pages.get("start_page")
            end_page = pages.get("end_page")
            
            # Create folder
            safe_topic = topic_id.replace(" ", "_").replace("/", "_")
            topic_folder = os.path.join(extracted_dir, grade, safe_topic)
            os.makedirs(topic_folder, exist_ok=True)
            out_pdf = os.path.join(topic_folder, "content.pdf")
            
            if start_page is None or end_page is None:
                print(f"  [SKIPPED] {topic_id} (Missing page numbers in mapping)")
                continue
                
            # Convert to 0-indexed page numbers (assuming mapping uses 1-indexed like standard readers)
            start_idx = start_page - 1
            end_idx = end_page - 1
            
            # Bounds checking
            if start_idx < 0: start_idx = 0
            if end_idx >= total_pages: end_idx = total_pages - 1
            
            if start_idx > end_idx:
                print(f"  [ERROR] {topic_id}: start_page ({start_page}) > end_page ({end_page})")
                continue
                
            # Create a new PDF and insert the specific pages
            dst_doc = fitz.open()
            dst_doc.insert_pdf(src_doc, from_page=start_idx, to_page=end_idx)
            dst_doc.save(out_pdf)
            dst_doc.close()
            
            print(f"  [EXTRACTED] {topic_id} (Pages {start_page} to {end_page}) -> {out_pdf}")

if __name__ == "__main__":
    extract()
