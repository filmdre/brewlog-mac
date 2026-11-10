import json
import urllib.error
from http.server import BaseHTTPRequestHandler

from server import notion_cafes, notion_create_cafe


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            body = json.dumps(notion_cafes()).encode()
            status = 200
        except (RuntimeError, urllib.error.HTTPError, urllib.error.URLError) as error:
            body = json.dumps({"error": str(error)}).encode()
            status = 503
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode() or "{}")
            name = str(payload.get("name", "")).strip()
            location = str(payload.get("location", "")).strip()
            if not name or len(name) > 120:
                raise ValueError("Enter a café name up to 120 characters.")
            if len(location) > 400:
                raise ValueError("Enter an address or city up to 400 characters.")
            body = json.dumps(notion_create_cafe(name, location)).encode()
            status = 200
        except ValueError as error:
            body = json.dumps({"error": str(error)}).encode()
            status = 400
        except (RuntimeError, urllib.error.HTTPError, urllib.error.URLError) as error:
            body = json.dumps({"error": str(error)}).encode()
            status = 503
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
