# Trailmix

Personal iPhone web app (invite-only beta) that turns a gym routine plus a mood into a YouTube Music playlist.

## Milestone 0: prove the save works

`make_playlist.py` is a small throwaway script that signs in to Google, finds 11 test tracks on YouTube and saves them, in order, to a new **unlisted** playlist in your account. It uses only Python's built-in libraries (macOS ships with `python3`), so there's nothing to install.

### One-time setup

1. In [Google Cloud Console](https://console.cloud.google.com), create a project called **Trailmix**.
2. Enable **YouTube Data API v3**.
3. Set up the OAuth consent screen: External, Testing mode, app name Trailmix, and add your own Google account as a test user.
4. Create an OAuth client of type **Desktop app**, download its JSON and put it in this folder. Keep the name it downloads with, which starts with `client_secret`.

### Run it

```
python3 make_playlist.py
```

Your browser opens for Google sign-in. Afterwards the script prints the playlist link, any tracks it couldn't find and roughly how much of the 10,000-unit daily YouTube quota it used (about 1,700).

### Secrets

The client JSON (`client_secret*.json`), the saved sign-in (`token.json`) and any `.env*` files are listed in `.gitignore` and never get committed.
