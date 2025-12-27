// DOM elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');

const userAvatar = document.getElementById('user-avatar');

const topArtistsContainer = document.getElementById('top-artists');
const topAlbumsContainer = document.getElementById('top-albums');
const topTracksContainer = document.getElementById('top-tracks');
const timeRangeButtons = document.querySelectorAll('.time-range-btn');
const themeToggle = document.getElementById('theme-toggle');
const gridViewBtn = document.getElementById('display-view-btn');
const listViewBtn = document.getElementById('list-view-btn');

// State
let currentTimeRange = localStorage.getItem('timeRange') || 'short_term';
let cachedTracks = [];
let currentView = localStorage.getItem('displayView') || 'grid'; // 'grid' or 'list'

// Theme Management
function setTheme(isDark) {
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';
    setTheme(isDark);
    if (themeToggle) {
        themeToggle.checked = isDark;
    }
}

// Collapsible sections
function toggleSection(sectionName) {
    const section = document.querySelector(`[data-section="${sectionName}"]`);
    if (!section) return;

    section.classList.toggle('collapsed');

    // Save state to localStorage
    const isCollapsed = section.classList.contains('collapsed');
    localStorage.setItem(`section-${sectionName}-collapsed`, isCollapsed);
}

// Restore section states from localStorage
function restoreSectionStates() {
    ['artists', 'albums', 'tracks'].forEach(sectionName => {
        const isCollapsed = localStorage.getItem(`section-${sectionName}-collapsed`) === 'true';
        if (isCollapsed) {
            const section = document.querySelector(`[data-section="${sectionName}"]`);
            if (section) {
                section.classList.add('collapsed');
            }
        }
    });
}

// Restore user preferences from localStorage
function restoreUserPreferences() {
    // Restore time range
    timeRangeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.range === currentTimeRange) {
            btn.classList.add('active');
        }
    });

    // Restore display view
    if (currentView === 'list') {
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
    } else {
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    }
}

// Check URL hash for OAuth callback status
window.addEventListener('load', () => {
    // Load saved theme
    loadSavedTheme();

    // Restore user preferences (time range and display view)
    restoreUserPreferences();

    const hash = window.location.hash.substring(1);

    if (hash === 'success') {
        // Clear the hash
        history.replaceState(null, null, ' ');
        // Load user data
        loadUserData();
    } else if (hash.startsWith('error=')) {
        const error = hash.split('=')[1];
        showError(getErrorMessage(error));
        showView('login');
    } else {
        // Check if user already has tokens
        checkAuthStatus();
    }
});

// Event listeners
loginBtn.addEventListener('click', () => {
    window.location.href = '/login';
});

logoutBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/logout';
    }
});

// Theme toggle event listener
if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
        setTheme(e.target.checked);
    });
}

// Time range selector event listeners
timeRangeButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Update active button
        timeRangeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update time range and reload data
        currentTimeRange = button.dataset.range;
        localStorage.setItem('timeRange', currentTimeRange);
        loadStats();
    });
});

// View toggle event listeners
if (gridViewBtn) {
    gridViewBtn.addEventListener('click', () => {
        currentView = 'grid';
        localStorage.setItem('displayView', currentView);
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        loadStats();
    });
}

if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
        currentView = 'list';
        localStorage.setItem('displayView', currentView);
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        loadStats();
    });
}

