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

1. `/api/top/tracks` returns user's top 40 tracks (limit increased for better album diversity)
2. `aggregateAndDisplayAlbums()` in `app.js` extracts album data from tracks
3. Groups by album ID, counts track occurrences per album
4. Sorts by count (albums with more top tracks rank higher)
5. Displays top 20 albums with track count metadata ("X tracks in your top 40")

**Why**: Spotify API doesn't provide a native "top albums" endpoint. This is the documented workaround.

### State Management & Persistence

**Time Range State**: Global `currentTimeRange` variable (values: `short_term`, `medium_term`, `long_term`). Changes trigger reload of all stats. Default: `short_term`, persisted in localStorage with key `timeRange`.

**Theme State**: Dark mode toggle in profile modal. Persisted in localStorage with key `theme` (values: `dark` or `light`). Default: dark mode for new users. Applied via `data-theme="dark"` attribute on `<html>`.

**Section Collapse State**: Uses `localStorage` to persist which sections (Artists/Albums/Tracks) are collapsed:
- Keys: `section-{sectionName}-collapsed` (boolean string)
- Restored on page load via `restoreSectionStates()`
- Managed by `toggleSection()` function

**Purchased Albums**: Tracks which albums user has marked as purchased:
- Stored in localStorage with key `purchasedAlbums` (JSON array of album IDs)
- Managed by `toggleAlbumPurchased(albumId)`, `getPurchasedAlbums()`, `savePurchasedAlbums()`
- Visual indicators: checkmark icon overlay and "Purchased" badge on album cards
- Can be reset via "Reset All Purchases" button in profile modal

**Display View State**: Grid view only (list view code exists but is disabled). Key: `displayView` in localStorage.

**Cached Tracks**: `cachedTracks` array stores most recent track data to avoid redundant aggregation when toggling album purchase status.

## Frontend Architecture

**Views**: Two mutually exclusive views controlled by `showView()`:
- `login-view`: Authentication screen
- `dashboard-view`: Stats display with three sections (artists/albums/tracks)

**Profile Modal**: Click user avatar to open modal with:
- Dark mode toggle
- Logout button
- Reset All Purchases button
- Managed by `openProfileModal()`, `closeProfileModal()`, closes on Escape key or backdrop click

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

**Theme System**: CSS custom properties in `:root` (light theme) and `[data-theme="dark"]` (dark theme). Includes colors for background, cards, text, borders, and shadows. Dark mode is default for new users.

**Sticky Header**: `.time-range-selector` has `position: sticky; top: 20px;` to remain visible during scroll.

**Collapsible Sections**: `.stats-section.collapsed` hides `.section-content` via `display: none`. Collapse icon rotates 90° using transform.

**Purchase Buttons**: Platform-specific colors defined in CSS:
- Bandcamp: `#629aa9` (teal)
- Amazon: `#ff9900` (orange)
- Apple Music: gradient `#fa233b` → `#fb5c74` (red)

Buttons use negative margins to extend to full card width.

**Purchased Albums**: Visual indicators for purchased albums:
- Green checkmark icon overlay (top-right of album image)
- "Purchased" badge with checkmark
- Semi-transparent overlay effect on album card
- Click icon/badge to toggle purchase status

## Common Pitfalls

1. **Redirect URI mismatch**: Spotify Dashboard must have EXACT match. Use `127.0.0.1`, not `localhost`.
2. **Missing token refresh**: All API calls must check for 401 and call `refreshToken()` before retry.
3. **Album aggregation timing**: `aggregateAndDisplayAlbums()` must be called AFTER tracks load, not in parallel.
4. **Section state persistence**: Always call `restoreSectionStates()` after showing dashboard view, otherwise localStorage won't apply.
5. **Theme persistence**: Theme is loaded in `loadSavedTheme()` on page load and toggled via checkbox in profile modal. Don't forget to update both the `data-theme` attribute and localStorage.
6. **Purchased albums reload**: When toggling album purchase status, call `aggregateAndDisplayAlbums(cachedTracks)` to refresh UI without re-fetching data.

## Spotify API Constraints

- **No play count data**: API doesn't expose how many times user played an artist/track
- **No top albums endpoint**: Must aggregate from tracks
- **Rate limits**: Development mode has lower limits
- **Scope required**: `user-top-read` for all stats endpoints

## Files to Modify for Common Tasks

**Add new stat section**:
1. Add HTML in `index.html` (follow existing section pattern in dashboard-view)
2. Add container reference in `app.js` (top of file with other DOM elements)
3. Add display function following `displayTopArtists()` or `displayTopTracks()` pattern
4. Add to `restoreSectionStates()` array if collapsible (line ~58)
5. Call display function from `loadStats()` if needed on time range change

**Add new time range**:
1. Add button in `index.html` with `data-range` attribute in `.time-range-selector`
2. Spotify accepts: short_term (4 weeks), medium_term (6 months), long_term (years)
3. Default is controlled by `currentTimeRange` initialization (line ~20 in app.js)

**Change purchase platforms**:
1. Modify `generatePurchaseLinks()` return object in `app.js` (line ~451)
2. Update `createPurchaseButtons()` template in `app.js` (line ~463)
3. Update CSS color definitions in `styles.css` for `.purchase-btn` variants

**Add new localStorage preference**:
1. Add getter/setter functions following patterns like `getPurchasedAlbums()`/`savePurchasedAlbums()`
2. Call getter in appropriate load function
3. Call setter when value changes
4. Restore in `restoreUserPreferences()` if needed on page load

**Modify theme**:
1. Update CSS custom properties in `:root` (light theme) and `[data-theme="dark"]` (dark theme) in `styles.css`
2. Theme toggle logic is in `setTheme()` and `loadSavedTheme()` functions
