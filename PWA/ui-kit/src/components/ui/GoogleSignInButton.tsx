/**
 * GoogleSignInButton — renders the official Google Identity Services button and
 * returns the ID-token credential to the parent. Loads the GIS script on demand.
 * (Web only; hidden inside the native app, where GIS webview flows are blocked.)
 */
import { useEffect, useRef } from 'react'

interface GoogleCredentialResponse {
  credential: string
}

interface Props {
  clientId: string
  onCredential: (idToken: string) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string
            callback: (r: GoogleCredentialResponse) => void
          }) => void
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
        }
      }
    }
  }
}

const SRC = 'https://accounts.google.com/gsi/client'

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('gis load error')))
      return
    }
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gis load error'))
    document.head.appendChild(s)
  })
}

export default function GoogleSignInButton({ clientId, onCredential }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => onCredential(r.credential),
        })
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(ref.current.clientWidth || 300, 360),
        })
      })
      .catch(() => {
        /* offline or blocked — button just won't render */
      })
    return () => {
      cancelled = true
    }
  }, [clientId, onCredential])

  return <div ref={ref} className="flex justify-center" />
}
