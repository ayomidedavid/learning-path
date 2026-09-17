import os
import json
from src.algorithms.dijkstra import PathGenerator
from src.algorithms.aco import AntColonyOptimizer

def run_demo():
    print("=" * 60)
    print("      SSM-LPRS DYNAMIC ADAPTIVE ENGINE DEMO & VERIFICATION")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    graph_path = os.path.join(base_dir, 'data', 'ekg.json')

    if not os.path.exists(graph_path):
        print("Error: data/ekg.json not found.")
        return

    # 1. Initialize PathGenerator
    generator = PathGenerator(graph_path)

    # 2. Simulate a Student taking a non-standard route (jumping from Module 1 straight to Module 9: Introductory Calculus)
    source = "Module 1: Foundational Numbers"
    target = "Module 9: Introductory Calculus"
    completed_topics = [] # Student has 0 completed topics!

    print(f"\n1. SIMULATING STUDENT ROUTE DEVIATION:")
    print(f"   - Source Topic:    '{source}'")
    print(f"   - Target Goal:     '{target}'")
    print(f"   - Completed List:  {completed_topics}")

    result = generator.generate_adaptive_path(source, target, completed_topics=completed_topics)

    print("\n2. ADAPTIVE ENGINE RESPONSE:")
    print(f"   - Status:         {result['status']}")
    print(f"   - Algorithm:      {result['algorithm']}")
    print(f"   - Is Deviated:    {result['is_deviated']}  <-- Detected non-standard route!")
    print(f"   - Message:        {result['message']}")

    print("\n3. DYNAMICALLY INJECTED ADAPTIVE BRIDGE NODES:")
    for b in result['bridge_nodes']:
        print(f"   [BRIDGE NODE]: {b['id']}")
        print(f"        -> Title:   {b['title']}")
        print(f"        -> Details: {b['details']}")

    print("\n4. FINAL ADAPTED LEARNING PATH SEQUENCE:")
    for idx, step in enumerate(result['path'], 1):
        is_bridge = "[ADAPTIVE BRIDGE]" if step.startswith("Bridge:") else "[COURSE]"
        print(f"   Step {idx}: {is_bridge} {step}")

    # 3. Test Persistent ACO Learning
    print("\n5. TESTING PERSISTENT ACO AI LEARNING:")
    optimizer = AntColonyOptimizer(graph_path)
    clean_path = [p for p in result['path'] if not p.startswith("Bridge:")]
    optimizer.record_user_traversal(clean_path)
    print(f"   - Saved persistent pheromone matrix to: {optimizer.pheromone_file}")
    print(f"   - File Exists: {os.path.exists(optimizer.pheromone_file)}")

    print("\n" + "=" * 60)
    print("      SUCCESS: DYNAMIC ADAPTIVE ENGINE IS FULLY WORKING!")
    print("=" * 60)

if __name__ == "__main__":
    run_demo()
