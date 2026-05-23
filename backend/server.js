const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const MAX_ROOMS = parseInt(process.env.MAX_ROOMS || '1000', 10);
const MAX_USERS_PER_ROOM = parseInt(process.env.MAX_USERS_PER_ROOM || '5', 10);

// Allowed origins for CORS — restrict in production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

// --- Structured Logging ---
function log(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// --- Room ID Validation ---
function isValidRoomId(roomId) {
  if (typeof roomId !== 'string') return false;
  if (roomId.length < 1 || roomId.length > 64) return false;
  // Only allow alphanumeric, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(roomId);
}

// --- App Setup ---
const app = express();

// Security headers
app.use(helmet());

// CORS — restricted to allowed origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, healthchecks)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    log('warn', 'Express CORS blocked origin', { origin, allowedOrigins: ALLOWED_ORIGINS });
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
}));

// Rate limiting for HTTP endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body parser with size limit
app.use(express.json({ limit: '1kb' }));

// Health check endpoint for Cloud Run
app.get('/', (req, res) => {
  const roomCount = Object.keys(rooms).length;
  const totalUsers = Object.values(rooms).reduce((sum, room) => sum + room.users.length, 0);
  res.status(200).json({
    status: 'ok',
    service: 'sideview-backend',
    uptime: Math.floor(process.uptime()),
    rooms: roomCount,
    connectedUsers: totalUsers,
    allowedOrigins: ALLOWED_ORIGINS,
  });
});

const { ExpressPeerServer } = require('peer');

const server = http.createServer(app);

// Initialize PeerJS server
const peerServer = ExpressPeerServer(server, {
  debug: process.env.NODE_ENV === 'production' ? false : true,
  path: '/',
  // Allow peer connections from allowed origins
  allow_discovery: false,
});

app.use('/peerjs', peerServer);

// Simple in-memory room storage for MVP
// rooms[roomId] = { users: [{ socketId, peerId }], createdAt: Date }
const rooms = {};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
        return callback(null, true);
      }
      log('warn', 'Socket.io CORS blocked origin', { origin, allowedOrigins: ALLOWED_ORIGINS });
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
  },
  // Connection limits
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Track connection rate per IP for socket-level rate limiting
const connectionAttempts = new Map();
const CONNECTION_RATE_WINDOW = 60000; // 1 minute
const MAX_CONNECTIONS_PER_WINDOW = 10;