// Check if user is already authenticated
async function checkAuthStatus() {
    try {
        showLoading(true);
        const response = await fetch('/api/me');

        if (response.ok) {
            const userData = await response.json();
            displayUserData(userData);
            showView('dashboard');
            restoreSectionStates();
            loadStats();
        } else if (response.status === 401) {
            const data = await response.json();
            if (data.needsRefresh) {
                await refreshToken();
                checkAuthStatus();
            } else {
                showView('login');
            }
        } else {
            showView('login');
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showView('login');
    } finally {
        showLoading(false);
    }
}

// Load user data from Spotify API
async function loadUserData() {
    try {
        showLoading(true);
        const response = await fetch('/api/me');

        if (response.ok) {
            const userData = await response.json();
            displayUserData(userData);
            showView('dashboard');
            restoreSectionStates();
            loadStats();
        } else if (response.status === 401) {
            const data = await response.json();
            if (data.needsRefresh) {
                await refreshToken();
                loadUserData();
            } else {
                showError('Authentication failed. Please login again.');
                showView('login');
            }
        } else {
            showError('Failed to load user data. Please try again.');
            showView('login');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showError('An error occurred. Please try again.');
        showView('login');
    } finally {
        showLoading(false);
    }
}

// Refresh access token
async function refreshToken() {
    try {
        const response = await fetch('/refresh_token');
        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }
        return await response.json();
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}

// Display user data
function displayUserData(user) {
    if (user.images && user.images.length > 0) {
        userAvatar.src = user.images[0].url;
        userAvatar.alt = user.display_name || 'User avatar';
    } else {
        userAvatar.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23B3B3B3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';
        userAvatar.alt = 'User avatar';
    }
}

// Show/hide views
function showView(view) {
    loginView.classList.add('hidden');
    dashboardView.classList.add('hidden');

    if (view === 'login') {
        loginView.classList.remove('hidden');
    } else if (view === 'dashboard') {
        dashboardView.classList.remove('hidden');
    }
}

// Show/hide loading indicator
function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');

    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}

// Get user-friendly error message
function getErrorMessage(error) {
    const messages = {
        'state_mismatch': 'Security validation failed. Please try again.',
        'invalid_token': 'Failed to authenticate with Spotify. Please try again.',
        'access_denied': 'You denied access to your Spotify account.'
    };

    return messages[error] || 'An error occurred during login. Please try again.';
}

// Load stats (artists and tracks)
async function loadStats() {
    await Promise.all([
        loadTopArtists(),
        loadTopTracks()
    ]);
}

// Fetch and display top artists
async function loadTopArtists() {
    try {
        const response = await fetch(`/api/top/artists?time_range=${currentTimeRange}&limit=20`);

        if (response.ok) {
            const data = await response.json();
            displayTopArtists(data.items);
        } else if (response.status === 401) {
            const data = await response.json();
            if (data.needsRefresh) {
                await refreshToken();
                loadTopArtists();
            }
        } else {
            console.error('Failed to load top artists');
            topArtistsContainer.innerHTML = '<div class="empty-state"><h3>Failed to load artists</h3><p>Please try again later</p></div>';
        }
    } catch (error) {
        console.error('Error loading top artists:', error);
        topArtistsContainer.innerHTML = '<div class="empty-state"><h3>Failed to load artists</h3><p>Please try again later</p></div>';
    }
}

// Fetch and display top tracks
async function loadTopTracks() {
    try {
        const response = await fetch(`/api/top/tracks?time_range=${currentTimeRange}&limit=20`);

        if (response.ok) {
            const data = await response.json();
            cachedTracks = data.items;
            displayTopTracks(data.items);
            aggregateAndDisplayAlbums(data.items);
        } else if (response.status === 401) {
            const data = await response.json();
            if (data.needsRefresh) {
                await refreshToken();
                loadTopTracks();
            }
        } else {
            console.error('Failed to load top tracks');
            topTracksContainer.innerHTML = '<div class="empty-state"><h3>Failed to load tracks</h3><p>Please try again later</p></div>';
        }
    } catch (error) {
        console.error('Error loading top tracks:', error);
        topTracksContainer.innerHTML = '<div class="empty-state"><h3>Failed to load tracks</h3><p>Please try again later</p></div>';
    }
}

// Format large numbers (e.g., 1234567 -> "1.2M", 45678 -> "46k")
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
        return Math.round(num / 1000) + 'k';
    }
    return num.toString();
}

// Generate purchase links
function generatePurchaseLinks(artist, album = null) {
    const searchQuery = album ? `${artist} ${album}` : artist;
    const encodedQuery = encodeURIComponent(searchQuery);

    return {
        bandcamp: `https://bandcamp.com/search?q=${encodedQuery}`,
        amazon: `https://www.amazon.com/s?k=${encodedQuery}&i=digital-music`,
        apple: `https://music.apple.com/us/search?term=${encodedQuery}`
    };
}

// Create purchase buttons HTML
function createPurchaseButtons(links, type = 'artist') {
    return `
        <div class="purchase-links">
            <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${links.bandcamp}', '_blank')" title="Search on Bandcamp">
                <span class="btn-label">Bandcamp</span>
            </button>
            <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${links.amazon}', '_blank')" title="Search on Amazon Music">
                <span class="btn-label">Amazon</span>
            </button>
            <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${links.apple}', '_blank')" title="Search on Apple Music">
                <span class="btn-label">Apple</span>
            </button>
        </div>
    `;
}

