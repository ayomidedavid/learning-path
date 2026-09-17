import os
import sys
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List

# Add src to path to import algorithms
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(base_dir)

from src.algorithms.dijkstra import PathGenerator
from src.algorithms.aco import AntColonyOptimizer
from backend import database, auth

app = FastAPI(title="SSM-LPRS API V2")

from fastapi.staticfiles import StaticFiles

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend directory to serve static HTML files
frontend_dir = os.path.join(base_dir, 'frontend')
app.mount("/app", StaticFiles(directory=frontend_dir, html=True), name="frontend")

@app.get("/")
def read_root():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/app/index.html")

# Setup Database using raw SQL
database.init_db()

graph_path = os.path.join(base_dir, 'data', 'ekg.json')

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = auth.decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = payload.get("sub")
    
    conn = database.get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
    finally:
        conn.close()
        
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "student"

class PathRequest(BaseModel):
    source: str
    target: str
    algorithm: str = "linear"
    completed_topics: List[str] = []
    adaptive: bool = True

class ProgressUpdate(BaseModel):
    topic_id: str

@app.post("/register")
def register(user: UserCreate):
    conn = database.get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE username = %s", (user.username,))
            db_user = cursor.fetchone()
            if db_user:
                raise HTTPException(status_code=400, detail="Username already registered")
            
            hashed_pw = auth.get_password_hash(user.password)
            cursor.execute(
                "INSERT INTO users (username, hashed_password, role) VALUES (%s, %s, %s)",
                (user.username, hashed_pw, user.role)
            )
            conn.commit()
    finally:
        conn.close()
    return {"message": "User registered successfully"}

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = database.get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE username = %s", (form_data.username,))
            user = cursor.fetchone()
    finally:
        conn.close()
        
    if not user or not auth.verify_password(form_data.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = auth.create_access_token(data={"sub": user['username'], "role": user['role']})
    return {"access_token": access_token, "token_type": "bearer", "role": user['role']}

@app.get("/me")
def get_my_profile(current_user: dict = Depends(get_current_user)):
    conn = database.get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as count FROM progress WHERE user_id = %s", (current_user['id'],))
            progress = cursor.fetchone()
    finally:
        conn.close()

    return {
        "id": current_user['id'],
        "username": current_user['username'],
        "role": current_user['role'],
        "completed_count": progress['count'] if progress else 0
    }

@app.get("/me/progress")
def get_progress(current_user: dict = Depends(get_current_user)):
    conn = database.get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT topic_id FROM progress WHERE user_id = %s", (current_user['id'],))
            completed_topics = cursor.fetchall()
    finally:
        conn.close()
        
    return {"completed": [p['topic_id'] for p in completed_topics]}

@app.post("/me/progress")
def mark_progress(progress: ProgressUpdate, current_user: dict = Depends(get_current_user)):
    conn = database.get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM progress WHERE user_id = %s AND topic_id = %s",
                (current_user['id'], progress.topic_id)
            )
            existing = cursor.fetchone()
            
            if not existing:
                cursor.execute(
                    "INSERT INTO progress (user_id, topic_id) VALUES (%s, %s)",
                    (current_user['id'], progress.topic_id)
                )
                conn.commit()
    finally:
        conn.close()
    return {"message": f"Topic '{progress.topic_id}' marked as completed."}

