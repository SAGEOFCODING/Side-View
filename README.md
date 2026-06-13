# SideView 🎥

> **Real-time P2P video conferencing — low latency, zero compromise.**

SideView is a high-performance, peer-to-peer WebRTC video conferencing app built for seamless, ultra-low latency communication. It features a frameless, draggable, glassmorphic UI that feels native and unobtrusive — because video calls should get out of your way.

Built with Next.js, Socket.io, and PeerJS. Deployed on DigitalOcean with a self-hosted TURN server, Docker Compose, Nginx, and an automated CI/CD pipeline.

🌐 **Live**: [https://sageofcode.me](https://sageofcode.me)  
👨‍💻 **Built by**: [Pranav](https://github.com/SAGEOFCODING)

---

## 🌟 Features

- **P2P Video & Audio** — Direct WebRTC connections between peers. No media routing through a central server.
- **Screen Sharing** — Full screen and application window sharing with system audio capture.
- **Glassmorphic UI** — Fully draggable video overlays powered by Framer Motion and Tailwind CSS.
- **Multi-user Rooms** — Up to 5 users per room with automatic mesh topology negotiation.
- **Desktop App** — Electron wrapper for a native, distraction-free experience.
- **NAT Traversal** — Self-hosted Coturn TURN server for reliable connections across strict firewalls and NATs.
- **Auto Deployments** — GitHub Actions CI/CD pipeline. Push to `main` → live in seconds.

---

## 🏗 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router), React, Tailwind CSS, Framer Motion |
| State | Zustand |
| Backend | Node.js, Express.js, Socket.io, PeerJS Server |
| Desktop | Electron |
| Infrastructure | DigitalOcean, Docker Compose, Nginx, Let's Encrypt |
| TURN Server | Coturn (self-hosted) |
| CI/CD | GitHub Actions |

---

## 🚀 Local Development

### Prerequisites
- Node.js v18+
- npm or yarn

### 1. Backend (Signaling Server)

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:8080`.

### 2. Frontend

Create `/frontend/.env.local`:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
```

Then:

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000`.

### 3. Desktop App (Optional)

```bash
cd sideview-desktop
npm install
npm start
```

> Make sure the frontend is running first. Set `SIDEVIEW_URL=http://localhost:3000` for local testing.

---

## 🌍 Production Deployment

SideView runs on a DigitalOcean Debian droplet with Docker Compose, Nginx reverse proxy, and SSL via Let's Encrypt.

### One-command Setup

```bash
bash setup_debian.sh
```

The script handles everything — Nginx config, Docker setup, SSL certificates, and starting all services. It'll prompt for your domain and TURN server details.

### CI/CD Pipeline

Every push to `main` triggers a GitHub Actions workflow that:
1. SSHs into the droplet
2. Pulls latest code
3. Rebuilds and restarts Docker containers
4. Prunes old images

Add these secrets to your repo (**Settings → Secrets → Actions**):

| Secret | Value |
|---|---|
| `DROPLET_IP` | Your droplet's public IP |
| `DROPLET_USERNAME` | SSH user |
| `DROPLET_SSH_KEY` | Private SSH key |

### TURN Server

SideView uses a self-hosted **Coturn** TURN server for NAT traversal. Configure your ICE servers:

```js
iceServers: [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:<YOUR_TURN_SERVER_IP>:3478",
    username: "<YOUR_USERNAME>",
    credential: "<YOUR_PASSWORD>"
  }
]
```

> **Note for scaling**: If deploying to serverless environments, enforce session affinity (sticky sessions) or replace in-memory room storage with a Redis adapter.

---

## 🤝 Contributing

Issues and pull requests are welcome. Check the [issues page](https://github.com/SAGEOFCODING/Side-View/issues) to get started.

---

## 📄 License

MIT License — open source and free to use.

---

<p align="center">Built with 🔥 by <a href="https://github.com/SAGEOFCODING">Pranav</a></p>
