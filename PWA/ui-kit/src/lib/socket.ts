/**
 * Socket.IO client singleton.
 * Connects to same origin with path '/socket.io'.
 * JWT auth sent in handshake.auth.token (matches socketServer.ts).
 */
import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket | null {
  return socket
}

export function connectSocket(token: string, siteId: string): Socket {
  if (socket?.connected) return socket

  socket = io('/', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  })

  socket.on('connect', () => {
    socket?.emit('join-site', siteId)
  })

  socket.on('connect_error', (err: Error) => {
    console.warn('[socket] connect error:', err.message)
  })

  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
