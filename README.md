# Clipd

**How well do you know your Spotify playlists?**

Clipd is a quiz game that plays short audio clips from songs in your Spotify playlists and challenges you to identify them. Log in, pick a playlist, and find out which songs you really know — and which ones you just skip past.

## Features

- 🎵 Hear 1-second clips from your playlist songs
- 🔍 Fuzzy autocomplete search over all songs in the playlist
- 📈 Extend clips to 3s → 5s → full 30-second preview if you're stuck
- 📊 Full breakdown by tier at the end
- 🖼 Shareable stats image (copy to clipboard or download)

## Setup

### 1. Create a Spotify App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create app**
3. Set the app name (e.g. "Clipd") and description
4. Add your redirect URI:
   - For local dev: `http://localhost:5173`
   - For production: `https://your-site.netlify.app`
5. Copy the **Client ID**

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
VITE_REDIRECT_URI=http://localhost:5173
```

### 3. Install and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Deploy to Netlify

### Option A: Connect GitHub repo (recommended)

1. Push this repo to GitHub
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
3. Connect your GitHub repo
4. Netlify auto-detects the build settings from `netlify.toml`
5. Before deploying, set environment variables (see below)

### Option B: Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### Setting environment variables in Netlify

1. Go to your site in the Netlify dashboard
2. **Site settings** → **Environment variables**
3. Add the following variables:
   - `VITE_SPOTIFY_CLIENT_ID` — your Spotify app's Client ID
   - `VITE_REDIRECT_URI` — your Netlify site URL (e.g. `https://clipd.netlify.app`)
4. Trigger a redeploy for the variables to take effect

**Important:** Also add your Netlify site URL as a redirect URI in your Spotify app dashboard (under the app settings → Redirect URIs).

## Tech stack

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Fuse.js](https://fusejs.io) — fuzzy search
- [html2canvas](https://html2canvas.hertzen.com) — stats image export
- Spotify Web API (PKCE auth, no backend required)
- Web Audio API — precise clip playback

## Notes

- Songs without a Spotify preview URL are skipped (Spotify doesn't provide previews for all tracks)
- No Spotify Premium required — preview URLs are free 30-second MP3 clips
- All data is client-side; nothing is stored on a server
