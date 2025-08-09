const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO avec CORS sécurisé pour ton domaine prod et chemin /socket.io
const io = socketIO(server, {
  cors: {
    origin: "http://livebeautyofficial.com/", // autorise uniquement ce domaine
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
let typingUsers = {};
let viewers = {};

io.on("connection", socket => {
  console.log("Client connecté: " + socket.id);

  socket.on("broadcaster", () => {
    broadcaster = socket.id;
    socket.broadcast.emit("broadcaster");
    console.log(`Broadcaster défini: ${broadcaster}`);
  });
socket.on("typing", (data) => {
    typingUsers[socket.id] = data;
    socket.broadcast.emit("typing", data);
  });

  socket.on("stopTyping", () => {
    delete typingUsers[socket.id];
    socket.broadcast.emit("stopTyping");
  });

socket.on('watcher', (data) => {
    if (!data || !data.pseudo) {
        console.warn(`Watcher ${socket.id} connecté sans pseudo, utilisation 'Anonyme'`);
        data = { pseudo: 'Anonyme' };
    }
    
    viewers[socket.id] = data.pseudo;
    io.emit('viewer-connected', {
        socketId: socket.id,
        pseudo: data.pseudo
    });

    if (broadcaster) {
        socket.to(broadcaster).emit("watcher", socket.id);
        console.log(`Watcher connecté: ${socket.id} (${data.pseudo})`);
    }
});

  socket.on('request-viewers', () => {
        socket.emit('current-viewers', viewers);
    });
socket.on("chat-message", (data) => {
  // Rediffuse le message à tous les clients connectés
  io.emit("chat-message", data);
});

socket.on("jeton-sent", (data) => {
    console.log("Jeton reçu du client:", data); // Debug serveur
    io.emit("jeton-sent", data);
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
socket.on('watcher-disconnected', () => {
        if (viewers[socket.id]) {
            io.emit('viewer-disconnected', socket.id);
            delete viewers[socket.id];
        }
    });
  socket.on("disconnect", () => {
    socket.broadcast.emit("disconnectPeer", socket.id);
    console.log(`Client déconnecté: ${socket.id}`);
    // Si le broadcaster se déconnecte, on réinitialise la variable
    if (socket.id === broadcaster) {
      broadcaster = null;
      console.log("Broadcaster déconnecté, variable réinitialisée");
    }

    if (viewers[socket.id]) {
            io.emit('viewer-disconnected', socket.id);
            delete viewers[socket.id];
        }


    if (typingUsers[socket.id]) {
      delete typingUsers[socket.id];
      socket.broadcast.emit("stopTyping");
    }
  });
});


const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur lancé sur http://0.0.0.0:${PORT}`);
});

