# Spotify Stats & Purchase Web App

A web application that connects to Spotify's API to display user listening statistics and facilitate album purchases.

## Current Status: Phase 1 Complete

Phase 1 implements core Spotify authentication and connection testing.

---

## Setup Instructions

### 1. Register Your Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create App"
4. Fill in the details:
   - **App Name**: Spotify Stats & Purchase (or any name you prefer)
   - **App Description**: Web app for viewing listening stats and finding purchase options
   - **Redirect URI**: `http://127.0.0.1:3000/callback`
5. Accept the terms and click "Save"
6. You'll see your **Client ID** - copy this
7. Click "Show Client Secret" and copy the **Client Secret**

### 2. Configure Environment Variables

1. In the project root, create a `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_actual_client_id
   SPOTIFY_CLIENT_SECRET=your_actual_client_secret
   REDIRECT_URI=http://127.0.0.1:3000/callback
   PORT=3000
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
npm start
```

The app will be available at `http://127.0.0.1:3000` (or `http://localhost:3000` - they point to the same place)

---

## Testing Phase 1

1. Open `http://127.0.0.1:3000` in your browser
2. Click "Login with Spotify"
3. You'll be redirected to Spotify's authorization page
4. Click "Agree" to authorize the app
5. You'll be redirected back to the app
6. You should see:
   - Your Spotify profile picture
   - Your display name
   - Your email
   - A success message confirming the connection

**Phase 1 Deliverable**: ✅ User can log in with Spotify and see confirmation of connection

---

## Features Implemented (Phase 1)

- ✅ Express server with environment variable configuration
- ✅ Spotify OAuth 2.0 authorization flow
- ✅ Authorization callback handling
- ✅ Access token storage and refresh functionality
- ✅ Simple frontend with authentication button
- ✅ User profile API endpoint test
- ✅ Logout functionality
- ✅ Error handling and user feedback
- ✅ Responsive design

---

## Project Structure

```
spotify-stats-app/
├── server.js              # Express server with OAuth implementation
├── public/
│   ├── index.html        # Frontend HTML
│   ├── styles.css        # Spotify-themed styling
│   └── app.js            # Frontend JavaScript
├── .env                  # Environment variables (create this)
├── .env.example          # Environment template
├── package.json          # Dependencies
└── README.md            # This file
```

---

## Technical Details

### Authentication Flow

1. User clicks "Login with Spotify"
2. User is redirected to Spotify's authorization page
3. User authorizes the app with the `user-top-read` scope
4. Spotify redirects back with an authorization code
5. Server exchanges code for access token and refresh token
6. Tokens are stored in cookies
7. Access token is used for API calls
8. Token automatically refreshes when expired

### API Endpoints

- `GET /` - Serve the frontend
- `GET /login` - Initiate Spotify OAuth flow
- `GET /callback` - Handle OAuth callback
- `GET /refresh_token` - Refresh expired access token
- `GET /api/me` - Get current user's profile (test endpoint)
- `GET /logout` - Clear tokens and logout

### Security Notes

- State parameter validates OAuth callback
- Tokens stored in cookies (consider httpOnly and secure flags in production)
- Client secret never exposed to frontend
- Refresh token mechanism for session persistence

---

## Next Steps

Once Phase 1 is confirmed working, the following phases will be implemented:

- **Phase 2**: Display top artists & tracks with time range selector
- **Phase 3**: Add search-based purchase links (Bandcamp, Amazon, Apple Music)
- **Phase 4**: Aggregate and display top albums from track data
- **Phase 5**: Enhanced features (export, caching, filters, etc.)

---

## Troubleshooting

### "Invalid client" error
- Double-check your Client ID and Client Secret in `.env`
- Make sure there are no extra spaces in the values

### "Invalid redirect URI" error
- Ensure you added `http://127.0.0.1:3000/callback` to your app's Redirect URIs in the Spotify Dashboard
- Note: Spotify requires explicit loopback IPs (127.0.0.1), not "localhost"
- Make sure the REDIRECT_URI in `.env` exactly matches what's in the dashboard

### Port already in use
- Change the PORT in `.env` to a different number (e.g., 3001)
- Update the redirect URI in both `.env` and Spotify Dashboard accordingly (e.g., `http://127.0.0.1:3001/callback`)

### Module not found errors
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then run `npm install`

---

## Dependencies

- **express** - Web server framework
- **dotenv** - Environment variable management
- **axios** - HTTP client for API requests
- **cookie-parser** - Parse cookies for token storage

---

## License

MIT
