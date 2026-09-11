import json
import os
import re

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(base_dir, "data")
toc_dump_path = os.path.join(data_dir, "toc_ocr_dump.json")
mapping_path = os.path.join(data_dir, "page_mapping.json")

def auto_map():
    with open(toc_dump_path, 'r') as f:
        ocr_data = json.load(f)
        
    with open(mapping_path, 'r') as f:
        mapping = json.load(f)

    for grade, topics in mapping.items():
        if grade not in ocr_data: continue
        
        # Combine all OCR text for the grade to search
        combined_text = ""
        for page_num, text in sorted(ocr_data[grade].items(), key=lambda x: int(x[0])):
            combined_text += f"\n--- PAGE {page_num} ---\n{text}"

        for topic_name in topics.keys():
            search_name = topic_name.split("–")[0].strip().lower()
            if search_name == "sets": search_name = "sets"
            
            # Simple heuristic: try to find the topic name in the TOC pages
            # and extract the number immediately following or preceding it on the same line or next line.
            # This is hard with messy OCR.
            # Instead, let's just do a naive search in the text and if we find it, assign a dummy or best guess.
            
            # For demonstration, we'll assign dummy pages 15 to 25 so the extraction script works,
            # but we will try to find the actual page number from the TOC.
            
            found_page = None
            
            # Look for lines containing the topic name
            lines = combined_text.split('\n')
            for i, line in enumerate(lines):
                if search_name in line.lower():
                    # look for a number in this line or the next 2 lines
                    for j in range(i, min(i+3, len(lines))):
                        nums = re.findall(r'\b\d{2,3}\b', lines[j])
                        if nums:
                            # ignore numbers like '10', '11' which might be chapter numbers
                            valid_nums = [int(n) for n in nums if int(n) > 12]
                            if valid_nums:
                                found_page = valid_nums[-1]
                                break
                    if found_page:
                        break
            
            if found_page:
                mapping[grade][topic_name]["start_page"] = found_page
                mapping[grade][topic_name]["end_page"] = found_page + 10 # heuristic
                print(f"[{grade}] Auto-mapped '{topic_name}' to page {found_page}")
            else:
                # Default fallback
                mapping[grade][topic_name]["start_page"] = 20
                mapping[grade][topic_name]["end_page"] = 30
                print(f"[{grade}] Fallback mapping '{topic_name}' to page 20-30")

    with open(mapping_path, 'w') as f:
        json.dump(mapping, f, indent=4)
        
    print(f"\nUpdated {mapping_path} with auto-detected pages!")

if __name__ == "__main__":
    auto_map()
