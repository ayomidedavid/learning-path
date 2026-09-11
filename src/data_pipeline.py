import os
import re
import pandas as pd

def clean_text(text):
    # Convert to lowercase
    text = text.lower()
    # Remove punctuation and special characters
    text = re.sub(r'[^\w\s]', '', text)
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_curriculum(file_path):
    dataset = []
    current_grade = None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if "General Mathematics Topics" in line:
            # Extract grade level (e.g. SS1, SS2)
            current_grade = line.split()[0].upper()
            continue
            
        if "Module" in line:
            # Extract the topic name after the colon
            parts = line.split(':')
            if len(parts) > 1:
                raw_topic = parts[1].strip()
                # Apply data pre-processing (Cleaning)
                cleaned_topic = clean_text(raw_topic)
                
                dataset.append({
                    "grade_level": current_grade,
                    "raw_topic": raw_topic,
                    "cleaned_topic": cleaned_topic,
                    "module_id": parts[0].strip()
                })
                
    return pd.DataFrame(dataset)

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    raw_data_path = os.path.join(base_dir, 'data', 'raw_curriculum.txt')
    processed_data_path = os.path.join(base_dir, 'data', 'processed_curriculum.csv')
    
    if os.path.exists(raw_data_path):
        df = parse_curriculum(raw_data_path)
        print("Curriculum parsed successfully.")
        print(df.head())
        
        # Save to processed data directory
        df.to_csv(processed_data_path, index=False)
        print(f"Saved processed dataset to {processed_data_path}")
    else:
        print(f"Error: {raw_data_path} not found.")
