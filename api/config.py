import json
import os
from http.server import BaseHTTPRequestHandler

from server import load_dotenv


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        load_dotenv()
        url = os.getenv("SUPABASE_URL", "").strip()
        anon_key = os.getenv("SUPABASE_ANON_KEY", "").strip()
        body = json.dumps({
            "configured": bool(url and anon_key and "your-project" not in url),
            "supabaseUrl": url,
            "supabaseAnonKey": anon_key,
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
