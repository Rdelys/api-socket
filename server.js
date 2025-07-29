const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO avec CORS sécurisé pour ton domaine prod et chemin /socket.io
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000", // autorise uniquement ce domaine
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io"
});

// Route test simple
app.get('/', (req, res) => {
  res.send('✅ Serveur WebRTC Socket.IO est en ligne');
});

let broadcaster;

io.on("connection", socket => {
  console.log("Client connecté: " + socket.id);

  socket.on("broadcaster", () => {
    broadcaster = socket.id;
    socket.broadcast.emit("broadcaster");
    console.log(`Broadcaster défini: ${broadcaster}`);
  });

  socket.on("watcher", () => {
    if (broadcaster) {
      socket.to(broadcaster).emit("watcher", socket.id);
      console.log(`Watcher connecté: ${socket.id}`);
    }
  });

  socket.on("offer", (id, message) => {
    socket.to(id).emit("offer", socket.id, message);
  });

  socket.on("answer", (id, message) => {
    socket.to(id).emit("answer", socket.id, message);
  });

  socket.on("candidate", (id, message) => {
    socket.to(id).emit("candidate", socket.id, message);
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("disconnectPeer", socket.id);
    console.log(`Client déconnecté: ${socket.id}`);
    // Si le broadcaster se déconnecte, on réinitialise la variable
    if (socket.id === broadcaster) {
      broadcaster = null;
      console.log("Broadcaster déconnecté, variable réinitialisée");
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur lancé sur http://0.0.0.0:${PORT}`);
});