io.on('connection', (socket) => {
  // Simple per-IP rate limiting for socket connections
  const clientIp = socket.handshake.address;
  const now = Date.now();
  const attempts = connectionAttempts.get(clientIp) || [];
  const recentAttempts = attempts.filter(t => now - t < CONNECTION_RATE_WINDOW);
  recentAttempts.push(now);
  connectionAttempts.set(clientIp, recentAttempts);

  if (recentAttempts.length > MAX_CONNECTIONS_PER_WINDOW) {
    log('warn', 'Socket rate limit exceeded', { ip: clientIp, socketId: socket.id });
    socket.emit('error_message', { message: 'Too many connection attempts. Please wait.' });
    socket.disconnect(true);
    return;
  }

  log('info', 'User connected', { socketId: socket.id });

  socket.on('join_room', (data) => {
    const roomId = typeof data === 'string' ? data : data?.roomId;
    const peerId = typeof data === 'object' ? data?.peerId : null;

    // Validate roomId
    if (!isValidRoomId(roomId)) {
      socket.emit('error_message', { message: 'Invalid room ID. Use only letters, numbers, hyphens, and underscores (max 64 chars).' });
      log('warn', 'Invalid roomId rejected', { socketId: socket.id, roomId: String(roomId).substring(0, 100) });
      return;
    }

    // Validate peerId format
    if (peerId && (typeof peerId !== 'string' || peerId.length > 128)) {
      socket.emit('error_message', { message: 'Invalid peer ID.' });
      return;
    }

    // Check room count cap (only for new rooms)
    if (!rooms[roomId] && Object.keys(rooms).length >= MAX_ROOMS) {
      socket.emit('error_message', { message: 'Server is at capacity. Please try again later.' });
      log('warn', 'Max room count reached', { maxRooms: MAX_ROOMS });
      return;
    }

    // Enforce max users per room (check before joining Socket.io room)
    if (rooms[roomId] && rooms[roomId].users.length >= MAX_USERS_PER_ROOM) {
      socket.emit('room_full', { message: `This room is currently full (max ${MAX_USERS_PER_ROOM} participants).` });
      return;
    }

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: [], createdAt: new Date().toISOString() };
    }

    // Prevent duplicate joins
    const alreadyInRoom = rooms[roomId].users.some(u => u.socketId === socket.id);
    if (alreadyInRoom) {
      log('warn', 'Duplicate join attempt', { socketId: socket.id, roomId });
      return;
    }

    // Send existing users in this room to the newly joined user
    const existingUsers = rooms[roomId].users.map(u => ({
      userId: u.socketId,
      peerId: u.peerId,
      micMuted: u.micMuted || false,
      cameraOff: u.cameraOff || false,
      name: u.name,
    }));
    socket.emit('existing_users', existingUsers);

    const micMuted = typeof data === 'object' ? !!data?.micMuted : false;
    const cameraOff = typeof data === 'object' ? !!data?.cameraOff : false;
    const rawName = typeof data === 'object' ? data?.name : '';
    const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim().substring(0, 20) : '';

    // Add the new user to the room
    rooms[roomId].users.push({ socketId: socket.id, peerId, micMuted, cameraOff, name });
    
    // Notify others in the room that a new user joined
    socket.to(roomId).emit('user_joined', { userId: socket.id, peerId, micMuted, cameraOff, name });
    log('info', 'User joined room', {
      socketId: socket.id,
      peerId,
      roomId,
      totalUsers: rooms[roomId].users.length,
    });
  });

  socket.on('peer_id', (data) => {
    if (!data || !isValidRoomId(data.roomId)) return;
    socket.to(data.roomId).emit('peer_id', { userId: socket.id, peerId: data.peerId });
  });

  socket.on('signal', (data) => {
    if (data && data.targetId) {
      io.to(data.targetId).emit('signal', {
        senderId: socket.id,
        signal: data.signal,
      });
    }
  });

  socket.on('user_state_changed', (data) => {
    const roomId = data?.roomId;
    if (roomId && isValidRoomId(roomId)) {
      const room = rooms[roomId];
      if (room) {
        const user = room.users.find(u => u.socketId === socket.id);
        if (user) {
          user.micMuted = !!data.micMuted;
          user.cameraOff = !!data.cameraOff;
        }
      }
      socket.to(roomId).emit('user_state_changed', {
        userId: socket.id,
        micMuted: !!data.micMuted,
        cameraOff: !!data.cameraOff,
      });
      log('info', 'User state changed', { socketId: socket.id, roomId, micMuted: !!data.micMuted, cameraOff: !!data.cameraOff });
    }
  });

  socket.on('screen_share_stopped', (data) => {
    const roomId = data?.roomId;
    if (roomId && isValidRoomId(roomId)) {
      socket.to(roomId).emit('screen_share_stopped', { userId: socket.id });
      log('info', 'Screen share stopped', { socketId: socket.id, roomId });
    }
  });

  // Disconnect logic
  socket.on('disconnect', () => {
    log('info', 'User disconnected', { socketId: socket.id });
    
    // Remove user from all rooms they were in
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const userIndex = room.users.findIndex(u => u.socketId === socket.id);
      
      if (userIndex !== -1) {
        room.users.splice(userIndex, 1);
        socket.to(roomId).emit('user_left', socket.id);
        log('info', 'User left room', {
          socketId: socket.id,
          roomId,
          remainingUsers: room.users.length,
        });
        
        if (room.users.length === 0) {
          delete rooms[roomId];
          log('info', 'Room deleted (empty)', { roomId });
        }
      }
    }
  });
});

// --- Graceful Shutdown ---
function gracefulShutdown(signal) {
  log('info', `${signal} received. Starting graceful shutdown...`);
  
  // Notify all connected clients
  io.emit('server_shutdown', { message: 'Server is restarting. Please reconnect.' });
  
  // Close Socket.io connections
  io.close(() => {
    log('info', 'Socket.io connections closed');
  });
  
  // Close HTTP server
  server.close(() => {
    log('info', 'HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    log('error', 'Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Clean up stale connection rate tracking every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of connectionAttempts) {
    const recent = attempts.filter(t => now - t < CONNECTION_RATE_WINDOW);
    if (recent.length === 0) {
      connectionAttempts.delete(ip);
    } else {
      connectionAttempts.set(ip, recent);
    }
  }
}, 5 * 60 * 1000);

server.listen(PORT, () => {
  log('info', `Server started`, { port: PORT, allowedOrigins: ALLOWED_ORIGINS });
});
