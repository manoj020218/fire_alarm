# FireGuard — Deploy to a different / client VPS

The whole stack is config-driven. Moving to a client's production VPS (which has its
own MQTT broker + MongoDB) is a change-config-only exercise. No source edits required
except the optional white-label/branding items at the end.

## 1. Backend (`/root/projects/fire_guard/Backend/.env`)
Point these at the new VPS and restart (`pm2 restart fireguard-api`):

| Var | What to set |
|-----|-------------|
| `MONGODB_URI` | new VPS Mongo (e.g. `mongodb://fireguard_app:PASS@127.0.0.1:27017/fireguard?authSource=fireguard`) |
| `MQTT_BROKER_URL` | new VPS broker (e.g. `mqtt://127.0.0.1:1883`) |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | broker creds |
| `JWT_SECRET` | fresh 64-hex secret |
| `CORS_ORIGIN` / `SOCKET_CORS_ORIGIN` | new dashboard origin (e.g. `https://fireguard.CLIENT.com`) |
| `APP_LOGIN_URL` | `https://fireguard.CLIENT.com/app` |
| `OTA_BASE_URL` | `https://fireguard.CLIENT.com` (where firmware .bin is served) |
| `BILLING_BASE` / `BRIDGE_SECRET` | client billing platform + shared secret (or drop billing) |
| `GOOGLE_CLIENT_ID` | client's Google **web** OAuth client id (if using Google sign-in) |
| `FIREBASE_SERVICE_ACCOUNT_FILE` | path to client's Firebase service account (if using push) |
| `TRIAL_DAYS` | trial length (default 90) |

## 2. Dashboard (PWA/ui-kit)
Same-origin (`/api`, `/socket.io`) — **auto-adapts to whatever domain it is served from.**
Only build-time override if the client uses their own Google project:
```
VITE_GOOGLE_CLIENT_ID=<client-web-client-id> pnpm build   # base=/app/
```
Deploy `dist/` to the client's `/var/www/fireguard/app`.

## 3. Marketing (PWA/marketing) — white-label
Static HTML. For a client brand, change: signup/sign-in links (`fireguard.iotsoft.in` →
client domain), support WhatsApp/email, company name, and OAuth branding URLs.

## 4. Firmware — point a gateway at the new VPS
Two ways, **no recall needed**:
- **Per unit (no reflash):** connect to the gateway's WiFi AP portal → set `mqttHost`,
  `apiHost` (+ MQTT user/pass, siteId) → save. Stored in NVS.
- **Fleet default:** edit `Hardware/firmware/src/config/defaults.h`
  (`MQTT_HOST_PROD`, `API_HOST_PROD`), rebuild, and roll out via **OTA** (below).
  `env='prod'` in config selects the PROD hosts.

## 5. Infra on the new VPS
- DNS A-record → VPS IP; nginx vhost (`/`→marketing, `/app/`→dashboard, `/api/`+`/socket.io/`→:4070); certbot SSL.
- MongoDB DB + user; MQTT broker + device/app creds.
- `pm2 start` the backend, `pm2 save`.

## 6. OTA firmware update from the VPS (no hardware recall)
1. Build the new firmware → `.pio/build/fireguard/firmware.bin`.
2. Register a release (backend `FirmwareRelease` / device OTA endpoints) and place the
   `.bin` where `OTA_BASE_URL` serves it.
3. Gateways poll the OTA manifest daily (semver) **or** push an MQTT command
   `fireguard/{site}/{gw}/command` → `{ "cmd": "update" }` (or `"check"`).
4. Firmware does **OTA-with-backup**: downloads, flashes, boots new image, self-validates
   for 5 min; if it fails to check in, it **rolls back** to the previous image automatically.
   → safe remote updates, no truck roll.
