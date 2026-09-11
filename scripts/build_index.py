import os
import fitz
import json

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(base_dir, "data")
graph_path = os.path.join(data_dir, "ekg.json")
index_path = os.path.join(data_dir, "page_index.json")

pdf_map = {
    "SS1": "Copy of NEW GENERAL MATHEMATICS SS1 (PDF-MADEAZY BOOKSHOP).pdf",
    "SS2": "Copy of NEW GENERAL MATHEMATICS SS2 (PDF-MADEAZY BARR KOLAWOLE).pdf",
    "SS3": "Copy of NEW GENERAL MATHEMATICS SS3 (PDF-MADEAZY BARR. KOLAWOLE).pdf"
}

def extract_topic_pages():
    with open(graph_path, 'r') as f:
        graph = json.load(f)

    topics_by_grade = {"SS1": [], "SS2": [], "SS3": []}
    for node in graph["nodes"]:
        topics_by_grade[node["grade_level"]].append(node["id"])

    page_index = {"SS1": {}, "SS2": {}, "SS3": {}}

    for grade, topics in topics_by_grade.items():
        pdf_filename = pdf_map.get(grade)
        if not pdf_filename:
            continue
            
        pdf_path = os.path.join(base_dir, pdf_filename)
        if not os.path.exists(pdf_path):
            print(f"File not found: {pdf_path}")
            continue
            
        print(f"\nProcessing {grade} PDF to build index...")
        doc = fitz.open(pdf_path)
        
        # Simple text search heuristic
        for topic in topics:
            search_str = topic.lower()
            # Clean up the topic string a bit for searching
            if " – " in search_str:
                search_str = search_str.split(" – ")[0]
            if ":" in search_str:
                search_str = search_str.split(":")[0]
                
            found = False
            for page_num in range(len(doc)):
                page_text = doc[page_num].get_text().lower()
                if search_str in page_text:
                    # Ignore matches in the first few pages (TOC usually)
                    if page_num > 10:
                        page_index[grade][topic] = page_num
                        found = True
                        print(f"Found '{topic}' on page {page_num}")
                        break
            if not found:
                print(f"Warning: Could not find '{topic}'")
                
    with open(index_path, 'w') as f:
        json.dump(page_index, f, indent=4)
    print("Saved page index to", index_path)

if __name__ == "__main__":
    extract_topic_pages()
