
import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


ROOT = os.path.dirname(os.path.abspath(__file__))


def load_dotenv():
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def prop_value(prop):
    if not isinstance(prop, dict):
        return None
    kind = prop.get("type")
    value = prop.get(kind)
    if kind == "title" or kind == "rich_text":
        return "".join(item.get("plain_text", "") for item in (value or []))
    if kind == "select":
        return (value or {}).get("name", "")
    if kind == "multi_select":
        return [(item or {}).get("name", "") for item in (value or [])]
    if kind == "number":
        return value
    if kind == "checkbox":
        return bool(value)
    if kind == "url":
        return value or ""
    return None


def find_property(properties, names, types=None, fallback=False):
    names = {name.lower() for name in names}
    for key, prop in properties.items():
        if key.lower() in names and (not types or prop.get("type") in types):
            return prop_value(prop)
    if types and fallback:
        for prop in properties.values():
            if prop.get("type") in types:
                value = prop_value(prop)
                if value not in (None, "", []):
                    return value
    return None


def property_type(properties, names):
    names = {name.lower() for name in names}
    for key, prop in properties.items():
        if key.lower() in names:
            return prop.get("type")
    return None


def normalize_page(page):
    properties = page.get("properties", {})
    name = find_property(properties, {"name", "cafe", "café", "title"}, {"title"}) or "Untitled café"
    address = find_property(properties, {"address"}, {"rich_text"}) or ""
    city = find_property(properties, {"city"}, {"multi_select"}) or []
    tags = find_property(properties, {"tags", "tag", "categories", "category", "neighborhood", "location"}, {"multi_select"}) or []
    if isinstance(tags, str):
        tags = [tags]
    price = find_property(properties, {"price", "cost", "price range"}, {"select"})
    if price:
        tags = [price, *tags]
    visit_date = find_property(properties, {"visit date", "date", "visited"}, {"date"}) or ""
    review = find_property(properties, {"review", "note", "notes"}, {"rich_text"}) or ""
    order = find_property(properties, {"order", "drink", "what i ordered"}, {"rich_text"}) or ""
    record_type = find_property(properties, {"record type", "type"}, {"select"}) or ""
    explicit_status = find_property(properties, {"status", "state"}, {"select", "status"})
    status = explicit_status or ("Logged" if (visit_date or review or order) else "Want to try")
    rating = find_property(properties, {"visit rating", "rating", "score", "café rating", "cafe rating"}, {"number"}) or 0
    google_rating = find_property(properties, {"google rating"}, {"number"}) or 0
    reviews = find_property(properties, {"reviews", "review count"}, {"number"}) or 0
    favorite = find_property(properties, {"favorite", "favourite", "favorites"}, {"checkbox"}) or False
    source = find_property(properties, {"source", "url", "website"}, {"url", "rich_text"}) or "From Notion"
    if isinstance(city, list):
        tags = [*tags, *city]
    return {
        "page_id": page.get("id"),
        "name": name,
        "status": status,
        "source": source,
        "address": address,
        "cities": city,
        "tags": tags[:5],
        "rating": rating,
        "google_rating": google_rating,
        "reviews": reviews,
        "favorite": favorite,
        "visit_date": visit_date,
        "review": review,
        "order": order,
        "record_type": record_type,
    }


def notion_cafes():
    load_dotenv()
    token = os.getenv("NOTION_TOKEN")
    data_source_id = os.getenv("NOTION_DATA_SOURCE_ID")
    database_id = os.getenv("NOTION_DATABASE_ID")
    if not token or token == "secret_replace_me":
        raise RuntimeError("NOTION_TOKEN is not configured. Copy .env.example to .env and add your token.")
    if not data_source_id and not database_id:
        raise RuntimeError("Set NOTION_DATABASE_ID or NOTION_DATA_SOURCE_ID in .env.")
    api_version = os.getenv("NOTION_API_VERSION", "2026-03-11")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": api_version,
    }
    if not data_source_id:
        database_request = urllib.request.Request(
            f"https://api.notion.com/v1/databases/{database_id}", headers=headers
        )
        with urllib.request.urlopen(database_request, timeout=20) as response:
            database = json.loads(response.read().decode())
        data_sources = database.get("data_sources", [])
        data_source_id = data_sources[0].get("id") if data_sources else database_id
    results = []
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        request = urllib.request.Request(
            f"https://api.notion.com/v1/data_sources/{data_source_id}/query",
            data=json.dumps(body).encode(),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode())
        results.extend(payload.get("results", []))
        if not payload.get("has_more") or not payload.get("next_cursor"):
            break
        cursor = payload["next_cursor"]
    return {"cafes": [normalize_page(page) for page in results]}


