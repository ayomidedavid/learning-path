import os
import networkx as nx
import json
import random
import numpy as np

class AntColonyOptimizer:
    def __init__(self, graph_path, num_ants=20, max_iterations=50, alpha=1.0, beta=2.0, evaporation_rate=0.5):
        with open(graph_path, 'r') as f:
            data = json.load(f)
        self.G = nx.node_link_graph(data)
        
        self.num_ants = num_ants
        self.max_iterations = max_iterations
        self.alpha = alpha  # Importance of pheromone
        self.beta = beta    # Importance of heuristic (1/cost)
        self.evaporation_rate = evaporation_rate
        
        # Initialize pheromones
        for u, v in self.G.edges():
            self.G[u][v]['pheromone'] = 1.0
            
    def _heuristic(self, u, v):
        """Heuristic information is inverse of edge cost."""
        cost = self.G[u][v].get('cost', 1.0)
        return 1.0 / cost if cost > 0 else 1.0

    def _select_next_node(self, current_node, visited):
        neighbors = list(self.G.successors(current_node))
        unvisited_neighbors = [n for n in neighbors if n not in visited]
        
        if not unvisited_neighbors:
            return None
            
        probabilities = []
        for next_node in unvisited_neighbors:
            pheromone = self.G[current_node][next_node]['pheromone']
            heuristic = self._heuristic(current_node, next_node)
            prob = (pheromone ** self.alpha) * (heuristic ** self.beta)
            probabilities.append(prob)
            
        total_prob = sum(probabilities)
        if total_prob == 0:
            return random.choice(unvisited_neighbors)
            
        probabilities = [p / total_prob for p in probabilities]
        
        # Roulette wheel selection
        next_node = np.random.choice(unvisited_neighbors, p=probabilities)
        return next_node

    def _update_pheromones(self, all_paths):
        # Evaporation
        for u, v in self.G.edges():
            self.G[u][v]['pheromone'] *= (1 - self.evaporation_rate)
            
        # Deposit new pheromones based on path quality
        for path, cost in all_paths:
            if cost == 0: continue
            deposit_amount = 10.0 / cost # Reward shorter/better paths more
            
            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                self.G[u][v]['pheromone'] += deposit_amount

    def generate_aco_path(self, source, target):
        best_path = None
        best_cost = float('inf')
        
        for iteration in range(self.max_iterations):
            iteration_paths = []
            
            for ant in range(self.num_ants):
                current_node = source
                visited = [current_node]
                cost = 0
                
                while current_node != target:
                    next_node = self._select_next_node(current_node, visited)
                    if next_node is None:
                        break # Dead end
                        
                    cost += self.G[current_node][next_node].get('cost', 1.0)
                    visited.append(next_node)
                    current_node = next_node
                    
                if current_node == target:
                    iteration_paths.append((visited, cost))
                    if cost < best_cost:
                        best_cost = cost
                        best_path = visited
                        
            if iteration_paths:
                self._update_pheromones(iteration_paths)
                
        if best_path:
            return {
                "algorithm": "ACO",
                "path": best_path,
                "total_cost": best_cost,
                "status": "success"
            }
        else:
            return {
                "algorithm": "ACO",
                "path": [],
                "status": "error",
                "message": f"ACO could not find a path between '{source}' and '{target}'."
            }

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    graph_path = os.path.join(base_dir, 'data', 'ekg.json')
    
    if os.path.exists(graph_path):
        optimizer = AntColonyOptimizer(graph_path)
        source = "Number Base System"
        target = "Integration"
        result = optimizer.generate_aco_path(source, target)
        print(f"Personalized Path from '{source}' to '{target}':")
        print(json.dumps(result, indent=2))
    else:
        print("Graph data not found.")
