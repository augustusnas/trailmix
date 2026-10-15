"""Trailmix Milestone 0: create one test playlist in your YouTube account.

Uses only Python's built-in libraries, so there is nothing to install.
Run it with:  python3 make_playlist.py
"""

import base64
import datetime
import glob
import hashlib
import html
import http.server
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE = os.path.join(HERE, "token.json")
# Lets the app manage your YouTube account (needed to create playlists).
SCOPE = "https://www.googleapis.com/auth/youtube"
API = "https://www.googleapis.com/youtube/v3"

# Approximate quota cost of each YouTube call (out of 10,000 units per day).
COST = {"search": 100, "playlist": 50, "item": 50}
units_used = 0

TRACKS = [
    ("Mr. Fingers", "Can You Feel It"),
    ("Kerri Chandler", "Rain"),
    ("Disclosure", "When a Fire Starts to Burn"),
    ("Crystal Waters", "Gypsy Woman (She's Homeless)"),
    ("Robin S", "Show Me Love"),
    ("Stardust", "Music Sounds Better with You"),
    ("Purple Disco Machine", "Hypnotized"),
    ("Peggy Gou", "(It Goes Like) Nanana"),
    ("Fred again..", "Jungle"),
    ("Moodymann", "Shades of Jae"),
    ("Bicep", "Glue"),
]

today = datetime.date.today()
TITLE = f"Trailmix · Indoor walk · Groove Miles · {today.day} {today.strftime('%b')}"
DESCRIPTION = "Indoor walk · Steady · 45 min · House. Made with Trailmix"


# ---------- small HTTP helpers ----------

def request(method, url, data=None, headers=None, form=False):
    headers = dict(headers or {})
    body = None
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"Google said {e.code}: {detail}") from None


# ---------- sign-in ----------

def load_client():
    files = glob.glob(os.path.join(HERE, "client_secret*.json"))
    if not files:
        sys.exit("Couldn't find the client_secret...json file in this folder. "
                 "Download it from Google Cloud (see README) and try again.")
    with open(files[0]) as f:
        return json.load(f)["installed"]


def sign_in(client):
    """Open the browser for Google sign-in and return token info."""
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    state = secrets.token_urlsafe(16)
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if "code" in query or "error" in query:
                result.update({k: v[0] for k, v in query.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h2>Done. You can close this tab and go back to Terminal.</h2>".encode())

        def log_message(self, *args):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    auth_url = client["auth_uri"] + "?" + urllib.parse.urlencode({
        "client_id": client["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "access_type": "offline",
        "prompt": "consent",
    })
    print("Opening your browser for Google sign-in...")
    print("(If it doesn't open, paste this link into your browser:)\n" + auth_url + "\n")
    webbrowser.open(auth_url)
    while not result:
        server.handle_request()
    server.server_close()

    if "error" in result:
        sys.exit(f"Sign-in was cancelled or failed: {result['error']}")
    if result.get("state") != state:
        sys.exit("Sign-in failed a security check (state mismatch). Please try again.")

    token = request("POST", client["token_uri"], form=True, data={
        "code": result["code"],
        "client_id": client["client_id"],
        "client_secret": client["client_secret"],
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "code_verifier": verifier,
    })
    save_token(token)
    return token


def save_token(token):
    token["expires_at"] = time.time() + token.get("expires_in", 3600) - 60
    with open(TOKEN_FILE, "w") as f:
        json.dump(token, f)
    os.chmod(TOKEN_FILE, 0o600)


def get_access_token(client):
    """Reuse a saved sign-in if possible, otherwise sign in again."""
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE) as f:
            token = json.load(f)
        if time.time() < token.get("expires_at", 0):
            return token["access_token"]
        if token.get("refresh_token"):
            try:
                fresh = request("POST", client["token_uri"], form=True, data={
                    "client_id": client["client_id"],
                    "client_secret": client["client_secret"],
                    "refresh_token": token["refresh_token"],
                    "grant_type": "refresh_token",
                })
                fresh.setdefault("refresh_token", token["refresh_token"])
                save_token(fresh)
                return fresh["access_token"]
            except RuntimeError:
                pass  # saved sign-in expired; fall through to a fresh one
    return sign_in(client)["access_token"]


# ---------- YouTube ----------

def youtube(method, path, access_token, params=None, body=None):
    url = f"{API}/{path}?" + urllib.parse.urlencode(params or {})
    return request(method, url, data=body,
                   headers={"Authorization": f"Bearer {access_token}"})


def find_video(artist, title, access_token):
    """Search YouTube and prefer the official audio / Music-category result."""
    global units_used
    items = []
    for extra in ({"videoCategoryId": "10"}, {}):  # Music category first, then anything
        units_used += COST["search"]
        items = youtube("GET", "search", access_token, {
            "part": "snippet", "type": "video", "maxResults": 5,
            "q": f"{artist} {title}", **extra,
        }).get("items", [])
        if items:
            break
    if not items:
        return None

    def score(item):
        sn = item["snippet"]
        channel = sn["channelTitle"].lower()
        name = html.unescape(sn["title"]).lower()
        s = 0
        if channel.endswith(" - topic"):  # YouTube's official auto-generated audio
            s += 3
        if "official audio" in name:
            s += 2
        if artist.lower() in channel:
            s += 1
        return s

    best = max(items, key=score)  # max keeps the first result on ties
    return best["id"]["videoId"], html.unescape(best["snippet"]["title"])


def main():
    global units_used
    client = load_client()
    token = get_access_token(client)

    print("Finding tracks on YouTube...")
    found, missing = [], []
    for i, (artist, title) in enumerate(TRACKS, 1):
        hit = find_video(artist, title, token)
        if hit:
            found.append(hit[0])
            print(f"  {i:2}. {artist} – {title}  →  {hit[1]}")
        else:
            missing.append(f"{artist} – {title}")
            print(f"  {i:2}. {artist} – {title}  →  NOT FOUND")

    print("\nCreating the playlist...")
    units_used += COST["playlist"]
    playlist = youtube("POST", "playlists", token, {"part": "snippet,status"}, {
        "snippet": {"title": TITLE, "description": DESCRIPTION},
        "status": {"privacyStatus": "unlisted"},
    })
    playlist_id = playlist["id"]

    print("Adding tracks in order...")
    for video_id in found:
        for attempt in range(3):  # YouTube occasionally hiccups on rapid adds
            try:
                units_used += COST["item"]
                youtube("POST", "playlistItems", token, {"part": "snippet"}, {
                    "snippet": {"playlistId": playlist_id,
                                "resourceId": {"kind": "youtube#video", "videoId": video_id}},
                })
                break
            except RuntimeError:
                if attempt == 2:
                    raise
                time.sleep(2)

    print("\n✅ Done!")
    print(f"Title: {TITLE}")
    print(f"YouTube Music: https://music.youtube.com/playlist?list={playlist_id}")
    print(f"YouTube:       https://www.youtube.com/playlist?list={playlist_id}")
    print(f"Tracks added:  {len(found)} of {len(TRACKS)}")
    if missing:
        print("Couldn't find:")
        for m in missing:
            print(f"  - {m}")
    print(f"Quota used:    about {units_used:,} of 10,000 daily units")


if __name__ == "__main__":
    main()
