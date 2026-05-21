const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Health check endpoint for Cloud Run
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'sideview-backend' });
});

const { ExpressPeerServer } = require('peer');

const server = http.createServer(app);

// Initialize PeerJS server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/peerjs', peerServer);

// Simple in-memory room storage for MVP
// rooms[roomId] = { users: [{ socketId, peerId }] }
const rooms = {};

const io = new Server(server, {
  cors: {
    origin: '*', // For development. In production, restrict to frontend domain.
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', (data) => {
    const roomId = data.roomId || data;
    const peerId = data.peerId || null;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: [] };
    }

    // Enforce max 5 users
    if (rooms[roomId].users.length >= 5) {
      socket.emit('room_full', { message: 'This room is currently full (max 5 participants).' });
      return;
    }

    // Send existing users in this room to the newly joined user
    // so they can initiate PeerJS calls to each of them
    const existingUsers = rooms[roomId].users.map(u => ({
      userId: u.socketId,
      peerId: u.peerId,
    }));
    socket.emit('existing_users', existingUsers);

    // Add the new user to the room
    rooms[roomId].users.push({ socketId: socket.id, peerId });
    
    // Notify others in the room that a new user joined
    socket.to(roomId).emit('user_joined', { userId: socket.id, peerId });
    console.log(`User ${socket.id} (peer: ${peerId}) joined room ${roomId}. Total users: ${rooms[roomId].users.length}`);
  });

  socket.on('peer_id', (data) => {
    socket.to(data.roomId).emit('peer_id', { userId: socket.id, peerId: data.peerId });
  });

  socket.on('screen_share_stopped', (data) => {
    // Relay screen share stop event to all others in the room
    const roomId = data.roomId;
    if (roomId) {
      socket.to(roomId).emit('screen_share_stopped', { userId: socket.id });
      console.log(`User ${socket.id} stopped screen sharing in room ${roomId}`);
    }
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      sender: socket.id,
      answer: data.answer,
    });
  });

  socket.on('ice_candidate', (data) => {
    socket.to(data.target).emit('ice_candidate', {
      sender: socket.id,
      candidate: data.candidate,
    });
  });

  // Disconnect logic
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove user from rooms
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const userIndex = room.users.findIndex(u => u.socketId === socket.id);
      
      if (userIndex !== -1) {
        room.users.splice(userIndex, 1);
        socket.to(roomId).emit('user_left', socket.id);
        console.log(`User ${socket.id} left room ${roomId}. Remaining users: ${room.users.length}`);
        
        if (room.users.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted (empty)`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
