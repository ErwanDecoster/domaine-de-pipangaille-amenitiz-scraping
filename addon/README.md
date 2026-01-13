# Domaine de Pipangaille - Guest Manager (Home Assistant Addon)

Home Assistant addon for retrieving guest information from Amenitiz booking platform via REST API. Perfect for home automation workflows and dashboard integrations.

## ✨ Features

- 🔗 **REST API** - Easy integration with Home Assistant
- 🔄 **Auto-refresh** - Updates every 10 minutes automatically
- 🔐 **Secure credentials** - Stored safely in Home Assistant secrets
- 🏠 **Home Assistant native** - UI configuration, logs, and health checks
- 📊 **Multiple data views** - All guests, by room, or room summary
- 🧹 **Automatic cleanup** - Old data files deleted automatically
- 🛡️ **Persistent sessions** - Avoids repeated 2FA prompts
- 📱 **Docker ready** - Works on all Home Assistant platforms (amd64, armv7, arm64, armhf)

## 🚀 Installation

### 1. Add Repository to Home Assistant

Open Home Assistant and go to:
**Settings > Devices & Services > Integrations > Create Automation > Developer tools**

Or use this link:
```
homeassistant://add-addon-repository/url/https://github.com/yourusername/domaine-de-pipangaille-rooms-scraping
```

### 2. Install the Addon

1. Go to **Settings > Add-ons > Add-on Store**
2. Search for "Domaine de Pipangaille"
3. Click **Install**
4. Wait for download and installation (2-5 minutes depending on your hardware)

### 3. Configure Addon

1. Open addon settings
2. Enter your **Amenitiz Email** and **Password**
3. Optionally adjust:
   - **Port**: 3000 (default)
   - **Headless mode**: true (recommended)
   - **Screenshots**: false (for debugging only)
   - **Data retention**: 7 days (0 to disable cleanup)
4. Click **Save**

### 4. Start the Addon

Click the **Start** button and wait 30-60 seconds for:
- Initial Amenitiz login
- First data fetch (may prompt for 2FA)
- API server ready

Check logs for successful startup:
```
[INFO] Server running on http://localhost:3000
[INFO] Data refreshed successfully: X guests found
```

## 📡 API Endpoints

All endpoints are available at `http://homeassistant.local:3000`:

### `GET /api/guests`
Returns all guests checking in today.

**Response:**
```json
{
  "guests": [
    {
      "name": "John Doe",
      "roomType": "Double Room",
      "persons": "2",
      "amountDue": "150.00 €",
      "dates": "01/01/2026 - 03/01/2026"
    }
  ],
  "count": 1,
  "lastRefreshTime": "2026-01-13T10:00:00.000Z",
  "nextRefreshIn": 300
}
```

### `GET /api/rooms`
Returns guests grouped by room type.

**Response:**
```json
{
  "rooms": {
    "Double Room": [
      {
        "name": "John Doe",
        "persons": "2",
        "dates": "01/01/2026 - 03/01/2026",
        "amountDue": "150.00 €"
      }
    ]
  },
  "lastRefreshTime": "2026-01-13T10:00:00.000Z",
  "nextRefreshIn": 300
}
```

### `GET /api/status`
Returns server and cache status.

**Response:**
```json
{
  "status": "running",
  "isRefreshing": false,
  "lastRefreshTime": "2026-01-13T10:00:00.000Z",
  "nextRefreshIn": 300,
  "cacheStatus": "ready",
  "guestCount": 5,
  "lastError": null
}
```

### `GET /api/health`
Health check endpoint (useful for monitoring).

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2026-01-13T10:00:00.000Z"
}
```

### `POST /api/refresh`
Force a manual data refresh (non-blocking).

**Response:**
```json
{
  "message": "Refresh started",
  "timestamp": "2026-01-13T10:00:00.000Z"
}
```

## 🏠 Home Assistant Integration

### Add REST Sensor

Add to your `configuration.yaml`:

```yaml
rest:
  - resource: http://localhost:3000/api/guests
    scan_interval: 600
    sensor:
      - name: "Pipangaille Guests"
        unique_id: pipangaille_guests_count
        value_template: "{{ value_json.count }}"
        json_attributes:
          - guests
          - lastRefreshTime
          - nextRefreshIn

      - name: "Pipangaille Last Update"
        unique_id: pipangaille_last_update
        value_template: "{{ value_json.lastRefreshTime }}"
```

Or using YAML UI:

1. **Settings > Devices & Services > Integrations**
2. Click **Create Automation**
3. Search for **"REST Sensor"**
4. Add configuration above

### Create Dashboard Card

```yaml
type: custom:auto-entities
filter:
  include:
    - entity_id: sensor.pipangaille_guests*
