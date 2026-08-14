import os
import psycopg2
import uuid

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://neondb_owner:npg_LUGCA2tQwq3x@ep-divine-base-ax9trds9-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require")

MOCK_GSTINS = [
    ('27AAAAA0000A1Z5', 'Maharashtra Operations'),
    ('29BBBBB0000B1Z5', 'Karnataka Operations'),
    ('07CCCCC0000C1Z5', 'Delhi Corporate')
]

def seed_db():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        for gstin, name in MOCK_GSTINS:
            # Check if exists
            cur.execute("SELECT id FROM gst_accounts WHERE gstin = %s", (gstin,))
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO gst_accounts (id, gstin, legal_name) VALUES (%s, %s, %s)",
                    (str(uuid.uuid4()), gstin, name)
                )
        conn.commit()
        cur.close()
        conn.close()
        print("Database seeded with mock GSTINs.")
    except Exception as e:
        print(f"Error seeding database: {e}")

if __name__ == "__main__":
    seed_db()
