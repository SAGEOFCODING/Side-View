# SideView

SideView is a peer-to-peer (P2P) WebRTC video conferencing application built with Next.js, Socket.io, and PeerJS. It features a modern, frameless, draggable UI with support for multi-user video chat and screen sharing.

## Features
- **P2P Video & Audio**: Ultra-low latency communication via WebRTC.
- **Screen Sharing**: Native screen sharing with system audio capture.
- **Glassmorphic UI**: Beautiful, draggable framer-motion video overlays.
- **Multi-user Rooms**: Support for up to 5 users per room automatically negotiated.
- **NAT Traversal**: Dedicated TURN/STUN fallback via Metered to bypass strict corporate firewalls.

## Architecture

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Zustand, Framer Motion.
- **Backend**: Express.js, Socket.io (for room discovery/signaling), PeerJS Server (for WebRTC handshake brokering).
- **Deployment**:
  - Frontend hosted on Vercel.
  - Backend hosted on Render.

## Local Development

### 1. Setup Backend
```bash
cd backend
npm install
npm run dev
```
The backend signaling server will start on `http://localhost:8080`.

### 2. Setup Frontend
Ensure you have the `.env.local` file configured for local development:
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
```
Then run the frontend:
```bash
cd frontend
npm install
npm run dev
```
The frontend will start on `http://localhost:3000`. Open it in your browser and create a room!

## Production Deployment

- If deploying the backend to serverless environments (like Cloud Run), ensure you enforce session affinity and restrict scaling to 1 instance if using in-memory room storage, OR swap `const rooms = {}` with a Redis adapter.
- Next.js can be easily deployed to Vercel via standard Git push.
