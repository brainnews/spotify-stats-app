const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

dotenv.config();

// Access management imports
const { initializeDatabase } = require('./lib/db');
const accessService = require('./lib/access-service');
const notificationService = require('./lib/notification-service');

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

// =====================================
// Access Management Routes
// =====================================

// Validation schemas
const accessRequestSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(2).max(100)
});

// Simple rate limiting (in-memory, resets on server restart)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return next();
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests, please try again later' });
  }

  record.count++;
  next();
}

// Admin authentication middleware
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET_KEY);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ admin: true }, process.env.ADMIN_SECRET_KEY || 'dev-secret', {
    expiresIn: '24h'
  });

  res.json({ token });
});

// Submit access request
app.post('/api/access/request', rateLimit, async (req, res) => {
  try {
    const result = accessRequestSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid input', details: result.error.issues });
    }

    const { email, fullName } = result.data;
    const response = await accessService.submitAccessRequest(email, fullName);

    if (response.success) {
      res.status(response.isExisting ? 200 : 201).json(response);
    } else {
      res.status(409).json(response);
    }
  } catch (error) {
    console.error('Error submitting access request:', error);
    res.status(500).json({ error: 'Failed to submit access request' });
  }
});

// Check access status
app.get('/api/access/status/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const status = await accessService.getAccessStatus(email);

    if (!status) {
      return res.status(404).json({ error: 'No access request found for this email' });
    }

    res.json(status);
  } catch (error) {
    console.error('Error checking access status:', error);
    res.status(500).json({ error: 'Failed to check access status' });
  }
});

// Admin: Get queue status
app.get('/api/admin/access/queue', adminAuth, async (req, res) => {
  try {
    const queueStatus = await accessService.getQueueStatus();
    res.json(queueStatus);
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Admin: Get audit log
app.get('/api/admin/access/audit', adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action || null;

    const log = await accessService.getAuditLog(limit, offset, action);
    res.json(log);
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// Admin: Mark user as manually processed
app.post('/api/admin/access/manual/:id', adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { action } = req.body; // 'added' or 'removed'

    if (!['added', 'removed'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "added" or "removed"' });
    }

    await accessService.markManuallyProcessed(id, action);

    res.json({ success: true, message: `User marked as manually ${action}` });
  } catch (error) {
    console.error('Error marking manual processing:', error);
    res.status(500).json({ error: 'Failed to mark manual processing' });
  }
});

// Admin: Remove user
app.post('/api/admin/access/remove/:id', adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await accessService.markUserRemoved(id, 'admin');
    res.json({ success: true, message: 'User removed' });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

// Webhook endpoint for automation service
app.post('/api/webhook/automation', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.AUTOMATION_WEBHOOK_SECRET;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action, results } = req.body;

    // Process automation results
    for (const result of results || []) {
      if (result.action === 'added' && result.success) {
        await accessService.activateUser(result.requestId, result.slotNumber);
        // Get user info and send notification
        const status = await accessService.getAccessStatus(result.email);
        if (status) {
          await notificationService.sendAccessGrantedEmail({ email: result.email, full_name: result.fullName });
        }
      } else if (result.action === 'removed' && result.success) {
        await accessService.markUserExpired(result.requestId);
        await notificationService.sendAccessExpiredEmail({ email: result.email, full_name: result.fullName });
      } else if (!result.success) {
        const needsManual = await accessService.markAutomationFailed(result.requestId, result.error);
        if (needsManual) {
          await notificationService.notifyAdmin({
            type: 'Automation Failure',
            message: `Failed to process user after 3 attempts. Manual intervention required.`,
            user: { email: result.email, full_name: result.fullName },
            error: result.error
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing automation webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Initialize database and start server
async function startServer() {
  try {
    // Only initialize database if DATABASE_URL is configured
    if (process.env.DATABASE_URL) {
      await initializeDatabase();
      console.log('Database initialized');
    } else {
      console.log('DATABASE_URL not configured, access management disabled');
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Make sure to set your Spotify redirect URI to: ${REDIRECT_URI}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
