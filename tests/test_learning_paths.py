import json
import os

from src.algorithms.dijkstra import PathGenerator


def test_linear_path_returns_valid_prerequisite_sequence():
    graph_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'ekg.json')
    generator = PathGenerator(graph_path)

    result = generator.generate_linear_path('Module 1: Foundational Numbers', 'Module 9: Introductory Calculus')

    assert result['status'] == 'success'
    assert result['path'][0] == 'Module 1: Foundational Numbers'
    assert result['path'][-1] == 'Module 9: Introductory Calculus'
    assert len(result['path']) >= 3


def test_dynamic_path_prioritizes_remaining_steps():
    graph_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'ekg.json')
    generator = PathGenerator(graph_path)

    result = generator.generate_dynamic_path(
        'Module 1: Foundational Numbers',
        'Module 9: Introductory Calculus',
        completed_topics=['Module 1: Foundational Numbers', 'Module 3: Foundational Algebra']
    )

    assert result['status'] == 'success'
    assert 'Module 9: Introductory Calculus' in result['path']
    assert 'Module 3: Foundational Algebra' in result['path']
    assert result['path'][0] == 'Module 1: Foundational Numbers'