def notion_create_cafe(name, location=""):
    load_dotenv()
    token = os.getenv("NOTION_TOKEN")
    data_source_id = os.getenv("NOTION_DATA_SOURCE_ID")
    database_id = os.getenv("NOTION_DATABASE_ID")
    if not token or token == "secret_replace_me":
        raise RuntimeError("NOTION_TOKEN is not configured.")
    if not data_source_id and not database_id:
        raise RuntimeError("Set NOTION_DATABASE_ID or NOTION_DATA_SOURCE_ID in .env.")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": os.getenv("NOTION_API_VERSION", "2026-03-11"),
    }
    if not data_source_id:
        request = urllib.request.Request(f"https://api.notion.com/v1/databases/{database_id}", headers=headers)
        with urllib.request.urlopen(request, timeout=20) as response:
            database = json.loads(response.read().decode())
        data_sources = database.get("data_sources", [])
        data_source_id = data_sources[0].get("id") if data_sources else database_id
    source_request = urllib.request.Request(f"https://api.notion.com/v1/data_sources/{data_source_id}", headers=headers)
    with urllib.request.urlopen(source_request, timeout=20) as response:
        source = json.loads(response.read().decode())
    properties = source.get("properties", {})
    title_name = next((key for key, prop in properties.items() if prop.get("type") == "title"), "Name")
    existing = notion_cafes()["cafes"]
    duplicate = next((cafe for cafe in existing if cafe.get("name", "").strip().casefold() == name.casefold()), None)
    if duplicate:
        return {"cafe": duplicate, "created": False}
    properties_payload = {title_name: {"title": [{"type": "text", "text": {"content": name}}]}}
    location = str(location or "").strip()[:400]
    address_name = next((key for key, prop in properties.items() if key.lower() == "address" and prop.get("type") == "rich_text"), None)
    city_name = next((key for key, prop in properties.items() if key.lower() == "city" and prop.get("type") == "multi_select"), None)
    if location and address_name:
        properties_payload[address_name] = {"rich_text": [{"type": "text", "text": {"content": location}}]}
    if location and city_name and not any(character.isdigit() for character in location):
        city = location.split(",", 1)[0].strip()
        if city:
            properties_payload[city_name] = {"multi_select": [{"name": city[:100]}]}
    body = {
        "parent": {"data_source_id": data_source_id},
        "properties": properties_payload,
    }
    request = urllib.request.Request(
        "https://api.notion.com/v1/pages",
        data=json.dumps(body).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        page = json.loads(response.read().decode())
    return {"cafe": normalize_page(page), "created": True}


def notion_delete_cafe(page_id):
    load_dotenv()
    token = os.getenv("NOTION_TOKEN")
    if not token or token == "secret_replace_me":
        raise RuntimeError("NOTION_TOKEN is not configured.")
    if not page_id or len(str(page_id)) > 80:
        raise ValueError("A valid cafe page id is required.")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": os.getenv("NOTION_API_VERSION", "2026-03-11"),
    }
    request = urllib.request.Request(
        f"https://api.notion.com/v1/pages/{page_id}",
        data=json.dumps({"in_trash": True}).encode(),
        headers=headers,
        method="PATCH",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        page = json.loads(response.read().decode())
    return {"deleted": True, "page_id": page.get("id", page_id)}


def notion_schema():
    load_dotenv()
    token = os.getenv("NOTION_TOKEN")
    database_id = os.getenv("NOTION_DATABASE_ID")
    if not token or not database_id:
        raise RuntimeError("NOTION_TOKEN and NOTION_DATABASE_ID are required.")
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": os.getenv("NOTION_API_VERSION", "2026-03-11"),
    }
    request = urllib.request.Request(f"https://api.notion.com/v1/databases/{database_id}", headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        database = json.loads(response.read().decode())
    properties = [
        {"name": name, "id": prop.get("id"), "type": prop.get("type")}
        for name, prop in database.get("properties", {}).items()
    ]
    data_sources = database.get("data_sources", [])
    if not properties and data_sources:
        source_request = urllib.request.Request(
            f"https://api.notion.com/v1/data_sources/{data_sources[0]['id']}", headers=headers
        )
        with urllib.request.urlopen(source_request, timeout=20) as response:
            source = json.loads(response.read().decode())
        properties = [
            {"name": name, "id": prop.get("id"), "type": prop.get("type")}
            for name, prop in source.get("properties", {}).items()
        ]
    return {"properties": properties, "data_sources": data_sources}


def public_config():
    load_dotenv()
    url = os.getenv("SUPABASE_URL", "").strip()
    anon_key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    return {
        "configured": bool(url and anon_key and "your-project" not in url),
        "supabaseUrl": url,
        "supabaseAnonKey": anon_key,
    }


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/config":
            body = json.dumps(public_config()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/api/schema":
            try:
                body = json.dumps(notion_schema()).encode()
                self.send_response(200)
            except (RuntimeError, urllib.error.HTTPError, urllib.error.URLError) as error:
                body = json.dumps({"error": str(error)}).encode()
                self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/api/cafes":
            try:
                body = json.dumps(notion_cafes()).encode()
                self.send_response(200)
            except (RuntimeError, urllib.error.HTTPError, urllib.error.URLError) as error:
                body = json.dumps({"error": str(error)}).encode()
                self.send_response(503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/cafes":
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
            return
        self.send_error(404)

    def do_DELETE(self):
        if self.path == "/api/cafes":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length).decode() or "{}")
                page_id = str(payload.get("page_id", "")).strip()
                body = json.dumps(notion_delete_cafe(page_id)).encode()
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
            return
        self.send_error(404)


if __name__ == "__main__":
    load_dotenv()
    port = int(os.getenv("PORT", "4173"))
    os.chdir(ROOT)
    print(f"Cafecito running at http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
