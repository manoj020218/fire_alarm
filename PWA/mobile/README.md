# FireGuard Mobile (Capacitor Android)

Native Android wrapper around the FireGuard dashboard PWA at https://fireguard.iotsoft.in/app.
The app loads the live dashboard, so it's always current; login/signup/telemetry all work via
the same-origin API + Socket.IO.

- appId: `in.iotsoft.fireguard`  ·  appName: FireGuard

## Build the APK
```
pnpm install --config.strict-ssl=false        # (add NODE_TLS_REJECT_UNAUTHORIZED=0 behind corp proxy)
npx cap add android                            # first time only
# ensure android/local.properties has: sdk.dir=<Android SDK path>
cd android && ./gradlew assembleDebug          # -> app/build/outputs/apk/debug/app-debug.apk
```
Requires JDK 17 + Android SDK.

## TODO
- Release build + signing key for Play Store.
- Push notifications (FCM): add @capacitor/push-notifications + a Firebase project
  (google-services.json) + backend FCM send on critical alarms.
- App icon / splash branding (currently Capacitor defaults).
