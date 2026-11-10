import json
import urllib.error
from http.server import BaseHTTPRequestHandler

from _notion import notion_schema


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            body = json.dumps(notion_schema()).encode()
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
