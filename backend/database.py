import os
import sqlite3
import pymysql
from pymysql.cursors import DictCursor

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sqlite_db_path = os.path.join(base_dir, 'lprs.db')

class SQLiteConnectionWrapper:
    """Wrapper to make SQLite connection API compatible with PyMySQL DictCursor usage"""
    def __init__(self, conn):
        self.conn = conn

    def cursor(self):
        return SQLiteCursorWrapper(self.conn.cursor())

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

class SQLiteCursorWrapper:
    def __init__(self, cursor):
        self.cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def execute(self, query, args=None):
        # Convert %s placeholders to ? for SQLite compatibility
        query_sql = query.replace('%s', '?').replace('AUTO_INCREMENT', 'AUTOINCREMENT').replace('ENGINE=InnoDB', '')
        if args:
            self.cursor.execute(query_sql, args)
        else:
            self.cursor.execute(query_sql)
        return self

    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    def fetchall(self):
        rows = self.cursor.fetchall()
        return [dict(r) for r in rows]

def get_db_connection():
    try:
        conn = pymysql.connect(
            host='localhost',
            user='root',
            password='',
            database='lprs',
            cursorclass=DictCursor,
            autocommit=True
        )
        return conn
    except Exception:
        # Fallback to SQLite if MySQL service is not running
        conn = sqlite3.connect(sqlite_db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return SQLiteConnectionWrapper(conn)

def init_db():
    try:
        conn = pymysql.connect(
            host='localhost',
            user='root',
            password='',
            autocommit=True
        )
        with conn.cursor() as cursor:
            cursor.execute("CREATE DATABASE IF NOT EXISTS lprs;")
        conn.close()

        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    hashed_password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) DEFAULT 'student'
                ) ENGINE=InnoDB;
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS progress (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    topic_id VARCHAR(255) NOT NULL
                ) ENGINE=InnoDB;
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_adaptive_paths (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    target_topic VARCHAR(255) NOT NULL,
                    is_deviated BOOLEAN DEFAULT FALSE,
                    bridge_nodes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            """)
        conn.close()
    except Exception:
        # SQLite Initialization Fallback
        conn = sqlite3.connect(sqlite_db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT DEFAULT 'student'
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic_id TEXT NOT NULL
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_adaptive_paths (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                target_topic TEXT NOT NULL,
                is_deviated BOOLEAN DEFAULT 0,
                bridge_nodes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        conn.close()
