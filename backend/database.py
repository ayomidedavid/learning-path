import pymysql
from pymysql.cursors import DictCursor

def get_db_connection():
    # Connect to XAMPP MySQL
    return pymysql.connect(
        host='localhost',
        user='root',
        password='',
        database='lprs',
        cursorclass=DictCursor,
        autocommit=True
    )

def init_db():
    # Connect without database to create it if not exists
    conn = pymysql.connect(
        host='localhost',
        user='root',
        password='',
        autocommit=True
    )
    with conn.cursor() as cursor:
        cursor.execute("CREATE DATABASE IF NOT EXISTS lprs;")
    conn.close()

    # Connect to the database and create tables
    conn = get_db_connection()
    with conn.cursor() as cursor:
        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                hashed_password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'student'
            ) ENGINE=InnoDB;
        """)
        
        # Create progress table linked to users
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                topic_id VARCHAR(255) NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        """)
    conn.close()
