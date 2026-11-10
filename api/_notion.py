import json
import os
import urllib.request


def prop_value(prop):
    if not isinstance(prop, dict):
        return None
    kind = prop.get("type")
    value = prop.get(kind)
    if kind in {"title", "rich_text"}:
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
    return {"page_id": page.get("id"), "name": name, "status": status, "source": source,
            "address": address, "cities": city, "tags": tags[:5], "rating": rating,
            "google_rating": google_rating, "reviews": reviews, "favorite": favorite,
            "visit_date": visit_date, "review": review, "order": order, "record_type": record_type}


def notion_headers():
    token = os.getenv("NOTION_TOKEN")
    if not token or token == "secret_replace_me":
        raise RuntimeError("NOTION_TOKEN is not configured.")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json",
            "Notion-Version": os.getenv("NOTION_API_VERSION", "2026-03-11")}


def notion_cafes():
    headers = notion_headers()
    data_source_id = os.getenv("NOTION_DATA_SOURCE_ID")
    database_id = os.getenv("NOTION_DATABASE_ID")
    if not data_source_id and not database_id:
        raise RuntimeError("Set NOTION_DATABASE_ID or NOTION_DATA_SOURCE_ID.")
    if not data_source_id:
        request = urllib.request.Request(f"https://api.notion.com/v1/databases/{database_id}", headers=headers)
        with urllib.request.urlopen(request, timeout=20) as response:
            database = json.loads(response.read().decode())
        sources = database.get("data_sources", [])
        data_source_id = sources[0].get("id") if sources else database_id
    results = []
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        request = urllib.request.Request(
            f"https://api.notion.com/v1/data_sources/{data_source_id}/query",
            data=json.dumps(body).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode())
        results.extend(payload.get("results", []))
        if not payload.get("has_more") or not payload.get("next_cursor"):
            break
        cursor = payload["next_cursor"]
    return {"cafes": [normalize_page(page) for page in results]}


def notion_schema():
    headers = notion_headers()
    database_id = os.getenv("NOTION_DATABASE_ID")
    if not database_id:
        raise RuntimeError("NOTION_DATABASE_ID is required.")
    request = urllib.request.Request(f"https://api.notion.com/v1/databases/{database_id}", headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        database = json.loads(response.read().decode())
    properties = [{"name": name, "id": prop.get("id"), "type": prop.get("type")}
                  for name, prop in database.get("properties", {}).items()]
    return {"properties": properties, "data_sources": database.get("data_sources", [])}
