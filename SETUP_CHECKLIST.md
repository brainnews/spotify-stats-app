# Phase 1 Setup Checklist

Follow these steps to test Phase 1:

## ☐ Step 1: Register Spotify App (5 minutes)

1. Visit https://developer.spotify.com/dashboard
2. Login with your Spotify account
3. Click "Create App"
4. Fill in:
   - App name: `Spotify Stats & Purchase`
   - App description: `Listening stats and purchase links`
   - Redirect URI: `http://127.0.0.1:3000/callback` ⚠️ IMPORTANT (Note: Use 127.0.0.1, not localhost)
5. Save and copy your **Client ID** and **Client Secret**

## ☐ Step 2: Create .env File (1 minute)

In the project root (`/Users/miles/Projects/spotify-stats-app`), create a file named `.env`:

```bash
SPOTIFY_CLIENT_ID=paste_your_client_id_here
SPOTIFY_CLIENT_SECRET=paste_your_client_secret_here
REDIRECT_URI=http://127.0.0.1:3000/callback
PORT=3000
```

## ☐ Step 3: Start the Server (30 seconds)

```bash
cd /Users/miles/Projects/spotify-stats-app
npm start
```

You should see:
```
Server running on http://localhost:3000
Make sure to set your Spotify redirect URI to: http://127.0.0.1:3000/callback
```

## ☐ Step 4: Test Authentication (1 minute)

1. Open http://127.0.0.1:3000 (or http://localhost:3000) in your browser
2. Click "Login with Spotify"
3. Authorize the app on Spotify's page
4. You should be redirected back and see:
   - ✅ Your profile picture
   - ✅ Your display name
   - ✅ Your email
   - ✅ "Successfully connected to Spotify!" message

## 🎉 Phase 1 Complete!

If you see your profile information, Phase 1 is working perfectly!

## Troubleshooting

**Can't see .env file?**
- On Mac/Linux: Files starting with `.` are hidden
- Create it with: `touch .env && open .env` (Mac) or `nano .env` (Linux)

**"Invalid client" error?**
- Check your Client ID and Secret in `.env` (no extra spaces)

**"Invalid redirect URI" error?**
- In Spotify Dashboard, edit your app settings
- Make sure `http://127.0.0.1:3000/callback` is in the Redirect URIs list
- Important: Spotify requires 127.0.0.1, NOT "localhost"
- Click Save

**Port 3000 already in use?**
- Change `PORT=3001` in `.env`
- Update redirect URI to `http://127.0.0.1:3001/callback` in both `.env` AND Spotify Dashboard
