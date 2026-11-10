"""Conservatively sync verified directory facts into the Notion cafe database.

Only Address, Google rating, and Reviews are changed. Journal fields and user
ratings are intentionally left alone.
"""

import json
import os
import re
import sys
import unicodedata
import urllib.request


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


def api_request(method, url, headers, body=None):
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode())


def plain_text(items):
    return "".join(item.get("plain_text", "") for item in (items or []))


def title_for(page):
    for prop in page.get("properties", {}).values():
        if prop.get("type") == "title":
            return plain_text(prop.get("title"))
    return ""


def name_key(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", value.lower())


# Addresses are from official location pages where available, with Google
# review values only where a source explicitly identified Google data.
UPDATES = {
    "Sip and Sonder": {"address": "111 S Grand Ave, Los Angeles, CA 90012"},
    "goodboybob": {"address": "2058 Broadway, Santa Monica, CA 90404; 1300 Highland Ave Ste 109, Manhattan Beach, CA 90266; 1001 Venice Blvd, Venice, CA 90291"},
    "Bloom and Plume": {"address": "1638 W Temple St, Los Angeles, CA 90026"},
    "Avva Coffee Beverly Hills": {"address": "9559 S Santa Monica Blvd, Beverly Hills, CA 90210"},
    "Reinne’s Place": {"address": "3902 E 4th St, Long Beach, CA 90814", "google_rating": 5.0, "reviews": 83},
    "HARUCAKE": {"address": "3450 W 6th St #107, Los Angeles, CA 90010"},
    "% Arabica Los Angeles The Grove": {"address": "Unit K-2, 189 The Grove Dr, Los Angeles, CA 90036"},
    "Daydream": {"address": "864 W 16th St, Newport Beach, CA 92663", "google_rating": 4.7, "reviews": 151},
    "Deus Ex Machina - Emporium Of Post Modern Activities": {"address": "1001 Venice Blvd, Venice, CA 90291"},
    "Andante Coffee": {"address": "7623 Beverly Blvd, Los Angeles, CA 90036"},
    "mandarin coffee stand": {"address": "380 S Lake Ave Ste 111, Pasadena, CA 91105; 3768 E Colorado Blvd, Pasadena, CA 91107"},
    "Céd Coffee & Donut": {"address": "9760 Garden Grove Blvd, Garden Grove, CA 92844; 9711 Bolsa Ave, Westminster, CA 92683"},
    "Cafe Eclado": {"address": "10488 Valley View St, Buena Park, CA 90620"},
    "Ondo Coffee Co.": {"address": "710 Heliotrope Dr, Los Angeles, CA 90029"},
    "Lumen Coffee": {"address": "5025 N Figueroa St, Los Angeles, CA 90042; 1809 Blake Ave, Los Angeles, CA 90039"},
    "Loquat": {"address": "1201 Cypress Ave, Los Angeles, CA 90065; 3300 Sunset Blvd Ste 106, Los Angeles, CA 90026", "google_rating": 4.6, "reviews": 199},
    "Loquat Coffee Cypress Park": {"address": "1201 Cypress Ave, Los Angeles, CA 90065"},
    "Nook Coffee Bar": {"address": "2930 Bristol St Ste B105, Costa Mesa, CA 92626; 980 W 190th St Ste B1, Torrance, CA 90502; 11920 Foothill Blvd Ste 160, Rancho Cucamonga, CA 91739; 7925 Valley View St, La Palma, CA 90623"},
    "Salted Butter Company": {"address": "1 W California Blvd Unit 412, Pasadena, CA 91105"},
    "How's It Going To End?": {"address": "2111 Verdugo Blvd, Montrose, CA 91020"},
    "Onescape Coffee": {"address": "401 S Vermont Ave, Los Angeles, CA 90020"},
    "Meyers Manx Cafe": {"address": "6060 Wilshire Blvd, Los Angeles, CA 90036"},
    "Coffee Signal": {"address": "207 N Western Ave, Los Angeles, CA 90004"},
    "Gone Bananas Bread": {"address": "13106 San Vicente Blvd, Los Angeles, CA 90049; Farmers Market Stall #530, 6333 W 3rd St, Los Angeles, CA 90036"},
    "RH Ocean Grill at RH Newport Beach": {"address": "1101 Newport Center Dr, Newport Beach, CA 92660"},
    "Quat LA": {"address": "3030 Dolores St, Los Angeles, CA 90065"},
    "Loop Espresso Club": {"address": "1712 Colorado Blvd, Los Angeles, CA 90041"},
    "CHAGEE Modern Teahouse": {"address": "20 City Boulevard West Suite 916, Orange, CA 92868; 4301 La Jolla Village Dr Suite 2045, La Jolla, CA 92122; 775 Americana Way Space E-16, Glendale, CA 91210; 929 N Milliken Ave, Ontario, CA 91764; 555 The Shops At Mission Viejo Suite 218, Mission Viejo, CA 92691; 5246 E 2nd St, Long Beach, CA 90803; 6000 Sepulveda Blvd Ste 1557, Culver City, CA 90230; 14006 Riverside Dr Space 249A, Sherman Oaks, CA 91423; 1065 Brea Mall, Brea, CA 92821; 3525 W Carson St, Torrance, CA 90503; 10250 Santa Monica Blvd, Los Angeles, CA 90067"},
    "misc.coffee": {"address": "550 Deep Valley Dr Ste 149, Rolling Hills Estates, CA 90274"},
    "Bianca": {"address": "8850 Washington Blvd, Culver City, CA 90232"},
    "6100 Bread": {"address": "728 N Poinsettia St, Unit A, Santa Ana, CA 92701"},
    "Marlowe Coffee & Eatery": {"address": "5600 Wilshire Blvd, Los Angeles, CA 90036"},
    "Fika Fika Coffee & Creamery": {"address": "550 Deep Valley Dr Suite 100, Rolling Hills Estates, CA 90274; 1127 W Huntington Dr, Arcadia, CA 91007; 1731 E Colorado Blvd, Pasadena, CA 91106; 9661 Las Tunas Dr, Temple City, CA 91780; 418 W Pico Blvd, Los Angeles, CA 90015"},
    "Bonsai Coffee Barlana’s Coffee Roasters": {"address": "11573 Santa Monica Blvd, Los Angeles, CA 90025"},
    "mu.sō coffee": {"address": "5788 W Adams Blvd, Los Angeles, CA 90016"},
    "MEMORYLOOK": {"address": "2881 W Olympic Blvd, Los Angeles, CA 90006"},
    "Play Coffee Orange": {"address": "101 E Chapman Ave, Orange, CA 92866"},
    "Café Santo": {"address": "110 E 9th St, Los Angeles, CA 90079; 520 Whittier Blvd, Montebello, CA 90640"},
    "CedarHouse Coffee": {"address": "611 W Chapman Ave, Orange, CA 92868"},
    "idyllic": {"address": "1219 S Santa Fe Ave, Los Angeles, CA 90021"},
    "Pantry West Hollywood": {"address": "8906 Melrose Ave, West Hollywood, CA 90069"},
    "Goodfight": {"address": "1685 Beverly Blvd, Los Angeles, CA 90026"},
    "ARC COFFEE": {"address": "10488 Valley View St Ste 6, Buena Park, CA 90620"},
    "Neighborhood": {"address": "133 S La Brea Ave, Los Angeles, CA 90036"},
    "Yala Coffee": {"address": "11824 Ventura Blvd, Studio City, CA 91604; 3814 W Sunset Blvd, Los Angeles, CA 90026"},
    "Café Matcha": {"address": "12070 Ventura Blvd, Studio City, CA 91604; 705 N Alfred St, Los Angeles, CA 90069"},
    "Work In Progress": {"address": "2944 Randolph Ave, Costa Mesa, CA 92626"},
    "Pantheon Coffee": {"address": "1010 N Fairfax Ave, West Hollywood, CA 90046"},
    "Olive and James Cafe Tea - Melrose": {"address": "7473 Melrose Ave, Los Angeles, CA 90046"},
    "Freelance Coffee Project": {"address": "882 Production Pl, Newport Beach, CA 92663"},
    "Aurora LA": {"address": "211 S La Brea Ave, Los Angeles, CA 90036"},
    "Boxx Coffee Roasters Co.": {"address": "950 E 3rd St Ste 102, Los Angeles, CA 90013"},
    "The Butcher's Daughter": {"address": "205 Abbot Kinney Blvd, Venice, CA 90291; 8755 Melrose Ave, West Hollywood, CA 90069"},
    "Canyon Coffee": {"address": "1559 Echo Park Ave, Los Angeles, CA 90026"},
    "Café Tondo": {"address": "1135 N Alameda St, Los Angeles, CA 90012"},
    "SERIES A": {"address": "8328 Wilshire Blvd, Beverly Hills, CA 90211"},
    "TAKAGI COFFEE WEST THIRD": {"address": "8048 W 3rd St, Los Angeles, CA 90048"},
    "Be Bright Coffee": {"address": "7311 Melrose Ave, Los Angeles, CA 90046"},
    "Archives Of Us": {"address": "555 N Spring St, Los Angeles, CA 90012"},
    "The Boy & The Bear - Redondo Beach - Black Store": {"address": "350 N Pacific Coast Hwy, Redondo Beach, CA 90277"},
    "Rose Bakery": {"address": "15232 Vanowen St, Van Nuys, CA 91405"},
    "The Exchange Coffee Co. at Freehand Los Angeles": {"address": "416 W 8th St, Los Angeles, CA 90014"},
    "Document Coffee Bar": {"address": "3850 Wilshire Blvd Ste 107, Los Angeles, CA 90010"},
    "6XS COFFEE": {"address": "3907 W 6th St, Los Angeles, CA 90020; 888 S Hope St, Los Angeles, CA 90017; 2807 W Sunset Blvd #220, Los Angeles, CA 90026"},
    "Brio Brio Bakery & Café": {"address": "22681 Lake Forest Dr Ste A1-A, Lake Forest, CA 92630"},
    "NOSTALGIC CAFE": {"address": "27 E Holly St, Pasadena, CA 91103"},
    "rōk Coffee and Tea - Olympic": {"address": "3060 W Olympic Blvd #150, Los Angeles, CA 90006"},
    "Sightglass Coffee": {"address": "7051 W Willoughby Ave, Los Angeles, CA 90038"},
    "STAGGER COFFEE": {"address": "3069 1/2 W 8th St, Los Angeles, CA 90005"},
    "Kei Coffee House": {"address": "15691 Brookhurst St, Westminster, CA 92683"},
    "Go Get Em’ Tiger — Los Angeles, CA": {"address": "317 S Broadway, Los Angeles, CA 90013", "google_rating": 4.3, "reviews": 670},
    "Go Get Em’ Tiger — Culver City, CA": {"address": "10000 Washington Blvd Suite 103, Culver City, CA 90232"},
    "Two Guns Espresso — Manhattan Beach, CA": {"address": "3516 Highland Ave, Manhattan Beach, CA 90266"},
    "Two Guns Espresso": {"address": "875 Manhattan Beach Blvd, Manhattan Beach, CA 90266", "google_rating": 3.8, "reviews": 81},
    "Coffee for Sasquatch": {"address": "7020 Melrose Ave, Los Angeles, CA 90038", "google_rating": 4.6, "reviews": 342},
    "Play Coffee (Fullerton)": {"address": "128 W Commonwealth Ave, Fullerton, CA 92832", "google_rating": 4.8},
    "Highly Likely": {"address": "4310 W Jefferson Blvd, Los Angeles, CA 90016", "google_rating": 4.4, "reviews": 741},
    "Thank You Coffee": {"address": "938 N Hill St, Los Angeles, CA 90012", "google_rating": 4.7, "reviews": 257},
    "Laidrey": {"address": "18600 Ventura Blvd, Tarzana, CA 91356", "google_rating": 4.2, "reviews": 191},
    "Highlight Coffee": {"address": "701 E Broadway, Glendale, CA 91205", "google_rating": 4.6, "reviews": 296},
    "Cognoscenti Coffee": {"address": "6114 Washington Blvd, Culver City, CA 90232", "google_rating": 4.5, "reviews": 567},
    "Bar Nine": {"address": "3515 Helms Ave, Culver City, CA 90232", "google_rating": 4.6, "reviews": 412},
    "Hooked": {"address": "9 Dudley Ave, Venice, CA 90291", "google_rating": 4.3, "reviews": 106},
    "Endorffeine": {"address": "727 N Broadway #127, Los Angeles, CA 90012", "google_rating": 4.4, "reviews": 322},
    "Matte Black": {"address": "8500 Sunset Blvd, Los Angeles, CA 90069", "google_rating": 4.2, "reviews": 117},
    "Blueys": {"address": "12825 Venice Blvd, Los Angeles, CA 90066"},
    "Slammers Cafe": {"address": "611 N Fairfax Ave, Los Angeles, CA 90036"},
    "House of ANNUKO": {"address": "5790 Washington Blvd, Culver City, CA 90232"},
    "Silverback Coffee of Rwanda": {"address": "400 S Hope St, Los Angeles, CA 90071"},
    "Dinosaur Coffee": {"address": "4334 W Sunset Blvd, Los Angeles, CA 90026", "google_rating": 4.4, "reviews": 643},
    "The Ugly Mugs Coffee House": {"address": "3112 W Burbank Blvd #100, Burbank, CA 91505", "google_rating": 4.7, "reviews": 322},
    "Comet Over Delp": {"address": "115 N Ave 59, Highland Park, CA 90042"},
    "Granada": {"address": "1451 Carroll Ave, Los Angeles, CA 90026", "google_rating": 4.7, "reviews": 61},
    "Loose Cannon Cafe": {"address": "2527 Canada Blvd, Glendale, CA 91208", "google_rating": 4.7, "reviews": 68},
    "Rề Cà Phê": {"address": "9430 Warner Ave #N, Fountain Valley, CA 92708", "google_rating": 4.6, "reviews": 147},
}


def main():
    load_dotenv()
    token = os.getenv("NOTION_TOKEN")
    database_id = os.getenv("NOTION_DATABASE_ID")
    if not token or token == "secret_replace_me" or not database_id:
        raise SystemExit("NOTION_TOKEN and NOTION_DATABASE_ID must be configured in .env")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": os.getenv("NOTION_API_VERSION", "2026-03-11"),
    }
    database = api_request("GET", f"https://api.notion.com/v1/databases/{database_id}", headers)
    data_sources = database.get("data_sources", [])
    data_source_id = data_sources[0].get("id") if data_sources else database_id
    pages = []
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        payload = api_request("POST", f"https://api.notion.com/v1/data_sources/{data_source_id}/query", headers, body)
        pages.extend(payload.get("results", []))
        if not payload.get("has_more") or not payload.get("next_cursor"):
            break
        cursor = payload["next_cursor"]

    updates_by_key = {name_key(name): values for name, values in UPDATES.items()}
    matched = set()
    changed = 0
    skipped = []
    for page in pages:
        name = title_for(page)
        values = updates_by_key.get(name_key(name))
        if not values:
            continue
        matched.add(name_key(name))
        properties = {}
        if "address" in values:
            properties["Address"] = {"rich_text": [{"type": "text", "text": {"content": values["address"]}}]}
        if "google_rating" in values:
            properties["Google rating"] = {"number": values["google_rating"]}
        if "reviews" in values:
            properties["Reviews"] = {"number": values["reviews"]}
        if not properties:
            continue
        api_request("PATCH", f"https://api.notion.com/v1/pages/{page['id']}", headers, {"properties": properties})
        changed += 1

    for name in UPDATES:
        if name_key(name) not in matched:
            skipped.append(name)
    print(f"Scanned {len(pages)} Notion records")
    print(f"Updated {changed} records")
    print(f"Unmatched update keys: {len(skipped)}")
    if skipped:
        print("; ".join(skipped))


if __name__ == "__main__":
    main()
