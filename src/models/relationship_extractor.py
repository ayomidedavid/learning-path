import os
import pandas as pd
import numpy as np
from mlxtend.frequent_patterns import apriori, association_rules
from sklearn.metrics.pairwise import cosine_similarity
import json

def extract_prerequisites(df):
    print("Extracting Prerequisite Relations using Apriori and Expert Rules...")
    # Simulate transactions: Topics in the same grade or adjacent modules are often studied together
    # In a real system, this would be learner history logs
    transactions = []
    
    # Expert Rule: sequential order in syllabus implies strong prerequisite
    # Let's generate sliding window transactions to give Apriori co-occurrence data
    topics = df['raw_topic'].tolist()
    window_size = 3
    for i in range(len(topics) - window_size + 1):
        transactions.append(topics[i:i+window_size])
        
    # One-hot encode transactions for Apriori
    from mlxtend.preprocessing import TransactionEncoder
    te = TransactionEncoder()
    te_ary = te.fit(transactions).transform(transactions)
    df_trans = pd.DataFrame(te_ary, columns=te.columns_)
    
    # Run Apriori
    frequent_itemsets = apriori(df_trans, min_support=0.05, use_colnames=True)
    
    prerequisites = []
    if not frequent_itemsets.empty:
        rules = association_rules(frequent_itemsets, metric="confidence", min_threshold=0.5, num_itemsets=len(transactions))
        
        for _, row in rules.iterrows():
            antecedents = list(row['antecedents'])
            consequents = list(row['consequents'])
            if len(antecedents) == 1 and len(consequents) == 1:
                # P -> Q (Antecedent -> Consequent)
                prerequisites.append({
                    "source": antecedents[0],
                    "target": consequents[0],
                    "type": "PREREQUISITE",
                    "weight": row['confidence']
                })
    
    # Add expert manual rules (sequential order) to ensure connectivity
    for i in range(len(topics) - 1):
        prerequisites.append({
            "source": topics[i],
            "target": topics[i+1],
            "type": "PREREQUISITE",
            "weight": 0.9 # High confidence for explicit syllabus order
        })
        
    return prerequisites

def extract_similarities(embeddings_dict):
    print("Extracting Similarity Relations using Cosine Similarity...")
    topics = list(embeddings_dict.keys())
    vectors = list(embeddings_dict.values())
    
    # Calculate pairwise cosine similarity
    sim_matrix = cosine_similarity(vectors)
    
    similarities = []
    threshold = 0.85 # High threshold for similarity
    
    for i in range(len(topics)):
        for j in range(i + 1, len(topics)):
            score = sim_matrix[i][j]
            if score >= threshold:
                similarities.append({
                    "source": topics[i],
                    "target": topics[j],
                    "type": "SIMILAR",
                    "weight": float(score)
                })
                
    return similarities

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    processed_data_path = os.path.join(base_dir, 'data', 'processed_curriculum.csv')
    embeddings_path = os.path.join(base_dir, 'models', 'topic_embeddings.npy')
    
    if os.path.exists(processed_data_path) and os.path.exists(embeddings_path):
        df = pd.read_csv(processed_data_path)
        embeddings_dict = np.load(embeddings_path, allow_pickle=True).item()
        
        prereqs = extract_prerequisites(df)
        sims = extract_similarities(embeddings_dict)
        
        all_relations = prereqs + sims
        
        # Save relations to JSON
        output_path = os.path.join(base_dir, 'data', 'relationships.json')
        with open(output_path, 'w') as f:
            json.dump(all_relations, f, indent=4)
            
        print(f"Extracted {len(prereqs)} prerequisites and {len(sims)} similarities.")
        print(f"Saved to {output_path}")
    else:
        print("Data or embeddings not found. Please run concept_extractor.py first.")
