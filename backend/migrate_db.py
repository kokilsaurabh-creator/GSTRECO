import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn_str = os.getenv("DATABASE_URL")
if not conn_str:
    print("No DATABASE_URL found")
    exit(1)

# Connect to the Neon DB
try:
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cursor = conn.cursor()

    # 1. Add the missing CESS column (ignore if it already exists)
    try:
        print("Executing: ADD COLUMN cess")
        cursor.execute("""
            ALTER TABLE sap_purchase_register 
            ADD COLUMN cess NUMERIC(15, 2) DEFAULT 0.00;
        """)
    except psycopg2.errors.DuplicateColumn:
        print("Column cess already exists.")

    # 2. Drop the existing generated column to redefine the mathematical formula
    try:
        print("Executing: DROP COLUMN total_tax")
        cursor.execute("""
            ALTER TABLE sap_purchase_register 
            DROP COLUMN IF EXISTS total_tax;
        """)
    except Exception as e:
        print(f"Error dropping total_tax: {e}")

    # 3. Recreate the generated column including CESS
    try:
        print("Executing: ADD COLUMN total_tax")
        cursor.execute("""
            ALTER TABLE sap_purchase_register 
            ADD COLUMN total_tax NUMERIC(15, 2) GENERATED ALWAYS AS (cgst + sgst + igst + cess) STORED;
        """)
    except Exception as e:
        print(f"Error recreating total_tax: {e}")

    print("Migration completed successfully.")
    cursor.close()
    conn.close()

except Exception as e:
    print(f"Connection or execution failed: {e}")
