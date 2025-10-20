import sqlite3
import os

# --- Define database path ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'userAcc.db')

# --- Connect to DB ---
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

# --- Create or verify the table ---
c.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    selected_products TEXT
)
''')

conn.commit()
conn.close()

print("Database and table setup complete: userAcc.db")
