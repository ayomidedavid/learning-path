import sqlite3
import pymysql
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
sqlite_path = os.path.join(base_dir, 'lprs.db')

def migrate():
    if not os.path.exists(sqlite_path):
        print("No SQLite database found. Skip migration.")
        return

    # Init MySQL
    import sys
    sys.path.append(base_dir)
    from backend.database import init_db, get_db_connection
    init_db()
    
    # Read from SQLite
    sl_conn = sqlite3.connect(sqlite_path)
    sl_cur = sl_conn.cursor()
    
    # Write to MySQL
    my_conn = get_db_connection()
    my_cur = my_conn.cursor()
    
    try:
        sl_cur.execute("SELECT id, username, hashed_password, role FROM users")
        users = sl_cur.fetchall()
        for u in users:
            # Ignore if already exists in mysql
            my_cur.execute("SELECT id FROM users WHERE username=%s", (u[1],))
            if not my_cur.fetchone():
                my_cur.execute(
                    "INSERT INTO users (id, username, hashed_password, role) VALUES (%s, %s, %s, %s)",
                    (u[0], u[1], u[2], u[3])
                )
        
        sl_cur.execute("SELECT id, user_id, topic_id FROM progress")
        progresses = sl_cur.fetchall()
        for p in progresses:
            my_cur.execute("SELECT id FROM progress WHERE id=%s", (p[0],))
            if not my_cur.fetchone():
                # Check if user_id exists in mysql before inserting to avoid constraint error
                my_cur.execute("SELECT id FROM users WHERE id=%s", (p[1],))
                if my_cur.fetchone():
                    my_cur.execute(
                        "INSERT INTO progress (id, user_id, topic_id) VALUES (%s, %s, %s)",
                        (p[0], p[1], p[2])
                    )
                    
        my_conn.commit()
        print(f"Successfully migrated {len(users)} users and {len(progresses)} progress records from SQLite to MySQL!")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        sl_conn.close()
        my_conn.close()

if __name__ == "__main__":
    migrate()
