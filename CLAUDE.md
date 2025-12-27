# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spotify Stats & Purchase is a web application that displays user listening statistics from Spotify and provides purchase links to Bandcamp, Amazon Music, and Apple Music for discovered music.

**Architecture**: Classic client-server split with vanilla JavaScript frontend and Express backend.

## Development Commands

```bash
# Start the development server (runs on port 3000 by default)
npm start
# or
npm run dev

# Install dependencies
npm install
```

## Environment Setup

**Critical**: The app requires Spotify API credentials configured in `.env`:

1. Register app at https://developer.spotify.com/dashboard
2. Copy `.env.example` to `.env`
3. Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
4. Set `REDIRECT_URI=http://127.0.0.1:3000/callback` (must use 127.0.0.1, not localhost, per Spotify's new requirements)
5. Add redirect URI to Spotify Dashboard settings

## Architecture & Data Flow

### OAuth Flow (Backend → Frontend → Spotify → Backend)

1. User clicks login → `/login` endpoint generates state token and redirects to Spotify
2. Spotify authorization → callback to `/callback` with auth code
3. Backend exchanges code for access + refresh tokens → stores in cookies
4. Frontend receives redirect with `#success` hash → loads user data

**Token Management**: Access tokens stored in cookies (1hr expiry). Refresh tokens automatically used when access token expires. Frontend handles 401 responses by calling `/refresh_token` endpoint.

### Data Aggregation Pattern

The app has NO direct backend endpoint for "top albums". Albums are **client-side aggregated** from top tracks:

1. `/api/top/tracks` returns user's top 20 tracks
2. `aggregateAndDisplayAlbums()` in `app.js` extracts album data from tracks
3. Groups by album ID, counts track occurrences per album
4. Sorts by count (albums with more top tracks rank higher)
5. Displays top 20 albums

**Why**: Spotify API doesn't provide a native "top albums" endpoint. This is the documented workaround.

### State Management & Persistence

**Time Range State**: Global `currentTimeRange` variable (values: `short_term`, `medium_term`, `long_term`). Changes trigger reload of all stats.

**Section Collapse State**: Uses `localStorage` to persist which sections (Artists/Albums/Tracks) are collapsed:
- Keys: `section-{sectionName}-collapsed` (boolean string)
- Restored on page load via `restoreSectionStates()`
- Managed by `toggleSection()` function

**Cached Tracks**: `cachedTracks` array stores most recent track data to avoid redundant aggregation.

## Frontend Architecture

**Views**: Two mutually exclusive views controlled by `showView()`:
- `login-view`: Authentication screen
- `dashboard-view`: Stats display with three sections (artists/albums/tracks)

**No Framework**: Vanilla JS with direct DOM manipulation. All rendering uses template literals with `.innerHTML`.

**Purchase Links**: Generated client-side via `generatePurchaseLinks(artist, album?)`:
- Bandcamp: `https://bandcamp.com/search?q={encoded}`
- Amazon: `https://www.amazon.com/s?k={encoded}&i=digital-music`
- Apple Music: `https://music.apple.com/us/search?term={encoded}`

Links open in new tabs and use proper `encodeURIComponent()`.

## Backend API Endpoints

```
GET  /                      Serve index.html
GET  /login                 Initiate OAuth (redirects to Spotify)
GET  /callback              OAuth callback handler
GET  /refresh_token         Refresh expired access token
GET  /api/me                Get user profile
GET  /api/top/artists       Get top artists (query: time_range, limit)
GET  /api/top/tracks        Get top tracks (query: time_range, limit)
GET  /logout                Clear auth cookies
```

**Query Parameters**: All `/api/top/*` endpoints accept:
- `time_range`: short_term | medium_term | long_term (default: medium_term)
- `limit`: number (default: 20)

## Styling Notes

**Sticky Header**: `.time-range-selector` has `position: sticky; top: 20px;` to remain visible during scroll.

**Collapsible Sections**: `.stats-section.collapsed` hides `.section-content` via `display: none`. Collapse icon rotates 90° using transform.

**Purchase Buttons**: Platform-specific colors defined in CSS:
- Bandcamp: `#629aa9` (teal)
- Amazon: `#ff9900` (orange)
- Apple Music: gradient `#fa233b` → `#fb5c74` (red)

Buttons use negative margins to extend to full card width.

## Common Pitfalls

1. **Redirect URI mismatch**: Spotify Dashboard must have EXACT match. Use `127.0.0.1`, not `localhost`.
2. **Missing token refresh**: All API calls must check for 401 and call `refreshToken()` before retry.
3. **Album aggregation timing**: `aggregateAndDisplayAlbums()` must be called AFTER tracks load, not in parallel.
4. **Section state persistence**: Always call `restoreSectionStates()` after showing dashboard view, otherwise localStorage won't apply.

## Spotify API Constraints

- **No play count data**: API doesn't expose how many times user played an artist/track
- **No top albums endpoint**: Must aggregate from tracks
- **Rate limits**: Development mode has lower limits
- **Scope required**: `user-top-read` for all stats endpoints

## Files to Modify for Common Tasks

**Add new stat section**:
1. Add HTML in `index.html` (follow existing section pattern)
2. Add container reference in `app.js` (top of file)
3. Add display function following `displayTopArtists()` pattern
4. Add to `restoreSectionStates()` array if collapsible

**Add new time range**:
1. Add button in `index.html` with `data-range` attribute
2. Spotify accepts: short_term (4 weeks), medium_term (6 months), long_term (years)

**Change purchase platforms**:
Modify `generatePurchaseLinks()` return object and `createPurchaseButtons()` template in `app.js`.
