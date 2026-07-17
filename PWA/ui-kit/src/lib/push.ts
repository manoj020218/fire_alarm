/**
 * Native push registration (FCM via Capacitor).
 *
 * The dashboard is loaded remotely inside the FireGuard Android app (Capacitor
 * server.url). When running natively, we ask for notification permission, get an
 * FCM token, and register it with the backend so the server can push alarm alerts.
 * On the web this is a no-op (guarded by Capacitor.isNativePlatform()).
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { api } from './api'

const TOKEN_KEY = 'fg_push_token'
let started = false

export async function initPush(): Promise<void> {
  if (started) return
  if (!Capacitor.isNativePlatform()) return
  started = true
  try {
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') {
      started = false
      return
    }

    // High-importance channel so alarm pushes alert loudly (Android O+).
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'fireguard_alarms',
          name: 'Alarms',
          description: 'Critical fire-system alarms and faults',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        })
      } catch {
        /* channel API unavailable — default channel will be used */
      }
    }

    await PushNotifications.addListener('registration', async (token) => {
      try {
        localStorage.setItem(TOKEN_KEY, token.value)
        await api.post('/push/register', { token: token.value, platform: Capacitor.getPlatform() })
      } catch {
        /* will retry on next app open */
      }
    })

    await PushNotifications.addListener('registrationError', () => {
      started = false
    })

    // Tapping a notification could deep-link; for now just bring the app forward.
    await PushNotifications.addListener('pushNotificationActionPerformed', () => {
      if (location.pathname.indexOf('/alarms') === -1) {
        location.assign('/app/alarms')
      }
    })

    await PushNotifications.register()
  } catch {
    started = false
  }
}

/** Best-effort: tell the backend to forget this device's token (on logout). */
export async function unregisterPush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return
  try {
    await api.post('/push/unregister', { token })
  } catch {
    /* ignore */
  }
  localStorage.removeItem(TOKEN_KEY)
}
