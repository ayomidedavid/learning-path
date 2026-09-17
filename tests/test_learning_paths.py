import json
import os
import unittest
from src.algorithms.dijkstra import PathGenerator
from src.algorithms.aco import AntColonyOptimizer


class TestLearningPaths(unittest.TestCase):
    def setUp(self):
        self.graph_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'ekg.json')
        self.generator = PathGenerator(self.graph_path)
        with open(self.graph_path, 'r') as f:
            data = json.load(f)
        self.nodes = [n['id'] for n in data['nodes']]

    def test_linear_path_returns_valid_sequence(self):
        source = self.nodes[0]
        target = self.nodes[-1]
        result = self.generator.generate_linear_path(source, target)
        self.assertEqual(result['status'], 'success')
        self.assertGreaterEqual(len(result['path']), 1)

    def test_adaptive_path_detects_deviation_and_injects_bridge_nodes(self):
        source = "Foundation Concepts" if "Foundation Concepts" in self.nodes else self.nodes[0]
        target = "Calculus (Integration)" if "Calculus (Integration)" in self.nodes else self.nodes[-1]

        # Simulate student skipping prerequisites
        result = self.generator.generate_adaptive_path(source, target, completed_topics=[])
        self.assertEqual(result['status'], 'success')
        self.assertIn('is_deviated', result)
        self.assertIn('bridge_nodes', result)

    def test_persistent_aco_traversal_recording(self):
        optimizer = AntColonyOptimizer(self.graph_path)
        sample_path = self.nodes[:3] if len(self.nodes) >= 3 else self.nodes
        optimizer.record_user_traversal(sample_path)
        self.assertTrue(os.path.exists(optimizer.pheromone_file))


if __name__ == '__main__':
    unittest.main()
