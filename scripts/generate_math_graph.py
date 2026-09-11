import json
import os

def generate_graph():
    # Nodes based EXACTLY on the user's provided Concept Map image
    nodes = [
        {"id": "Foundation Concepts", "grade_level": "Basic", "details": "Arithmetic, Number Systems, Sets, Logic"},
        {"id": "Algebra 1", "grade_level": "SS1", "details": "Linear Equations, Graphs, Indices, Simplification"},
        {"id": "Geometry 1", "grade_level": "SS1", "details": "Lines, Angles, Triangles, Polygons, Congruence"},
        {"id": "Functions & Relations", "grade_level": "SS1", "details": ""},
        {"id": "Algebra 2", "grade_level": "SS2", "details": "Quadratic Functions, Polynomials, Inequalities, Matrices"},
        {"id": "Geometry 2", "grade_level": "SS2", "details": "Circles, Similarity, Quadrilaterals, Coordinate Geometry"},
        {"id": "Trigonometry", "grade_level": "SS2", "details": "Right-Angle Triags, Sine/Cosine Rule, Identities, Unit Circle, Graphs"},
        {"id": "Vectors", "grade_level": "SS3", "details": "2D & 3D, Dot/Cross Product, Applications"},
        {"id": "Sequences & Series", "grade_level": "SS2", "details": "Arithmetic & Geometric Progressions, Summation"},
        {"id": "Limits & Continuity", "grade_level": "SS3", "details": ""},
        {"id": "Calculus (Differentiation)", "grade_level": "SS3", "details": "Rules, Apps, Optima"},
        {"id": "Calculus (Integration)", "grade_level": "SS3", "details": "Indefinite, Definite, Area Under Curves, Diff. Equations"},
        {"id": "Data & Representation", "grade_level": "SS1", "details": "Measures of Central Tendency & Dispersion"},
        {"id": "Probability", "grade_level": "SS2", "details": "Concepts, Rules"},
        {"id": "Probability Distributions", "grade_level": "SS3", "details": "Discrete, Binomial, Normal"},
        {"id": "Inferential Statistics", "grade_level": "SS3", "details": "Sampling, Hypothesis Testing"}
    ]

    edges = [
        # Algebra / Geometry Core
        {"source": "Foundation Concepts", "target": "Algebra 1"},
        {"source": "Foundation Concepts", "target": "Geometry 1"},
        
        {"source": "Algebra 1", "target": "Functions & Relations"},
        {"source": "Algebra 1", "target": "Geometry 1"},
        {"source": "Algebra 1", "target": "Algebra 2"},
        
        {"source": "Geometry 1", "target": "Functions & Relations"},
        {"source": "Geometry 1", "target": "Geometry 2"},
        
        {"source": "Functions & Relations", "target": "Algebra 2"},
        
        # Advanced Math Branch
        {"source": "Algebra 2", "target": "Sequences & Series"},
        {"source": "Algebra 2", "target": "Trigonometry"},
        {"source": "Algebra 2", "target": "Limits & Continuity"},
        
        {"source": "Geometry 2", "target": "Trigonometry"},
        {"source": "Geometry 2", "target": "Vectors"},
        
        {"source": "Trigonometry", "target": "Vectors"},
        {"source": "Trigonometry", "target": "Limits & Continuity"},
        
        {"source": "Sequences & Series", "target": "Limits & Continuity"},
        
        {"source": "Limits & Continuity", "target": "Calculus (Differentiation)"},
        {"source": "Limits & Continuity", "target": "Calculus (Integration)"},
        {"source": "Calculus (Differentiation)", "target": "Calculus (Integration)"},
        
        # Statistics & Probability Branch
        {"source": "Foundation Concepts", "target": "Data & Representation"},
        {"source": "Data & Representation", "target": "Probability"},
        {"source": "Probability", "target": "Probability Distributions"},
        {"source": "Probability Distributions", "target": "Inferential Statistics"}
    ]

    graph = {
        "nodes": [{"id": n["id"], "grade_level": n["grade_level"], "details": n["details"]} for n in nodes],
        "links": [{"source": e["source"], "target": e["target"], "relationship_type": "PREREQUISITE", "cost": 1.0} for e in edges]
    }

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(base_dir, 'data', 'ekg.json'), 'w') as f:
        json.dump(graph, f, indent=4)
        
    print("Graph generated and saved to data/ekg.json")

if __name__ == "__main__":
    generate_graph()
