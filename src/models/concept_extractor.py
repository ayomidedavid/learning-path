import os
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from gensim.models import Word2Vec
from torch.utils.data import DataLoader, Dataset

class TextDataset(Dataset):
    def __init__(self, texts, labels, word2vec_model, max_len=10):
        self.texts = texts
        self.labels = labels
        self.word2vec_model = word2vec_model
        self.max_len = max_len
        self.vector_size = word2vec_model.vector_size
        
        # Create a label mapping
        self.unique_labels = list(set(labels))
        self.label_to_idx = {label: i for i, label in enumerate(self.unique_labels)}
        self.idx_to_label = {i: label for i, label in enumerate(self.unique_labels)}

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = self.texts[idx]
        label = self.labels[idx]
        
        words = text.split()
        vectors = []
        for w in words:
            if w in self.word2vec_model.wv:
                vectors.append(self.word2vec_model.wv[w])
            else:
                vectors.append(np.zeros(self.vector_size))
                
        # Pad or truncate
        if len(vectors) < self.max_len:
            padding = [np.zeros(self.vector_size)] * (self.max_len - len(vectors))
            vectors.extend(padding)
        else:
            vectors = vectors[:self.max_len]
            
        x = torch.tensor(np.array(vectors), dtype=torch.float32)
        y = torch.tensor(self.label_to_idx[label], dtype=torch.long)
        return x, y

class GRUClassifier(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim, num_layers=1):
        super(GRUClassifier, self).__init__()
        # GRU Layer
        self.gru = nn.GRU(input_dim, hidden_dim, num_layers, batch_first=True)
        # Prediction Layer (Linear -> Softmax is usually handled by CrossEntropyLoss in PyTorch)
        self.fc = nn.Linear(hidden_dim, output_dim)
        
    def forward(self, x):
        # x shape: (batch_size, seq_length, input_dim)
        out, h_n = self.gru(x)
        # Get the output from the last time step
        last_out = out[:, -1, :]
        logits = self.fc(last_out)
        return logits

def train_concept_extractor(data_path, detailed_syllabus_path=None):
    df = pd.read_csv(data_path)
    
    # 1. Embedding Layer: Word2Vec
    sentences = [text.split() for text in df['cleaned_topic'].tolist()]
    
    # Enrich Word2Vec vocabulary with detailed syllabus if available
    if detailed_syllabus_path and os.path.exists(detailed_syllabus_path):
        import re
        with open(detailed_syllabus_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip().lower()
                line = re.sub(r'[^\w\s]', '', line)
                line = re.sub(r'\s+', ' ', line).strip()
                if line:
                    sentences.append(line.split())
        print(f"Enriched Word2Vec with data from {detailed_syllabus_path}")

    w2v_model = Word2Vec(sentences, vector_size=50, window=5, min_count=1, workers=4)
    
    # Prepare Data
    dataset = TextDataset(df['cleaned_topic'].tolist(), df['grade_level'].tolist(), w2v_model)
    dataloader = DataLoader(dataset, batch_size=4, shuffle=True)
    
    # 2. Classification Layer: GRU
    input_dim = 50
    hidden_dim = 32
    output_dim = len(dataset.unique_labels)
    
    model = GRUClassifier(input_dim, hidden_dim, output_dim)
    
    # 3. Prediction Layer setup (Softmax implicit in CrossEntropyLoss)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.01)
    
    print("Training GRU Model for Concept Classification...")
    epochs = 20
    for epoch in range(epochs):
        total_loss = 0
        for x_batch, y_batch in dataloader:
            optimizer.zero_grad()
            logits = model(x_batch)
            loss = criterion(logits, y_batch)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        if (epoch + 1) % 5 == 0:
            print(f"Epoch {epoch+1}/{epochs}, Loss: {total_loss/len(dataloader):.4f}")
            
    print("Model training complete.")
    
    # Save the models
    os.makedirs('models', exist_ok=True)
    w2v_model.save('models/word2vec.model')
    torch.save(model.state_dict(), 'models/gru_model.pth')
    
    # Also save the topic embeddings for Similarity calculation later
    topic_embeddings = {}
    model.eval()
    with torch.no_grad():
        for i, row in df.iterrows():
            topic = row['cleaned_topic']
            # Get w2v representation
            words = topic.split()
            vecs = [w2v_model.wv[w] for w in words if w in w2v_model.wv]
            if vecs:
                topic_embeddings[row['raw_topic']] = np.mean(vecs, axis=0)
            else:
                topic_embeddings[row['raw_topic']] = np.zeros(50)
                
    np.save('models/topic_embeddings.npy', topic_embeddings)
    print("Saved Topic Embeddings.")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    processed_data_path = os.path.join(base_dir, 'data', 'processed_curriculum.csv')
    detailed_syllabus_path = os.path.join(base_dir, 'data', 'detailed_syllabus.txt')
    if os.path.exists(processed_data_path):
        train_concept_extractor(processed_data_path, detailed_syllabus_path)
    else:
        print("Processed data not found. Run data_pipeline.py first.")
