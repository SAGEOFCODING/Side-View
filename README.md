# SideView: Next-Generation P2P Video Conferencing

SideView is a high-performance, peer-to-peer (P2P) WebRTC video conferencing application designed for seamless, ultra-low latency communication. Built with a modern tech stack including Next.js, Socket.io, and PeerJS, SideView delivers a frameless, draggable, glassmorphic UI that feels native and unobtrusive. 

Whether you're running it in the browser or via the dedicated Electron desktop wrapper, SideView supports multi-user video chat and robust screen sharing out of the box.

## 🌟 Key Features

- **P2P Video & Audio**: Direct, ultra-low latency WebRTC communication between peers without routing media through a central server.
- **Native Screen Sharing**: Full screen and application window sharing with system audio capture support.
- **Glassmorphic & Frameless UI**: Beautiful, fully draggable video overlays powered by Framer Motion and Tailwind CSS.
- **Multi-user Rooms**: Seamlessly supports up to 5 users per room with automatic mesh topology negotiation.
- **Desktop Companion App**: Included Electron-based desktop application for a truly native, distraction-free experience.
- **NAT Traversal**: Dedicated TURN/STUN fallback configuration to bypass strict corporate firewalls and NATs.

## 🏗 Architecture & Tech Stack

SideView is logically separated into three main components:

1. **Frontend (Web App)**
   - **Framework**: Next.js (App Router), React
   - **Styling**: Tailwind CSS
   - **State Management**: Zustand
   - **Animations**: Framer Motion
   - **Location**: `/frontend`

2. **Backend (Signaling Server)**
   - **Framework**: Node.js, Express.js
   - **WebSocket**: Socket.io (for room discovery and signaling)
   - **WebRTC Broker**: PeerJS Server (for WebRTC handshake brokering)
   - **Location**: `/backend`

3. **Desktop App**
   - **Framework**: Electron
   - **Purpose**: A lightweight wrapper that loads the Next.js frontend with isolated permissions for media and screen capture, providing a native OS window.
   - **Location**: `/sideview-desktop`

## 🚀 Local Development & Setup

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### 1. Setup Backend (Signaling Server)
The backend is responsible for connecting peers and managing rooms.
```bash
cd backend
npm install
npm run dev
```
The signaling server will start on `http://localhost:8080`.

### 2. Setup Frontend (Web Client)
Ensure you have the `.env.local` file configured for local development:
```bash
cd frontend
npm install
```
Create a `.env.local` file in the `/frontend` directory:
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
```
Start the development server:
```bash
npm run dev
```
The frontend will start on `http://localhost:3000`.

### 3. Setup Desktop App (Optional)
If you want to run the application as a standalone desktop window:
```bash
cd sideview-desktop
npm install
npm start
```
*Note: Ensure the frontend is running or deployed before starting the desktop app. You may need to configure `SIDEVIEW_URL` in your environment to point to `http://localhost:3000` for local testing.*

## 🌍 Production Deployment

### Backend
- Can be deployed to Render, Heroku, or Google Cloud Run.
- **Important**: If deploying to serverless environments (like Cloud Run), ensure you enforce **session affinity (sticky sessions)**. If using in-memory room storage, restrict scaling to 1 instance, OR swap the default `const rooms = {}` with a Redis adapter for multi-instance scaling.

### Frontend
- Easily deployed to Vercel, Netlify, or any static hosting that supports Next.js.
- Don't forget to update the `NEXT_PUBLIC_SOCKET_URL` environment variable to point to your production backend URL.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page if you want to contribute.

## 📄 License
This project is open-source and available under the MIT License.
# CI/CD Test
