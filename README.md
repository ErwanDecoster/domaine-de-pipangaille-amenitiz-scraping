# Domaine de Pipangaille - Rooms Scraping API

REST API Docker to fetch reservation information from the **Amenitiz** platform in real-time. Perfect for integration with **Home Assistant** or any residential automation system.

## 🎯 About

This project uses **Puppeteer** (Chromium headless) to scrape reservation data from the Amenitiz dashboard and exposes it via a simple REST API. Ideal for automating guest arrivals/departures management.

## ✨ Features

- 🔗 **REST API** - Simple JSON endpoints
- 🔄 **Auto-refresh** - Updates data every 10 minutes
- 🔐 **Persistent sessions** - Saves cookies to avoid repeated logins
- 🛡️ **2FA support** - Handles two-factor authentication via API
- 📊 **Multiple views** - All guests, grouped by room
- 🧹 **Auto cleanup** - Removes old files based on `DATA_RETENTION_DAYS`
- 🐳 **Docker** - Multi-architecture support (amd64, armv7, arm64, armhf)
- 📱 **Home Assistant ready** - Configuration via JSON file

## 🚀 Quick Start

### Requirements

- Docker
- Amenitiz credentials (email + password)

### Installation

1. **Clone the repository :**
   ```bash
   git clone https://github.com/erwandecoster/domaine-de-pipangaille-rooms-scraping.git
   cd domaine-de-pipangaille-rooms-scraping
   ```

2. **Build the Docker image :**
   ```bash
   docker build -t pipangaille-addon .
   ```

3. **Create the config file :**
   ```bash
   mkdir -p data
   cat > data/options.json << 'EOF'
   {
     "amenitiz_email": "your-email@example.com",
     "amenitiz_password": "your-password",
     "port": 3000,
     "headless": true,
     "screenshot": false,
     "data_retention_days": 7
   }
   EOF
   ```

4. **Run the container :**
   ```bash
   docker run -d \
     --name pipangaille \
     -p 3000:3000 \
     -v $(pwd)/data:/data \
     pipangaille-addon
   ```

5. **Check startup :**
   ```bash
   docker logs -f pipangaille
   ```

   Wait for these messages:
   ```
   [INFO] Server running on http://localhost:3000
   [INFO] Data refreshed successfully: X guests found
   ```

## 📡 API Endpoints

All endpoints are available at `http://localhost:3000` (or the configured port).

### `GET /api/guests`
Returns all current guests.

**Response :**
```json
{
  "guests": [
    {
      "name": "John Doe",
      "roomType": "Double Room",
      "persons": "2",
      "amountDue": "150.00 €",
      "dates": "13/01/2026 - 15/01/2026"
    }
  ],
  "count": 1,
  "lastRefreshTime": "2026-01-13T10:15:00.000Z",
  "nextRefreshIn": 450
}
```

### `GET /api/rooms`
Returns guests grouped by room type.

**Response :**
```json
{
  "rooms": {
    "Double Room": [
      {
        "name": "John Doe",
        "persons": "2",
        "dates": "13/01/2026 - 15/01/2026",
        "amountDue": "150.00 €"
      }
    ],
    "Suite": [
      {
        "name": "Jane Smith",
        "persons": "3",
        "dates": "14/01/2026 - 16/01/2026",
        "amountDue": "250.00 €"
      }
    ]
  },
  "lastRefreshTime": "2026-01-13T10:15:00.000Z",
  "nextRefreshIn": 450
}
```

### `GET /api/status`
Returns server and cache status.

**Response :**
```json
{
  "status": "running",
  "isRefreshing": false,
  "twoFARequired": false,
  "lastRefreshTime": "2026-01-13T10:15:00.000Z",
  "nextRefreshIn": 450,
  "cacheStatus": "ready",
  "guestCount": 5,
  "lastError": null
}
```

### `GET /api/health`
Health check for monitoring.

