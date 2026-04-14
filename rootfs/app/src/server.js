import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';
import { ScraperService } from './ScraperService.js';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const port = process.env.PORT || 3000;

// Data directories (Home Assistant addon compatible)
const DATA_DIR = process.env.DATA_DIR || '/data/data';
const SESSION_DIR = process.env.SESSION_DIR || '/data/session';

// Ensure directories exist
[DATA_DIR, SESSION_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Cache without TTL — we manage expiry manually via persisted state
const cache = new NodeCache({ stdTTL: 0, checkperiod: 0 });

// Max age for persisted data (hours). After this, stale data is discarded on startup.
const CACHE_MAX_AGE_HOURS = Number.parseInt(process.env.CACHE_MAX_AGE_HOURS) || 12;
const PERSISTED_STATE_FILE = path.join(DATA_DIR, 'last_known_state.json');

/**
 * Saves current cache to disk after a successful refresh
 */
function persistState(guests) {
  try {
    const state = {
      guests,
      rooms: extractRoomData(guests),
      savedAt: new Date().toISOString(),
      savedAtTimestamp: Date.now()
    };
    fs.writeFileSync(PERSISTED_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn(`[WARN] Could not persist state to disk: ${err.message}`);
  }
}

/**
 * Loads last known state from disk on startup if recent enough
 */
function loadPersistedState() {
  try {
    if (!fs.existsSync(PERSISTED_STATE_FILE)) return false;

    const state = JSON.parse(fs.readFileSync(PERSISTED_STATE_FILE, 'utf8'));
    const ageHours = (Date.now() - state.savedAtTimestamp) / 3600000;

    if (ageHours > CACHE_MAX_AGE_HOURS) {
      console.log(`[INFO] Persisted state is too old (${ageHours.toFixed(1)}h > ${CACHE_MAX_AGE_HOURS}h), ignoring.`);
      return false;
    }

    cache.set('guests', state.guests);
    cache.set('rooms', state.rooms);
    lastRefreshTime = state.savedAt;
    lastRefreshTimestamp = state.savedAtTimestamp;

    console.log(`[INFO] Loaded persisted state from disk (${ageHours.toFixed(1)}h ago): ${state.guests.length} guests`);
    return true;
  } catch (err) {
    console.warn(`[WARN] Could not load persisted state: ${err.message}`);
    return false;
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// State management
let isRefreshing = false;
let lastRefreshTime = null;
let lastRefreshTimestamp = null;
let lastError = null;
let twoFARequired = false;
let twoFAResolver = null;
let twoFATimeoutId = null;
let retryScheduled = null;        // Track scheduled retry attempt
let retryAttempts = 0;            // Counter for retry attempts
const MAX_RETRY_ATTEMPTS = 2;     // Maximum retry attempts (5 and 10 min)
const RETRY_INTERVALS = [5 * 60 * 1000, 10 * 60 * 1000]; // 5 and 10 minutes

// Time-based refresh schedule (intervals in minutes, hours in 0-23)
const REFRESH_SCHEDULE = {
  night:     { start: Number.parseInt(process.env.REFRESH_NIGHT_START)     || 22, interval: (Number.parseInt(process.env.REFRESH_NIGHT_INTERVAL)     || 180) * 60 * 1000 },
  morning:   { start: Number.parseInt(process.env.REFRESH_MORNING_START)   || 8,  interval: (Number.parseInt(process.env.REFRESH_MORNING_INTERVAL)   || 30)  * 60 * 1000 },
  afternoon: { start: Number.parseInt(process.env.REFRESH_AFTERNOON_START) || 14, interval: (Number.parseInt(process.env.REFRESH_AFTERNOON_INTERVAL) || 10)  * 60 * 1000 },
};

let autoRefreshTimer = null;

/**
 * Returns the current refresh interval in ms based on time of day
 */
function getCurrentRefreshInterval() {
  const hour = new Date().getHours();
  const { night, morning, afternoon } = REFRESH_SCHEDULE;

  if (hour >= afternoon.start && hour < night.start) return afternoon.interval; // 14h-22h
  if (hour >= morning.start && hour < afternoon.start) return morning.interval; // 08h-14h
  return night.interval;                                                         // 22h-08h
}

function getCurrentPeriodName() {
  const hour = new Date().getHours();
  const { night, morning, afternoon } = REFRESH_SCHEDULE;
  if (hour >= afternoon.start && hour < night.start) return 'après-midi/soirée';
  if (hour >= morning.start && hour < afternoon.start) return 'matin';
  return 'nuit';
}

/**
 * Schedules the next auto-refresh based on current time period
 */
function scheduleNextAutoRefresh() {
  if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
  const interval = getCurrentRefreshInterval();
  const minutes = Math.round(interval / 60 / 1000);
  console.log(`[INFO] Prochain refresh dans ${minutes} min (période: ${getCurrentPeriodName()})`);
  autoRefreshTimer = setTimeout(async () => {
    await refreshData();
    scheduleNextAutoRefresh();
  }, interval);
}

/**
 * Calculates seconds until the next refresh
 */
function getSecondsUntilNextRefresh() {
  if (!lastRefreshTimestamp) return Math.round(getCurrentRefreshInterval() / 1000);
  const elapsed = Date.now() - lastRefreshTimestamp;
  return Math.ceil(Math.max(0, getCurrentRefreshInterval() - elapsed) / 1000);
}

/**
 * Prompts for 2FA code - handles both interactive and Docker environments
 */
async function prompt2FACode(errorMessage = null) {
  // If stdin is not a TTY (Docker detached mode), wait for API submission
  if (!process.stdin.isTTY) {
    if (errorMessage) {
      console.log(`[ERROR] ${errorMessage}`);
    }
    console.log('[INFO] 2FA required. Use POST /api/2fa to submit the code.');
    twoFARequired = true;
    
    return new Promise((resolve) => {
      twoFAResolver = (code) => {
        twoFARequired = false;
        resolve(code);
      };
      
      // Set timeout only once per refresh attempt (not per prompt)
      if (!twoFATimeoutId) {
        twoFATimeoutId = setTimeout(() => {
          if (twoFAResolver) {
            twoFAResolver(''); // Return empty to fail gracefully
            twoFAResolver = null;
            twoFARequired = false;
            twoFATimeoutId = null;
            console.log('[ERROR] 2FA code submission timeout (5 minutes). Please retry with /api/refresh');
          }
        }, 5 * 60 * 1000);
      }
    });
  }
  
  // Interactive mode (CLI)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = errorMessage ? `[ERROR] ${errorMessage}\nEnter 2FA code: ` : 'Enter 2FA code: ';

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Schedules the next automatic retry after a failure
 */
function scheduleRetry() {
  // Cancel previous retry if exists
  if (retryScheduled) {
    clearTimeout(retryScheduled);
  }
  
  if (retryAttempts < MAX_RETRY_ATTEMPTS) {
    const delayMs = RETRY_INTERVALS[retryAttempts];
    const delayMinutes = delayMs / 60 / 1000;
    
    console.log(`[INFO] Scheduling automatic retry #${retryAttempts + 1} in ${delayMinutes} minutes...`);
    
    retryScheduled = setTimeout(() => {
      retryAttempts++;
      console.log(`[INFO] Attempting automatic retry #${retryAttempts} (${delayMinutes} minutes after failure)...`);
      refreshData();
    }, delayMs);
  }
}

/**
 * Fetches fresh data from Amenitiz
 */
async function refreshData() {
  if (isRefreshing) {
    console.log('[INFO] Refresh already in progress, skipping...');
    return;
  }

  isRefreshing = true;
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Starting data refresh...`);

  try {
    const scraper = new ScraperService({
      headless: process.env.HEADLESS !== 'false',
      screenshot: process.env.SCREENSHOT === 'true'
    });

    const guests = await scraper.scrape(prompt2FACode);
    
    cache.set('guests', guests);
    cache.set('rooms', extractRoomData(guests));
    persistState(guests);

    lastRefreshTime = new Date().toISOString();
    lastRefreshTimestamp = Date.now();
    lastError = null;
    retryAttempts = 0;
    
    // Cancel any scheduled retry
    if (retryScheduled) {
      clearTimeout(retryScheduled);
      retryScheduled = null;
    }
    
    // Clear 2FA state on success
    if (twoFATimeoutId) {
      clearTimeout(twoFATimeoutId);
      twoFATimeoutId = null;
    }
    twoFARequired = false;
    twoFAResolver = null;
    
    console.log(`[${lastRefreshTime}] Data refreshed successfully: ${guests.length} guests found`);
  } catch (error) {
    lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };
    console.error(`[${new Date().toISOString()}] Refresh failed: ${error.message}`);
    
    // Keep previous data intact (cache is preserved)
    const currentGuests = cache.get('guests');
    if (currentGuests) {
      console.log(`[INFO] Keeping previous data: ${currentGuests.length} guests`);
    }
    
    // Schedule automatic retries on failure
    scheduleRetry();

    // Clear 2FA state on failure
    if (twoFATimeoutId) {
      clearTimeout(twoFATimeoutId);
      twoFATimeoutId = null;
    }
    twoFARequired = false;
    twoFAResolver = null;
  } finally {
    isRefreshing = false;
  }
}

/**
 * Extracts room-specific data from guests
 */
function extractRoomData(guests) {
  const rooms = {};
  
  guests.forEach(guest => {
    if (!rooms[guest.roomType]) {
      rooms[guest.roomType] = [];
    }
    rooms[guest.roomType].push({
      name: guest.name,
      persons: guest.persons,
      dates: guest.dates,
      amountDue: guest.amountDue
    });
  });
  
  return rooms;
}

// API Endpoints

/**
 * GET /api/guests - Returns all guests for today
 */
app.get('/api/guests', (req, res) => {
  const guests = cache.get('guests');
  
  if (!guests) {
    return res.status(503).json({
      error: 'Data not available yet',
      message: 'Please wait for the first data refresh',
      lastError: lastError
    });
  }
  
  res.json({
    guests: guests,
    count: guests.length,
    lastRefreshTime: lastRefreshTime,
    nextRefreshIn: getSecondsUntilNextRefresh()
  });
});

/**
 * GET /api/rooms - Returns guests grouped by room type
 */
app.get('/api/rooms', (req, res) => {
  const rooms = cache.get('rooms');
  
  if (!rooms) {
    return res.status(503).json({
      error: 'Data not available yet',
      message: 'Please wait for the first data refresh',
      lastError: lastError
    });
  }
  
  res.json({
    rooms: rooms,
    lastRefreshTime: lastRefreshTime,
    nextRefreshIn: getSecondsUntilNextRefresh()
  });
});

/**
 * GET /api/status - Returns server and cache status
 */
app.get('/api/status', (req, res) => {
  const guests = cache.get('guests');
  let nextRetryIn = null;
  
  if (retryScheduled) {
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      const delayMs = RETRY_INTERVALS[retryAttempts];
      nextRetryIn = Math.ceil(delayMs / 1000);
    }
  }
  
  res.json({
    status: 'running',
    isRefreshing: isRefreshing,
    twoFARequired: twoFARequired,
    lastRefreshTime: lastRefreshTime,
    nextRefreshIn: getSecondsUntilNextRefresh(),
    cacheStatus: guests ? 'ready' : 'empty',
    guestCount: guests ? guests.length : 0,
    lastError: lastError,
    retryInfo: retryScheduled ? {
      scheduled: true,
      attemptNumber: retryAttempts + 1,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      nextRetryIn: nextRetryIn,
      message: `Automatic retry #${retryAttempts + 1} scheduled in ${Math.ceil(RETRY_INTERVALS[retryAttempts] / 1000 / 60)} minutes`
    } : null
  });
});

/**
 * GET /api/health - Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/2fa - Submit 2FA code for ongoing refresh
 */
app.post('/api/2fa', (req, res) => {
  const { code } = req.body;
  
  if (!code || !twoFAResolver) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'No 2FA code provided or no 2FA verification in progress'
    });
  }
  
  twoFAResolver(code);
  twoFAResolver = null;
  
  res.json({
    message: '2FA code submitted',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/refresh - Force a manual refresh
 */
app.post('/api/refresh', async (req, res) => {
  if (isRefreshing) {
    return res.status(429).json({
      error: 'Refresh already in progress',
      message: 'Please wait for the current refresh to complete'
    });
  }
  
  res.json({
    message: 'Refresh started',
    timestamp: new Date().toISOString()
  });
  
  // Start refresh in background
  refreshData();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[INFO] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('[INFO] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[INFO] Server closed');
    process.exit(0);
  });
});