@app.get("/admin/users")
def get_all_users(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conn = database.get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, username, role FROM users")
            users = cursor.fetchall()
            
            res = []
            for u in users:
                cursor.execute("SELECT COUNT(*) as count FROM progress WHERE user_id = %s", (u['id'],))
                prog = cursor.fetchone()
                res.append({
                    "id": u['id'],
                    "username": u['username'],
                    "role": u['role'],
                    "completed_count": prog['count']
                })
    finally:
        conn.close()
    return res

@app.get("/textbook/{grade}")
def get_textbook(grade: str):
    grade = grade.upper()
    filename_map = {
        "SS1": "Copy of NEW GENERAL MATHEMATICS SS1 (PDF-MADEAZY BOOKSHOP).pdf",
        "SS2": "Copy of NEW GENERAL MATHEMATICS SS2 (PDF-MADEAZY BARR KOLAWOLE).pdf",
        "SS3": "Copy of NEW GENERAL MATHEMATICS SS3 (PDF-MADEAZY BARR. KOLAWOLE).pdf"
    }
    
    if grade not in filename_map:
        raise HTTPException(status_code=404, detail="Textbook not found for this grade.")
        
    pdf_path = os.path.join(base_dir, filename_map[grade])
    
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Textbook file not found on server.")
        
    return FileResponse(pdf_path, media_type="application/pdf")

@app.get("/topic_content/{grade}/{topic_id:path}")
def get_topic_content(grade: str, topic_id: str):
    grade = grade.upper()
    safe_topic = topic_id.replace(" ", "_").replace("/", "_")
    topic_pdf_path = os.path.join(base_dir, 'data', 'topics', grade, safe_topic, 'content.pdf')
    
    if not os.path.exists(topic_pdf_path):
        raise HTTPException(status_code=404, detail=f"Extracted topic content not found: {topic_pdf_path}")
        
    return FileResponse(topic_pdf_path, media_type="application/pdf")

@app.get("/topics")
def get_topics():
    import json
    if not os.path.exists(graph_path):
        raise HTTPException(status_code=404, detail="Graph data not found.")
    with open(graph_path, 'r') as f:
        data = json.load(f)
    topics = [{"id": n["id"], "grade": n.get("grade_level", ""), "details": n.get("details", "")} for n in data["nodes"]]
    return {"topics": topics}

@app.get("/graph")
def get_graph():
    import json
    if not os.path.exists(graph_path):
        raise HTTPException(status_code=404, detail="Graph data not found.")
    with open(graph_path, 'r') as f:
        data = json.load(f)
    return data

@app.get("/subgraph/{target:path}")
def get_subgraph(target: str):
    import json
    if not os.path.exists(graph_path):
        raise HTTPException(status_code=404, detail="Graph data not found.")
    with open(graph_path, 'r') as f:
        data = json.load(f)
        
    # Build an adjacency list for reverse traversal (child -> parents)
    parents = {}
    for link in data['links']:
        child = link['target']
        parent = link['source']
        if child not in parents:
            parents[child] = []
        parents[child].append(parent)
        
    # Find all ancestors
    ancestors = set()
    stack = [target]
    while stack:
        current = stack.pop()
        ancestors.add(current)
        if current in parents:
            for p in parents[current]:
                if p not in ancestors:
                    stack.append(p)
                    
    # Filter nodes and links
    sub_nodes = [n for n in data['nodes'] if n['id'] in ancestors]
    sub_links = [l for l in data['links'] if l['source'] in ancestors and l['target'] in ancestors]
    
    return {"nodes": sub_nodes, "links": sub_links}

@app.post("/recommend_path")
def recommend_path(request: PathRequest):
    if not os.path.exists(graph_path):
        raise HTTPException(status_code=404, detail="Graph data not found.")

    algorithm_name = request.algorithm.lower()
    generator = PathGenerator(graph_path)

    if algorithm_name == 'dijkstra':
        result = generator.generate_dijkstra_path(request.source, request.target)
    elif algorithm_name == 'linear':
        result = generator.generate_linear_path(request.source, request.target)
    elif algorithm_name in ['dynamic', 'adaptive']:
        if request.adaptive:
            result = generator.generate_adaptive_path(
                request.source,
                request.target,
                completed_topics=request.completed_topics
            )
        else:
            result = generator.generate_dynamic_path(
                request.source,
                request.target,
                completed_topics=request.completed_topics
            )
    elif algorithm_name == 'aco':
        optimizer = AntColonyOptimizer(graph_path)
        result = optimizer.generate_aco_path(request.source, request.target)
    else:
        raise HTTPException(status_code=400, detail="Invalid algorithm specified. Use linear, dynamic, adaptive, dijkstra, or aco.")

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])

    # Persistent AI Reinforcement: Record user traversal route into ACO pheromones
    try:
        clean_path = [p for p in result.get("path", []) if not str(p).startswith("Bridge:")]
        if len(clean_path) >= 2:
            optimizer = AntColonyOptimizer(graph_path)
            optimizer.record_user_traversal(clean_path)
    except Exception as e:
        print(f"Warning: Failed to record ACO traversal: {e}")

    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
