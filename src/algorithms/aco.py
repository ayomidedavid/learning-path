import os
import networkx as nx
import json
import random
import numpy as np

class AntColonyOptimizer:
    def __init__(self, graph_path, num_ants=20, max_iterations=50, alpha=1.0, beta=2.0, evaporation_rate=0.5):
        with open(graph_path, 'r') as f:
            data = json.load(f)
        if 'links' in data and 'edges' not in data:
            self.G = nx.node_link_graph(data, edges='links')
        else:
            self.G = nx.node_link_graph(data)
        self.graph_path = graph_path
        self.pheromone_file = os.path.join(os.path.dirname(graph_path), 'pheromones.json')
        
        self.num_ants = num_ants
        self.max_iterations = max_iterations
        self.alpha = alpha  # Importance of pheromone
        self.beta = beta    # Importance of heuristic (1/cost)
        self.evaporation_rate = evaporation_rate
        
        # Initialize default pheromones
        for u, v in self.G.edges():
            self._set_edge_attr(u, v, 'pheromone', 1.0)

        # Load persistent pheromones if file exists
        self._load_pheromones()

    def _get_edge_attr(self, u, v, attr, default=1.0):
        if self.G.has_edge(u, v):
            data = self.G[u][v]
            if attr in data:
                return data[attr]
            for key in data:
                if isinstance(data[key], dict) and attr in data[key]:
                    return data[key][attr]
        return default

    def _set_edge_attr(self, u, v, attr, value):
        if self.G.has_edge(u, v):
            data = self.G[u][v]
            if attr in data or not any(isinstance(val, dict) for val in data.values()):
                data[attr] = value
                return
            for key in data:
                if isinstance(data[key], dict):
                    data[key][attr] = value

    def _load_pheromones(self):
        if os.path.exists(self.pheromone_file):
            try:
                with open(self.pheromone_file, 'r') as f:
                    data = json.load(f)
                for edge_key, val in data.items():
                    parts = edge_key.split('->')
                    if len(parts) == 2:
                        u, v = parts[0], parts[1]
                        if self.G.has_edge(u, v):
                            self._set_edge_attr(u, v, 'pheromone', float(val))
            except Exception as e:
                print(f"Warning: Could not load pheromones: {e}")

    def save_pheromones(self):
        try:
            data = {}
            for u, v in self.G.edges():
                data[f"{u}->{v}"] = float(self._get_edge_attr(u, v, 'pheromone', 1.0))
            with open(self.pheromone_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save pheromones: {e}")

    def record_user_traversal(self, path, reward_multiplier=2.0):
        """
        Record a successful user route choice and deposit persistent AI pheromones.
        Boosts paths taken by students taking non-standard or adaptive routes.
        """
        if not path or len(path) < 2:
            return

        for i in range(len(path) - 1):
            u, v = path[i], path[i+1]
            if self.G.has_edge(u, v):
                current = self._get_edge_attr(u, v, 'pheromone', 1.0)
                self._set_edge_attr(u, v, 'pheromone', current + (1.5 * reward_multiplier))

        self.save_pheromones()

    def _heuristic(self, u, v):
        """Heuristic information is inverse of edge cost."""
        cost = self._get_edge_attr(u, v, 'cost', 1.0)
        return 1.0 / cost if cost > 0 else 1.0

    def _select_next_node(self, current_node, visited):
        neighbors = list(self.G.successors(current_node))
        unvisited_neighbors = [n for n in neighbors if n not in visited]
        
        if not unvisited_neighbors:
            return None
            
        probabilities = []
        for next_node in unvisited_neighbors:
            pheromone = self._get_edge_attr(current_node, next_node, 'pheromone', 1.0)
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
            current = self._get_edge_attr(u, v, 'pheromone', 1.0)
            self._set_edge_attr(u, v, 'pheromone', current * (1 - self.evaporation_rate))
            
        # Deposit new pheromones based on path quality
        for path, cost in all_paths:
            if cost == 0: continue
            deposit_amount = 10.0 / cost # Reward shorter/better paths more
            
            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                if self.G.has_edge(u, v):
                    current = self._get_edge_attr(u, v, 'pheromone', 1.0)
                    self._set_edge_attr(u, v, 'pheromone', current + deposit_amount)

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

        # Save persistent pheromone matrix after optimization run
        self.save_pheromones()
                
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
