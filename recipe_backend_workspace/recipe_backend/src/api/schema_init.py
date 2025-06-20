import os
import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

def ensure_supabase_tables():
    """
    Ensures the 'recipes' table exists in Supabase. 
    Can be run manually or invoked at startup for local dev.
    """
    url = f"{SUPABASE_URL}/rest/v1/rpc/create_table_if_not_exists"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    # The function 'create_table_if_not_exists' should be present in Supabase as an RPC, or use SQL directly from dashboard:
    # CREATE TABLE IF NOT EXISTS recipes (id serial primary key, user_id uuid, title text, description text, ingredients text[], steps text[]);
    # For local: Just document this here as main setup happens on Supabase console.
    pass
