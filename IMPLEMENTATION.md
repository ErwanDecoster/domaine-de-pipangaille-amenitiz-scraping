# Implementation Summary - REST API for Home Assistant

## ✅ Implementation Complete

The Amenitiz scraper has been successfully transformed into a REST API suitable for Home Assistant integration.

## 📦 What Was Created

### 1. **ScraperService.js** - Reusable Scraping Logic
   - Extracted from CLI code
   - Handles browser automation, login, 2FA, and data extraction
   - Returns data instead of writing to files
   - Can be used by both CLI and API

### 2. **server.js** - REST API Server
   - Express server with CORS support
   - NodeCache for 10-minute data caching
   - Auto-refresh every 10 minutes
   - Non-blocking refresh operations
   - 5 API endpoints (see below)

### 3. **API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/guests` | GET | All guests checking in today |
| `/api/rooms` | GET | Guests grouped by room type |
| `/api/status` | GET | Server and cache status |
| `/api/health` | GET | Health check |
| `/api/refresh` | POST | Force manual refresh |

### 4. **Updated Documentation**
   - `README.md` - Updated with API mode instructions
   - `API.md` - Complete API documentation with Home Assistant examples
   - `.env.example` - Added PORT configuration

### 5. **Updated Configuration**
   - `package.json` - New scripts: `start` (API), `scrape` (CLI)
   - Version bumped to 2.0.0

## 🚀 How to Use

### Start the API Server

```bash
npm start
```

The server will:
1. Start on port 3000 (configurable via `PORT` in `.env`)
2. Perform initial data fetch (may prompt for 2FA)
3. Auto-refresh every 10 minutes
4. Serve data via REST endpoints

### Test the API

```bash
# Get all guests
curl http://localhost:3000/api/guests

# Get server status
curl http://localhost:3000/api/status

# Force refresh
curl -X POST http://localhost:3000/api/refresh
```

### Home Assistant Integration

Add to `configuration.yaml`:

```yaml
sensor:
  - platform: rest
    name: "Pipangaille Guests"
    resource: "http://YOUR_SERVER_IP:3000/api/guests"
    method: GET
    scan_interval: 600  # 10 minutes
    value_template: "{{ value_json.count }}"
    json_attributes:
      - guests
      - lastRefreshTime
```

## 🔄 Auto-Refresh Behavior

- **Interval:** 10 minutes (600 seconds)
- **Initial fetch:** On startup
- **Session management:** Reuses cookies, prompts for 2FA only when needed
- **Error handling:** Continues running even if refresh fails
- **Logging:** All operations logged to console

## 📁 Project Structure

```
domaine-de-pipangaille-rooms-scraping/
├── src/
│   ├── server.js          # ⭐ NEW: REST API server
│   ├── cli.js             # (renamed from index.js)
│   ├── ScraperService.js  # ⭐ NEW: Reusable scraping service
│   └── SessionManager.js  # (unchanged)
├── API.md                 # ⭐ NEW: Complete API documentation
├── README.md              # ✏️ UPDATED: API mode instructions
├── .env.example           # ✏️ UPDATED: Added PORT
└── package.json           # ✏️ UPDATED: New scripts, v2.0.0
```

## 🎯 Key Features

- ✅ **Auto-refresh:** Data updates every 10 minutes automatically
- ✅ **Caching:** Instant API responses (data served from cache)
- ✅ **Session persistence:** Avoids repeated 2FA prompts
- ✅ **Home Assistant ready:** Direct integration examples provided
- ✅ **Backward compatible:** CLI mode still available (`npm run scrape`)
- ✅ **Production ready:** PM2 and systemd examples included
- ✅ **Error resilient:** Continues running even if scraping fails

## 🔐 Security Notes

- **Local network only** - Do not expose to internet
- **No authentication** - Designed for trusted local access
- **Credentials in .env** - Never commit credentials
- **Session cookies** - Stored locally in `session/`

## 📖 Documentation

- **[README.md](README.md)** - Quick start, installation, usage
- **[API.md](API.md)** - Complete API documentation, Home Assistant integration, deployment

## 🎉 Ready to Use

The API is fully functional and ready for Home Assistant integration. Simply:

1. Configure `.env` with credentials
2. Run `npm start`
3. Add sensor to Home Assistant configuration
4. Enjoy automatic guest information updates!

## 📞 Support

See `API.md` for:
- Complete endpoint documentation
- Home Assistant configuration examples
- Production deployment guides (PM2, systemd)
- Troubleshooting guides
