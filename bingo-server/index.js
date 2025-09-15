const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // origin: ["http://localhost:3000", "http://localhost:5173","http://10.239.39.209:5173","http://192.168.52.109:5173"],
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Store active rooms and their players
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new room
  socket.on('createRoom', ({ playerName, maxPlayers = 5 }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    socket.join(roomCode);
    rooms[roomCode] = {
      players: [{ id: socket.id, name: playerName, isHost: true }],
      gameState: null,
      maxPlayers: Math.min(Math.max(2, maxPlayers), 5), // Ensure between 2-5
      currentTurn: null
    };
    
    socket.emit('roomCreated', { roomCode });
    io.to(roomCode).emit('playersList', { 
      players: rooms[roomCode].players,
      maxPlayers: rooms[roomCode].maxPlayers
    });
  });

  // Join an existing room
  socket.on('joinRoom', ({ playerName, roomCode }) => {
    if (!rooms[roomCode]) {
      socket.emit('joinedRoom', { success: false, message: 'Room does not exist' });
      return;
    }
    
    if (rooms[roomCode].players.length >= rooms[roomCode].maxPlayers) {
      socket.emit('joinedRoom', { success: false, message: 'Room is full' });
      return;
    }
    
    socket.join(roomCode);
    const newPlayer = { id: socket.id, name: playerName, isHost: false };
    rooms[roomCode].players.push(newPlayer);
    
    socket.emit('joinedRoom', { success: true });
    io.to(roomCode).emit('playersList', { 
      players: rooms[roomCode].players,
      maxPlayers: rooms[roomCode].maxPlayers
    });
    io.to(roomCode).emit('playerJoined', { player: newPlayer });
    
    // Auto-start when room is full
    if (rooms[roomCode].players.length === rooms[roomCode].maxPlayers) {
      startGame(roomCode);
    }
  });

  // Start game
  socket.on('startGame', ({ roomCode }) => {
    startGame(roomCode);
  });

  // Helper function to start game
  function startGame(roomCode) {
    if (!rooms[roomCode]) return;
    
    // Set first player's turn
    rooms[roomCode].currentTurn = 0;
    const currentPlayer = rooms[roomCode].players[0];
    
    io.to(roomCode).emit('gameStarted');
    io.to(roomCode).emit('turnUpdate', { 
      playerId: currentPlayer.id,
      playerName: currentPlayer.name
    });
  }

  // Select a number
  socket.on('selectNumber', ({ number, roomCode }) => {
    if (!rooms[roomCode]) return;
    
    const playerIndex = rooms[roomCode].players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;
    
    // Check if it's this player's turn
    if (rooms[roomCode].currentTurn !== playerIndex) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    const player = rooms[roomCode].players[playerIndex];
    io.to(roomCode).emit('numberSelected', { number, player: player.name });
    
    // Move to next player's turn
    rooms[roomCode].currentTurn = (rooms[roomCode].currentTurn + 1) % rooms[roomCode].players.length;
    const nextPlayer = rooms[roomCode].players[rooms[roomCode].currentTurn];
    
    io.to(roomCode).emit('turnUpdate', {
      playerId: nextPlayer.id,
      playerName: nextPlayer.name
    });
  });

  // Call bingo
  socket.on('callBingo', ({ roomCode }) => {
    if (!rooms[roomCode]) return;
    
    const player = rooms[roomCode].players.find(p => p.id === socket.id);
    if (player) {
      io.to(roomCode).emit('bingoCall', { player: player.name });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Remove player from any rooms they were in
    Object.keys(rooms).forEach(roomCode => {
      const playerIndex = rooms[roomCode].players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        rooms[roomCode].players.splice(playerIndex, 1);
        
        // If room is empty, delete it
        if (rooms[roomCode].players.length === 0) {
          delete rooms[roomCode];
        } else {
          // If host left, assign a new host
          if (!rooms[roomCode].players.some(p => p.isHost)) {
            rooms[roomCode].players[0].isHost = true;
          }
          
          // If current turn player left, move to next player
          if (rooms[roomCode].currentTurn >= playerIndex) {
            rooms[roomCode].currentTurn = rooms[roomCode].currentTurn % rooms[roomCode].players.length;
            const nextPlayer = rooms[roomCode].players[rooms[roomCode].currentTurn];
            io.to(roomCode).emit('turnUpdate', {
              playerId: nextPlayer.id,
              playerName: nextPlayer.name
            });
          }
          
          // Notify remaining players
          io.to(roomCode).emit('playersList', { 
            players: rooms[roomCode].players,
            maxPlayers: rooms[roomCode].maxPlayers
          });
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT,'0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});