// Start server
const server = app.listen(port, async () => {
  console.log(`[INFO] Server running on http://localhost:${port}`);
  console.log(`[INFO] Refresh schedule: nuit=${REFRESH_SCHEDULE.night.interval/60000}min (à partir de ${REFRESH_SCHEDULE.night.start}h), matin=${REFRESH_SCHEDULE.morning.interval/60000}min (à partir de ${REFRESH_SCHEDULE.morning.start}h), après-midi=${REFRESH_SCHEDULE.afternoon.interval/60000}min (à partir de ${REFRESH_SCHEDULE.afternoon.start}h)`);
  console.log('[INFO] Available endpoints:');
  console.log(`[INFO]   GET  http://localhost:${port}/api/guests   - Get all guests`);
  console.log(`[INFO]   GET  http://localhost:${port}/api/rooms    - Get guests by room`);
  console.log(`[INFO]   GET  http://localhost:${port}/api/status   - Get server status`);
  console.log(`[INFO]   GET  http://localhost:${port}/api/health   - Health check`);
  console.log(`[INFO]   POST http://localhost:${port}/api/refresh  - Force refresh`);
  console.log(`[INFO]   POST http://localhost:${port}/api/2fa      - Submit 2FA code`);

  // Restore last known state from disk before first scrape
  loadPersistedState();

  // Initial data fetch
  console.log('[INFO] Starting initial data fetch...');
  await refreshData();

  // Set up dynamic auto-refresh
  scheduleNextAutoRefresh();
});

export default app;
