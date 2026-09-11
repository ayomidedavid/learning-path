import os
import pandas as pd
import networkx as nx
import json
import matplotlib.pyplot as plt

class KnowledgeGraphManager:
    def __init__(self):
        self.G = nx.DiGraph()
        
    def build_graph(self, topics_df, relationships):
        """
        Builds the NetworkX directed graph from concepts and relationships.
        """
        # Add Nodes (Topics)
        for _, row in topics_df.iterrows():
            self.G.add_node(
                row['raw_topic'], 
                grade_level=row['grade_level'], 
                module_id=row['module_id']
            )
            
        # Add Edges (Relationships)
        for rel in relationships:
            source = rel['source']
            target = rel['target']
            rel_type = rel['type']
            weight = rel.get('weight', 1.0)
            
            # For networkx shortest path, distance is usually 1/weight (higher weight = shorter distance)
            # Or we define custom cost. Let's use cost = 1.0 - weight (if weight is a probability/similarity)
            # For Prerequisite, it's a directed edge.
            cost = max(0.1, 1.0 - weight) # Ensure cost is positive
            
            self.G.add_edge(source, target, relationship_type=rel_type, weight=weight, cost=cost)
            
        print(f"Graph built with {self.G.number_of_nodes()} nodes and {self.G.number_of_edges()} edges.")
        
    def save_graph(self, filepath):
        # Save as GraphML or JSON
        data = nx.node_link_data(self.G)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=4)
        print(f"Saved graph to {filepath}")
        
    def load_graph(self, filepath):
        with open(filepath, 'r') as f:
            data = json.load(f)
        self.G = nx.node_link_graph(data)
        print(f"Loaded graph with {self.G.number_of_nodes()} nodes.")
        
    def visualize(self, output_path):
        plt.figure(figsize=(15, 10))
        pos = nx.spring_layout(self.G, k=0.5, iterations=50)
        
        # Color nodes by grade level
        color_map = []
        for node in self.G.nodes():
            grade = self.G.nodes[node].get('grade_level', 'Unknown')
            if grade == 'SS1': color_map.append('lightblue')
            elif grade == 'SS2': color_map.append('lightgreen')
            elif grade == 'SS3': color_map.append('salmon')
            else: color_map.append('gray')
            
        nx.draw(self.G, pos, node_color=color_map, with_labels=True, 
                node_size=2000, font_size=8, font_weight='bold', edge_color='gray', arrows=True)
        
        plt.title("Educational Knowledge Graph (EKG)")
        plt.savefig(output_path)
        plt.close()
        print(f"Saved graph visualization to {output_path}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    topics_path = os.path.join(base_dir, 'data', 'processed_curriculum.csv')
    rels_path = os.path.join(base_dir, 'data', 'relationships.json')
    
    if os.path.exists(topics_path) and os.path.exists(rels_path):
        df = pd.read_csv(topics_path)
        with open(rels_path, 'r') as f:
            relationships = json.load(f)
            
        manager = KnowledgeGraphManager()
        manager.build_graph(df, relationships)
        
        # Save Graph
        graph_path = os.path.join(base_dir, 'data', 'ekg.json')
        manager.save_graph(graph_path)
        
        # Visualize
        viz_path = os.path.join(base_dir, 'data', 'ekg_visualization.png')
        manager.visualize(viz_path)
    else:
        print("Data files not found. Run previous pipeline steps.")