// Display top artists
function displayTopArtists(artists) {
    if (!artists || artists.length === 0) {
        topArtistsContainer.innerHTML = '<div class="empty-state"><h3>No artists found</h3><p>Start listening to music to see your top artists!</p></div>';
        return;
    }

    // Update container class based on view
    topArtistsContainer.className = currentView === 'list' ? 'list section-content' : 'grid section-content';

    if (currentView === 'list') {
        topArtistsContainer.innerHTML = artists.map((artist, index) => {
            const imageUrl = artist.images && artist.images.length > 0
                ? artist.images[0].url
                : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23B3B3B3"><circle cx="12" cy="12" r="10"/></svg>';

            const purchaseLinks = generatePurchaseLinks(artist.name);
            const popularity = artist.popularity || 0;

            return `
                <div class="list-row artist-card">
                    <div class="list-row-rank">${index + 1}</div>
                    <img src="${imageUrl}" alt="${artist.name}" class="list-row-image" onclick="window.open('${artist.external_urls.spotify}', '_blank')">
                    <div class="list-row-info" onclick="window.open('${artist.external_urls.spotify}', '_blank')">
                        <div class="list-row-title">${artist.name}</div>
                    </div>
                    <div class="list-row-meta">
                        <div class="list-row-stat">
                            <div class="list-row-stat-value">${popularity}</div>
                            <div class="list-row-stat-label">Popularity</div>
                        </div>
                    </div>
                    <div class="list-row-actions">
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.bandcamp}', '_blank')">Bandcamp</button>
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.amazon}', '_blank')">Amazon</button>
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.apple}', '_blank')">Apple</button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        topArtistsContainer.innerHTML = artists.map((artist, index) => {
            const imageUrl = artist.images && artist.images.length > 0
                ? artist.images[0].url
                : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23B3B3B3"><circle cx="12" cy="12" r="10"/></svg>';

            const purchaseLinks = generatePurchaseLinks(artist.name);

            return `
                <div class="card artist-card">
                    <div class="card-content" onclick="window.open('${artist.external_urls.spotify}', '_blank')">
                        <span class="card-rank">${index + 1}</span>
                        <img src="${imageUrl}" alt="${artist.name}" class="card-image">
                        <div class="card-title">${artist.name}</div>
                    </div>
                    ${createPurchaseButtons(purchaseLinks, 'artist')}
                </div>
            `;
        }).join('');
    }
}

// Display top tracks
function displayTopTracks(tracks) {
    if (!tracks || tracks.length === 0) {
        topTracksContainer.innerHTML = '<div class="empty-state"><h3>No tracks found</h3><p>Start listening to music to see your top tracks!</p></div>';
        return;
    }

    // Update container class based on view
    topTracksContainer.className = currentView === 'list' ? 'list section-content' : 'grid section-content';

    if (currentView === 'list') {
        topTracksContainer.innerHTML = tracks.map((track, index) => {
            const imageUrl = track.album && track.album.images && track.album.images.length > 0
                ? track.album.images[0].url
                : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23B3B3B3"><rect width="24" height="24"/></svg>';

            const artistNames = track.artists.map(artist => artist.name).join(', ');
            const primaryArtist = track.artists[0].name;
            const albumName = track.album.name;
            const popularity = track.popularity || 0;

            const purchaseLinks = generatePurchaseLinks(primaryArtist, albumName);

            return `
                <div class="list-row track-card">
                    <div class="list-row-rank">${index + 1}</div>
                    <img src="${imageUrl}" alt="${track.name}" class="list-row-image" onclick="window.open('${track.external_urls.spotify}', '_blank')">
                    <div class="list-row-info" onclick="window.open('${track.external_urls.spotify}', '_blank')">
                        <div class="list-row-title">${track.name}</div>
                        <div class="list-row-subtitle">${artistNames} • ${albumName}</div>
                    </div>
                    <div class="list-row-meta">
                        <div class="list-row-stat">
                            <div class="list-row-stat-value">${popularity}</div>
                            <div class="list-row-stat-label">Popularity</div>
                        </div>
                    </div>
                    <div class="list-row-actions">
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.bandcamp}', '_blank')">Bandcamp</button>
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.amazon}', '_blank')">Amazon</button>
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.apple}', '_blank')">Apple</button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        topTracksContainer.innerHTML = tracks.map((track, index) => {
            const imageUrl = track.album && track.album.images && track.album.images.length > 0
                ? track.album.images[0].url
                : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23B3B3B3"><rect width="24" height="24"/></svg>';

            const artistNames = track.artists.map(artist => artist.name).join(', ');
            const primaryArtist = track.artists[0].name;
            const albumName = track.album.name;

            const purchaseLinks = generatePurchaseLinks(primaryArtist, albumName);

            return `
                <div class="card track-card">
                    <div class="card-content" onclick="window.open('${track.external_urls.spotify}', '_blank')">
                        <span class="card-rank">${index + 1}</span>
                        <img src="${imageUrl}" alt="${track.name}" class="card-image">
                        <div class="card-title">${track.name}</div>
                        <div class="card-subtitle">${artistNames}</div>
                    </div>
                    ${createPurchaseButtons(purchaseLinks, 'track')}
                </div>
            `;
        }).join('');
    }
}

