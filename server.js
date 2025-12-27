const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.static('public'));
app.use(express.json());

// Spotify API credentials
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/callback`;
const SCOPE = 'user-top-read';

// Generate random string for state
const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Route: Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route: Initiate Spotify login
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie('spotify_auth_state', state);

  const authURL = 'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: SCOPE,
      redirect_uri: REDIRECT_URI,
      state: state
    }).toString();

  res.redirect(authURL);
});

// Route: Spotify OAuth callback
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies['spotify_auth_state'] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#error=state_mismatch');
    return;
  }

  res.clearCookie('spotify_auth_state');

  try {
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }),
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Store tokens in cookies (in production, use secure httpOnly cookies)
    res.cookie('access_token', access_token, { maxAge: expires_in * 1000 });
    res.cookie('refresh_token', refresh_token, { maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days

    res.redirect('/#success');
  } catch (error) {
    console.error('Error during token exchange:', error.response?.data || error.message);
    res.redirect('/#error=invalid_token');
  }
});

// Route: Refresh access token
app.get('/refresh_token', async (req, res) => {
  const refresh_token = req.cookies?.refresh_token;

  if (!refresh_token) {
    return res.status(401).json({ error: 'No refresh token available' });
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      }),
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, expires_in } = response.data;
    res.cookie('access_token', access_token, { maxAge: expires_in * 1000 });
    res.json({ access_token });
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Route: Test API connection - get user profile
app.get('/api/me', async (req, res) => {
  const access_token = req.cookies?.access_token;

  if (!access_token) {
    return res.status(401).json({ error: 'No access token available' });
  }

  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Token expired', needsRefresh: true });
    }
    console.error('Error fetching user data:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Route: Get top artists
app.get('/api/top/artists', async (req, res) => {
  const access_token = req.cookies?.access_token;
  const time_range = req.query.time_range || 'medium_term'; // short_term, medium_term, long_term
  const limit = req.query.limit || 20;

  if (!access_token) {
    return res.status(401).json({ error: 'No access token available' });
  }

  try {
    const response = await axios.get('https://api.spotify.com/v1/me/top/artists', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      },
      params: {
        time_range: time_range,
        limit: limit
      }
    });

    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Token expired', needsRefresh: true });
    }
    console.error('Error fetching top artists:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch top artists' });
  }
});

// Route: Get top tracks
app.get('/api/top/tracks', async (req, res) => {
  const access_token = req.cookies?.access_token;
  const time_range = req.query.time_range || 'medium_term';
  const limit = req.query.limit || 20;

  if (!access_token) {
    return res.status(401).json({ error: 'No access token available' });
  }

  try {
    const response = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      },
      params: {
        time_range: time_range,
        limit: limit
      }
    });

    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Token expired', needsRefresh: true });
    }
    console.error('Error fetching top tracks:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch top tracks' });
  }
});

// Route: Logout
app.get('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Make sure to set your Spotify redirect URI to: ${REDIRECT_URI}`);
});
