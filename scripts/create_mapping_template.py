import json
import os

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(base_dir, "data")
graph_path = os.path.join(data_dir, "ekg.json")
mapping_path = os.path.join(data_dir, "page_mapping.json")

def create_template():
    with open(graph_path, 'r') as f:
        graph = json.load(f)

    # Group topics by grade
    mapping = {"SS1": {}, "SS2": {}, "SS3": {}}
    for node in graph["nodes"]:
        grade = node["grade_level"]
        topic_id = node["id"]
        # Add a placeholder for start and end pages
        mapping[grade][topic_id] = {"start_page": None, "end_page": None}

    with open(mapping_path, 'w') as f:
        json.dump(mapping, f, indent=4)
        
    print(f"Created template at {mapping_path}")

if __name__ == "__main__":
    create_template()
