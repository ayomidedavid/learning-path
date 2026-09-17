import os
import networkx as nx
import json

class PathGenerator:
    def __init__(self, graph_path):
        with open(graph_path, 'r') as f:
            data = json.load(f)
        if 'links' in data and 'edges' not in data:
            self.G = nx.node_link_graph(data, edges='links')
        else:
            self.G = nx.node_link_graph(data)

    def _calculate_total_cost(self, path):
        total_cost = 0
        for i in range(len(path) - 1):
            total_cost += self.G[path[i]][path[i + 1]].get('cost', 1.0)
        return total_cost

    def _resolve_start_node(self, source, completed_topics=None):
        completed_topics = set(completed_topics or [])
        if source not in completed_topics:
            return source

        unresolved = [node for node in self.G.nodes if node not in completed_topics]
        if unresolved:
            return unresolved[0]
        return source

    def _resolve_end_node(self, source, target=None):
        if target and target in self.G:
            return target

        distances = nx.single_source_shortest_path_length(self.G, source)
        if not distances:
            return source

        return max(distances, key=distances.get)

    def generate_linear_path(self, source, target=None):
        """
        Produces a fixed syllabus route starting from the student's selected topic.
        If the learner chooses a topic with no prerequisite, the path begins there
        and continues to the furthest connected learning goal in the curriculum.
        """
        target = self._resolve_end_node(source, target)
        try:
            path = nx.shortest_path(self.G, source=source, target=target, weight='cost')
            return {
                "algorithm": "Linear",
                "path": path,
                "total_cost": self._calculate_total_cost(path),
                "status": "success"
            }
        except nx.NetworkXNoPath:
            return {
                "algorithm": "Linear",
                "path": [],
                "status": "error",
                "message": f"No linear prerequisite path found between '{source}' and '{target}'."
            }
        except nx.NodeNotFound as e:
            return {
                "algorithm": "Linear",
                "path": [],
                "status": "error",
                "message": str(e)
            }

    def generate_dynamic_path(self, source, target=None, completed_topics=None):
        """
        Produces a personalized route from the chosen topic, skipping completed work.
        If the student starts at a topic without prerequisites, the path begins there
        and continues through the remaining curriculum.
        """
        completed_topics = set(completed_topics or [])

        if target is None or target == source:
            target = self._resolve_end_node(source)

        if target in completed_topics:
            return {
                "algorithm": "Dynamic",
                "path": [target],
                "total_cost": 0,
                "status": "success",
                "message": "Topic already completed."
            }

        try:
            source = self._resolve_start_node(source, completed_topics)
            active_nodes = [node for node in self.G.nodes if node not in completed_topics or node in {source, target}]
            active_graph = self.G.subgraph(active_nodes).copy()

            if source not in active_graph or target not in active_graph:
                raise nx.NodeNotFound(f"Dynamic path could not be built for '{source}' to '{target}'.")

            path = nx.shortest_path(active_graph, source=source, target=target, weight='cost')
            return {
                "algorithm": "Dynamic",
                "path": path,
                "total_cost": self._calculate_total_cost(path),
                "status": "success"
            }
        except nx.NetworkXNoPath:
            return {
                "algorithm": "Dynamic",
                "path": [],
                "status": "error",
                "message": f"No dynamic path found between '{source}' and '{target}' after filtering completed topics."
            }
        except nx.NodeNotFound as e:
            return {
                "algorithm": "Dynamic",
                "path": [],
                "status": "error",
                "message": str(e)
            }

    def generate_dijkstra_path(self, source, target):
        """
        Generates the shortest learning path using Dijkstra's algorithm.
        Considers edge 'cost' which represents pedagogical distance/difficulty.
        """
        try:
            path = nx.shortest_path(self.G, source=source, target=target, weight='cost')
            return {
                "algorithm": "Dijkstra",
                "path": path,
                "total_cost": self._calculate_total_cost(path),
                "status": "success"
            }
        except nx.NetworkXNoPath:
            return {
                "algorithm": "Dijkstra",
                "path": [],
                "status": "error",
                "message": f"No feasible path found between '{source}' and '{target}'."
            }
        except nx.NodeNotFound as e:
            return {
                "algorithm": "Dijkstra",
                "path": [],
                "status": "error",
                "message": str(e)
            }

    def generate_adaptive_path(self, source, target, completed_topics=None):
        """
        Produces a dynamic, self-adapting path. Detects if student deviates from the standard
        route or skips prerequisites, and dynamically injects adaptive bridge nodes to repair learning gaps.
        """
        completed_topics = set(completed_topics or [])

        # Step 1: Compute standard dynamic path
        base_result = self.generate_dynamic_path(source, target, completed_topics)
        if base_result.get("status") == "error":
            # If graph has no direct path, build direct bridge path
            base_path = [source, target] if source in self.G and target in self.G else []
        else:
            base_path = base_result.get("path", [])

        if not base_path:
            return base_result

        # Step 2: Perform Prerequisite Gap Analysis for target
        # Reverse traversal to find all required ancestors for target
        parents = {}
        for u, v in self.G.edges():
            if v not in parents:
                parents[v] = []
            parents[v].append(u)

        missing_prereqs = []
        stack = [target]
        visited = set()
        while stack:
            curr = stack.pop()
            if curr in visited:
                continue
            visited.add(curr)
            for p in parents.get(curr, []):
                if p not in completed_topics and p != source and p not in base_path:
                    missing_prereqs.append(p)
                if p not in visited:
                    stack.append(p)

        is_deviated = len(missing_prereqs) > 0
        bridge_nodes = []
        adaptive_path = list(base_path)

        if is_deviated:
            # Step 3: Inject Adaptive Bridge Nodes before target
            target_idx = adaptive_path.index(target) if target in adaptive_path else len(adaptive_path)
            for p in missing_prereqs:
                bridge_id = f"Bridge: Prereq Gap ({p})"
                bridge_nodes.append({
                    "id": bridge_id,
                    "target_topic": target,
                    "prereq_topic": p,
                    "title": f"Adaptive Bridge: {p}",
                    "details": f"Dynamically injected remedial topic covering '{p}' to prepare you for '{target}'.",
                    "is_bridge": True
                })
                # Insert bridge node into active path sequence right before target
                adaptive_path.insert(target_idx, bridge_id)
                target_idx += 1

        return {
            "algorithm": "Adaptive",
            "path": adaptive_path,
            "base_path": base_path,
            "is_deviated": is_deviated,
            "bridge_nodes": bridge_nodes,
            "total_cost": self._calculate_total_cost([p for p in adaptive_path if not p.startswith("Bridge:")]),
            "status": "success",
            "message": "Custom adaptive path generated with prerequisite gap repair." if is_deviated else "Standard dynamic route on track."
        }

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    graph_path = os.path.join(base_dir, 'data', 'ekg.json')

    if os.path.exists(graph_path):
        generator = PathGenerator(graph_path)
        source = "Module 1: Foundational Numbers"
        target = "Module 9: Introductory Calculus"

        linear = generator.generate_linear_path(source, target)
        dynamic = generator.generate_dynamic_path(source, target, completed_topics=['Module 1: Foundational Numbers'])

        print(f"Linear path from '{source}' to '{target}':")
        print(json.dumps(linear, indent=2))
        print(f"Dynamic path from '{source}' to '{target}':")
        print(json.dumps(dynamic, indent=2))
    else:
        print("Graph data not found.")