// Aggregate albums from tracks and display
function aggregateAndDisplayAlbums(tracks) {
    if (!tracks || tracks.length === 0) {
        topAlbumsContainer.innerHTML = '<div class="empty-state"><h3>No albums found</h3><p>Start listening to music to see your top albums!</p></div>';
        return;
    }

    // Create a map to count tracks per album
    const albumMap = new Map();

    tracks.forEach(track => {
        const album = track.album;
        const albumId = album.id;

        if (albumMap.has(albumId)) {
            albumMap.get(albumId).trackCount++;
        } else {
            albumMap.set(albumId, {
                id: albumId,
                name: album.name,
                artist: album.artists[0].name,
                imageUrl: album.images && album.images.length > 0 ? album.images[0].url : '',
                spotifyUrl: album.external_urls.spotify,
                trackCount: 1
            });
        }
    });

    // Convert map to array and sort by track count
    const albums = Array.from(albumMap.values())
        .sort((a, b) => b.trackCount - a.trackCount)
        .slice(0, 20); // Top 20 albums

    displayTopAlbums(albums);
}

// Display top albums
function displayTopAlbums(albums) {
    if (!albums || albums.length === 0) {
        topAlbumsContainer.innerHTML = '<div class="empty-state"><h3>No albums found</h3><p>Start listening to music to see your top albums!</p></div>';
        return;
    }

    // Update container class based on view
    topAlbumsContainer.className = currentView === 'list' ? 'list section-content' : 'grid section-content';

    if (currentView === 'list') {
        topAlbumsContainer.innerHTML = albums.map((album, index) => {
            const imageUrl = album.imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23B3B3B3"><rect width="24" height="24"/></svg>';
            const purchaseLinks = generatePurchaseLinks(album.artist, album.name);
            const trackCountText = album.trackCount === 1 ? '1 track' : `${album.trackCount} tracks`;

            return `
                <div class="list-row album-card">
                    <div class="list-row-rank">${index + 1}</div>
                    <img src="${imageUrl}" alt="${album.name}" class="list-row-image" onclick="window.open('${album.spotifyUrl}', '_blank')">
                    <div class="list-row-info" onclick="window.open('${album.spotifyUrl}', '_blank')">
                        <div class="list-row-title">${album.name}</div>
                        <div class="list-row-subtitle">${album.artist}</div>
                    </div>
                    <div class="list-row-meta">
                        <div class="list-row-stat">
                            <div class="list-row-stat-value">${album.trackCount}</div>
                            <div class="list-row-stat-label">In Top 20</div>
                        </div>
                    </div>
                    <div class="list-row-actions">
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.bandcamp}', '_blank')">Bandcamp</button>
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.amazon}', '_blank')">Amazon</button>
                        <button class="purchase-btn" onclick="event.stopPropagation(); window.open('${purchaseLinks.apple}', '_blank')">Apple</button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        topAlbumsContainer.innerHTML = albums.map((album, index) => {
            const imageUrl = album.imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23B3B3B3"><rect width="24" height="24"/></svg>';
            const purchaseLinks = generatePurchaseLinks(album.artist, album.name);
            const trackCountText = album.trackCount === 1 ? '1 track in your top 20' : `${album.trackCount} tracks in your top 20`;

            return `
                <div class="card album-card">
                    <div class="card-content" onclick="window.open('${album.spotifyUrl}', '_blank')">
                        <span class="card-rank">${index + 1}</span>
                        <img src="${imageUrl}" alt="${album.name}" class="card-image">
                        <div class="card-title">${album.name}</div>
                        <div class="card-subtitle">${album.artist}</div>
                        <div class="card-meta">${trackCountText}</div>
                    </div>
                    ${createPurchaseButtons(purchaseLinks, 'album')}
                </div>
            `;
        }).join('');
    }
}