card:
  type: entities
  title: "Domaine de Pipangaille Guests"
  show_header_toggle: false
show_empty: false
```

### Template Sensor (List All Guests)

```yaml
template:
  - sensor:
      - name: "Pipangaille Guest Names"
        unique_id: pipangaille_guest_names
        state: "{{ state_attr('sensor.pipangaille_guests', 'guests') | length }}"
        attributes:
          guests: |
            {% set guests = state_attr('sensor.pipangaille_guests', 'guests') %}
            {% if guests %}
              {% for guest in guests %}
                - {{ guest.name }} ({{ guest.roomType }})
              {% endfor %}
            {% else %}
              No guests
            {% endif %}
```

## 🔧 Troubleshooting

### 2FA Code Prompt Not Appearing

**Problem:** Addon starts but immediately shows "2FA required but no code provider available"

**Solution:**
1. Stop the addon
2. Check logs - note the 2FA requirement
3. Unfortunately, addon environment can't provide interactive prompts
4. **Option A:** Delete `/data/session/cookies.json` in addon data folder and restart (then check logs during startup)
5. **Option B:** Run the CLI scraper on your computer first to save the session, then copy `session/cookies.json` to addon `/data/session/`

### Port Already in Use

**Problem:** Addon fails to start - "Port 3000 already in use"

**Solution:** Change the port in addon configuration:
1. Settings > Add-ons > Domaine de Pipangaille
2. Change "API Port" to 3001 or higher
3. Save and restart

### No Data Showing

**Problem:** API endpoints return "Data not available yet"

**Solution:**
1. Check addon logs for errors
2. Verify Amenitiz credentials are correct
3. Wait 30-60 seconds for first data fetch
4. If still failing, check Amenitiz website is accessible
5. Try forcing a refresh: `curl -X POST http://localhost:3000/api/refresh`

### Session Expired / 2FA Prompt Loop

**Problem:** Addon keeps asking for 2FA code

**Solution:**
1. Delete session data: Go to addon Info > Storage > delete `/data/session/`
2. Restart addon
3. Check logs during first startup

## 📊 Data Storage

Addon stores data in Home Assistant `/data/` directory:
- `/data/session/cookies.json` - Saved browser session
- `/data/data/` - Exported guest data (auto-cleaned after N days)
- `/data/screenshots/` - Debug screenshots (if enabled)

All data persists through addon restarts and Home Assistant updates.

## ⚙️ Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `amenitiz_email` | String | - | Your Amenitiz account email (required) |
| `amenitiz_password` | String | - | Your Amenitiz account password (required) |
| `port` | Integer | 3000 | REST API port (1-65535) |
| `headless` | Boolean | true | Run browser in headless mode |
| `screenshot` | Boolean | false | Save screenshots for debugging |
| `data_retention_days` | Integer | 7 | Keep exported files for N days (0 = never delete) |

## 🔐 Security

- ✅ **Credentials are secure** - Home Assistant encrypts them
- ✅ **Local network only** - API only accessible from your home network
- ✅ **No cloud services** - Everything runs locally
- ✅ **Session cookies are private** - Stored securely in addon data

**⚠️ WARNING:** Never share your Home Assistant URL or addon IP externally!

## 🔄 Auto-Refresh Behavior

- **Interval:** 10 minutes (600 seconds)
- **Initial fetch:** On addon startup
- **Session reuse:** Avoids 2FA on subsequent refreshes
- **Error handling:** Logs errors but continues running
- **Cache:** Data served instantly, refreshed in background

## 📝 Logs

View addon logs in:
**Settings > Add-ons > Domaine de Pipangaille > Logs**

Common log messages:
- `[INFO] Server running on http://localhost:3000` - Startup successful
- `[INFO] Data refreshed successfully: X guests found` - Refresh completed
- `[ERROR] Refresh failed: ...` - Login or scraping error
- `[INFO] Cleanup: Removed X file(s)...` - Old data deleted

## 🐛 Debug Mode

For debugging, enable screenshots:

1. Settings > Add-ons > Domaine de Pipangaille
2. Set "Enable Screenshots" to **on**
3. Save and restart

Screenshots are saved to `/data/screenshots/` and visible in addon storage:
- `1-login-form.png` - Login page
- `2-after-login.png` - After login (may be 2FA page)
- `2b-2fa-code.png` - 2FA code entry
- `3-dashboard.png` - Logged-in dashboard
- `3-arrivals.png` - Arrivals page with guest data

## 📞 Support

For issues or feature requests:
- Check logs first
- Try troubleshooting steps above
- Visit GitHub: https://github.com/yourusername/domaine-de-pipangaille-rooms-scraping

## 📄 License

ISC

---

**Developed for:** Domaine de Pipangaille
**Platform:** Home Assistant
**Status:** Stable
