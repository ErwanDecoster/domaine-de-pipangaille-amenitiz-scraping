import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';
import { ScraperService } from './ScraperService.js';
import readline from 'readline';

const app = express();
const port = process.env.PORT || 3000;

// Cache with 10-minute TTL (600 seconds)
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// Middleware
app.use(cors());
app.use(express.json());

// State management
let isRefreshing = false;
let lastRefreshTime = null;
let lastRefreshTimestamp = null;
let lastError = null;

// Refresh interval: 10 minutes
const REFRESH_INTERVAL = 10 * 60 * 1000;

/**
 * Calculates seconds until the next refresh
 */
function getSecondsUntilNextRefresh() {
  if (!lastRefreshTimestamp) {
    return REFRESH_INTERVAL / 1000;
  }
  
  const elapsedMs = Date.now() - lastRefreshTimestamp;
  const remainingMs = Math.max(0, REFRESH_INTERVAL - elapsedMs);
  return Math.ceil(remainingMs / 1000);
}

/**
 * Prompts for 2FA code via console
 */
async function prompt2FACode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter 2FA code: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Fetches fresh data from Amenitiz
 */
async function refreshData() {
  if (isRefreshing) {
    console.log('Refresh already in progress, skipping...');
    return;
  }

  isRefreshing = true;
  console.log(`[${new Date().toISOString()}] Starting data refresh...`);

  try {
    const scraper = new ScraperService({
      headless: process.env.HEADLESS !== 'false',
      screenshot: process.env.SCREENSHOT === 'true'
    });

    const guests = await scraper.scrape(prompt2FACode);
    
    cache.set('guests', guests);
    cache.set('rooms', extractRoomData(guests));
    
    lastRefreshTime = new Date().toISOString();
    lastRefreshTimestamp = Date.now();
    lastError = null;
    
    console.log(`[${lastRefreshTime}] Data refreshed successfully: ${guests.length} guests found`);
  } catch (error) {
    lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };
    console.error(`[${new Date().toISOString()}] Refresh failed:`, error.message);
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
  
  res.json({
    status: 'running',
    isRefreshing: isRefreshing,
    lastRefreshTime: lastRefreshTime,
    nextRefreshIn: getSecondsUntilNextRefresh(),
    cacheStatus: guests ? 'ready' : 'empty',
    guestCount: guests ? guests.length : 0,
    lastError: lastError
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

// Start server
app.listen(port, async () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Auto-refresh interval: ${REFRESH_INTERVAL / 1000} seconds (10 minutes)`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${port}/api/guests   - Get all guests`);
  console.log(`  GET  http://localhost:${port}/api/rooms    - Get guests by room`);
  console.log(`  GET  http://localhost:${port}/api/status   - Get server status`);
  console.log(`  GET  http://localhost:${port}/api/health   - Health check`);
  console.log(`  POST http://localhost:${port}/api/refresh  - Force refresh`);
  console.log('');
  
  // Initial data fetch
  console.log('Starting initial data fetch...');
  await refreshData();
  
  // Set up auto-refresh interval
  setInterval(refreshData, REFRESH_INTERVAL);
  console.log('Auto-refresh scheduled');
});