**Response :**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2026-01-13T10:15:00.000Z"
}
```

### `POST /api/refresh`
Force a manual refresh (non-blocking).

**Response :**
```json
{
  "message": "Refresh started",
  "timestamp": "2026-01-13T10:15:00.000Z"
}
```

### `POST /api/2fa`
Submit a 2FA code during a login attempt.

**Body :**
```json
{
  "code": "123456"
}
```

**Response :**
```json
{
  "message": "2FA code submitted",
  "timestamp": "2026-01-13T10:15:00.000Z"
}
```

## ⚙️ Configuration

The `/data/options.json` file controls the behavior:

```json
{
  "amenitiz_email": "your-email@example.com",
  "amenitiz_password": "your-password",
  "port": 3000,
  "headless": true,
  "screenshot": false,
  "data_retention_days": 7
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `amenitiz_email` | String | - | Amenitiz account email (required) |
| `amenitiz_password` | String | - | Amenitiz password (required) |
| `port` | Integer | 3000 | API port |
| `headless` | Boolean | true | Headless browser mode |
| `screenshot` | Boolean | false | Enable screenshots (debug) |
| `data_retention_days` | Integer | 7 | Data retention days (0 = never delete) |

**Environment variables** : You can also override via env vars:
```bash
docker run -e AMENITIZ_EMAIL=user@example.com -e AMENITIZ_PASSWORD=pwd ...
```

## 📁 Data Structure

The container stores data in `/data/`:

```
/data/
├── options.json          # Configuration file
├── session/
│   └── cookies.json      # Saved Amenitiz session
├── data/                 # Exported data files
└── screenshots/          # Screenshots (if enabled)
```

## 🔄 Refresh Behavior

- **Interval** : 10 minutes (600 seconds)
- **Startup** : On container launch
- **Session** : Reused to avoid repeated 2FA
- **Errors** : Logged but server continues
- **Cache** : Served instantly, refreshed in background

## 🔐 Security

- ✅ Credentials are never logged
- ✅ Sessions are stored locally
- ⚠️ API is exposed on the local network
- ⚠️ Do not expose without authentication on the Internet

## 🐛 Troubleshooting

### Error "Amenitiz email and password not configured"

Check that `/data/options.json` contains the correct credentials:

```bash
cat /data/options.json
```

### Container asks for 2FA code but doesn't receive response

In detached mode (Docker), the API expects the code via `POST /api/2fa`:

```bash
curl -X POST http://localhost:3000/api/2fa \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

Or delete the saved session and restart:

```bash
rm -rf data/session/cookies.json
docker restart pipangaille
```

### "Data not available yet"

This is normal on first startup. Wait 30-60 seconds for the initial request to complete. Check the logs:

```bash
docker logs pipangaille
```

### Port already in use

Change the port in `options.json` or via `-p`:

```bash
docker run -p 3001:3000 ...
```

## 🔧 Development

### Architecture

- **server.js** : Express API + cache management + 2FA state
- **ScraperService.js** : Puppeteer scraper with cookie and 2FA handling
- **SessionManager.js** : Amenitiz cookie persistence

### Tech Stack

- Node.js 24
- Express 5
- Puppeteer (Chromium headless)
- node-cache
- CORS

### Logs

Check container logs:

```bash
docker logs -f pipangaille
```

Main log messages:

```
[INFO] Server running on http://localhost:3000
[INFO] Auto-refresh interval: 600 seconds (10 minutes)
[INFO] Starting initial data fetch...
[INFO] Data refreshed successfully: 5 guests found
[ERROR] Refresh failed: <message>
[WARN] Cleanup skipped for /data/data/...
```

## 📊 Home Assistant Integration Example

Use the `REST` integration:

```yaml
rest:
  - resource: http://homeassistant.local:3000/api/guests
    scan_interval: 600
    sensor:
      - name: "Pipangaille Guests Count"
        unique_id: pipangaille_guests_count
        value_template: "{{ value_json.count }}"
        json_attributes:
          - guests
          - lastRefreshTime
```

Then access the data via:

```
sensor.pipangaille_guests_count
```

## 📄 License

ISC

---

**Developed for :** Domaine de Pipangaille  
**GitHub :** https://github.com/erwandecoster/domaine-de-pipangaille-rooms-scraping
