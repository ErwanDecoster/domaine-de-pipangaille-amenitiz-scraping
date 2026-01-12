# API Documentation

## Domaine de Pipangaille - Guest Information API

REST API for retrieving guest information from Amenitiz booking platform. Designed for Home Assistant integration with automatic 10-minute refresh cycle.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file:

```env
AMENITIZ_EMAIL=your-email@example.com
AMENITIZ_PASSWORD=your-password
HEADLESS=true
SCREENSHOT=false
PORT=3000
```

### 3. Start the API Server

```bash
npm start
```

The server will:
- Start on port 3000 (or PORT from .env)
- Perform initial data fetch
- Auto-refresh every 10 minutes
- Prompt for 2FA code if required (first run or session expired)

## API Endpoints

### GET /api/guests

Returns all guests checking in today.

**Response:**
```json
{
  "guests": [
    {
      "name": "John Doe",
      "roomType": "Chambre Double",
      "persons": "2",
      "amountDue": "150.00 €",
      "dates": "01/01/2024 - 03/01/2024"
    }
  ],
  "count": 1,
  "lastRefreshTime": "2024-01-01T10:00:00.000Z",
  "nextRefreshIn": 600
}
```

**Home Assistant Configuration:**

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

### GET /api/rooms

Returns guests grouped by room type.

**Response:**
```json
{
  "rooms": {
    "Chambre Double": [
      {
        "name": "John Doe",
        "persons": "2",
        "dates": "01/01/2024 - 03/01/2024",
        "amountDue": "150.00 €"
      }
    ]
  },
  "lastRefreshTime": "2024-01-01T10:00:00.000Z",
  "nextRefreshIn": 600
}
```

**Home Assistant Configuration:**

```yaml
sensor:
  - platform: rest
    name: "Pipangaille Rooms"
    resource: "http://YOUR_SERVER_IP:3000/api/rooms"
    method: GET
    scan_interval: 600
    value_template: "{{ value_json.rooms | length }}"
    json_attributes:
      - rooms
      - lastRefreshTime
```

### GET /api/status

Returns server and cache status.

**Response:**
```json
{
  "status": "running",
  "isRefreshing": false,
  "lastRefreshTime": "2024-01-01T10:00:00.000Z",
  "nextRefreshIn": 600,
  "cacheStatus": "ready",
  "guestCount": 5,
  "lastError": null
}
```

### GET /api/health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

### POST /api/refresh

Force a manual data refresh (non-blocking).

**Response:**
```json
{
  "message": "Refresh started",
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

## Auto-Refresh Behavior

- **Interval:** 10 minutes (600 seconds)
- **First Run:** Fetches data immediately on startup
- **Session Management:** Reuses cookies to avoid 2FA when possible
- **2FA Handling:** Prompts via console when session expires
- **Error Handling:** Logs errors but continues running

## CLI Mode

You can still run the scraper manually:

```bash
npm run scrape
```

This will:
- Fetch current guest data
- Export to `data/guests-YYYY-MM-DD.json` and `.txt`
- Close after completion

## Error Handling

If data is not available (503 response):
```json
{
  "error": "Data not available yet",
  "message": "Please wait for the first data refresh",
  "lastError": {
    "message": "Login failed",
    "timestamp": "2024-01-01T10:00:00.000Z"
  }
}
```

## Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/server.js --name pipangaille-api
pm2 save
pm2 startup
```

### Using systemd

Create `/etc/systemd/system/pipangaille-api.service`:

```ini
[Unit]
Description=Pipangaille Guest API
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/domaine-de-pipangaille-rooms-scraping
ExecStart=/usr/bin/node src/server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable pipangaille-api
sudo systemctl start pipangaille-api
```

## Security Notes

- **Local Network Only:** Do not expose to the internet
- **No Authentication:** Designed for trusted local network access
- **Credentials:** Store in `.env` file (not in version control)
- **2FA:** Required on first run or when session expires

## Troubleshooting

### 2FA Prompt Not Appearing

If running as a service, 2FA prompt won't work. Solution:
1. Run manually first: `npm start`
2. Complete 2FA authentication
3. Session will be saved in `session/cookies.json`
4. Service can now use saved session

### Data Not Refreshing

Check logs:
```bash
pm2 logs pipangaille-api  # if using PM2
journalctl -u pipangaille-api -f  # if using systemd
```

### Port Already in Use

Change port in `.env`:
```env
PORT=3001
```

## Home Assistant Integration Example

Full configuration example:

```yaml
# configuration.yaml
sensor:
  - platform: rest
    name: "Pipangaille Guest Count"
    resource: "http://192.168.1.100:3000/api/guests"
    method: GET
    scan_interval: 600
    value_template: "{{ value_json.count }}"
    json_attributes:
      - guests
      - lastRefreshTime
    
  - platform: rest
    name: "Pipangaille API Status"
    resource: "http://192.168.1.100:3000/api/status"
    method: GET
    scan_interval: 60
    value_template: "{{ value_json.status }}"
    json_attributes:
      - guestCount
      - lastRefreshTime
      - cacheStatus

template:
  - sensor:
      - name: "Pipangaille Guests List"
        state: "{{ state_attr('sensor.pipangaille_guest_count', 'guests') | length }}"
        attributes:
          guests: >
            {% set guests = state_attr('sensor.pipangaille_guest_count', 'guests') %}
            {% if guests %}
              {{ guests | map(attribute='name') | join(', ') }}
            {% else %}
              No guests
            {% endif %}
```

## API Response Times

- **Cached Data:** < 10ms
- **Fresh Data Fetch:** 10-30 seconds (includes browser automation)
- **With 2FA:** Additional 30-60 seconds (manual input)

## Rate Limiting

No rate limiting implemented. Designed for:
- Single Home Assistant instance
- Poll every 10 minutes
- Trusted local network access
