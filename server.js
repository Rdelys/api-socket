const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);

// wss://livebeautyofficial.com http://localhost:3000/
// Socket.IO avec CORS sécurisé
const io = socketIO(server, {
  cors: {
    origin: "https://livebeautyofficial.com", // ✅ domaine à remplacer en prod
    methods: ["GET", "POST"],
    credentials: true
  },
  path: "/socket.io"
});

app.get('/', (req, res) => {
  res.send('✅ Serveur WebRTC Socket.IO est en ligne');
});

/**
 * États du serveur
 */
let broadcasters = {};   // { roomId : socketId }
let typingUsers  = {};   // { socketId : data }
let viewers      = {};   // { socketId : { room, pseudo } }
let privateOwner = null; // socket.id du client qui a déclenché le privé
let privateActive = false;

io.on("connection", socket => {
  console.log("Client connecté:", socket.id);

  // --- STOP LIVE ---
  socket.on("modele-stop-live", (data) => {
    io.emit("modele-stop-live", { modele_id: data.modele_id });
  });

  /**
   * === Broadcaster (public ou privé) ===
   */
  socket.on("broadcaster", (data = {}) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    broadcasters[room] = socket.id;
    socket.join(room);
    socket.to(room).emit("broadcaster");

    if (data.showPriveId && data.date && data.startTime && data.endTime) {
      const [endH, endM, endS] = data.endTime.split(":").map(Number);
      const [year, month, day] = data.date.split("-").map(Number);
      const endDate = new Date(year, month - 1, day, endH || 0, endM || 0, endS || 0, 0);

      io.to(room).emit("show-time", {
        showPriveId: data.showPriveId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        endTimestamp: endDate.getTime()
      });

      console.log(`⏱ Horaire show privé ${room}: ${data.date} ${data.startTime} → ${data.endTime} (ts=${endDate.getTime()})`);
    }

    console.log(`🎥 Broadcaster défini pour la room ${room} : ${socket.id}`);
  });

  /**
   * === Passage en show privé ===
   */
  socket.on("switch-to-private", ({ pseudo }) => {
    privateOwner = socket.id;
    privateActive = true;

    for (let [id, viewer] of Object.entries(viewers)) {
      if (viewer.room === "public" && id !== socket.id) {
        io.to(id).emit("redirect-dashboard");
        io.sockets.sockets.get(id)?.leave("public");
        delete viewers[id];
      }
    }

    io.to("public").emit("chat-message", {
      pseudo: "Système",
      message: `🚪 ${pseudo} a lancé un show privé (les autres ont été expulsés).`
    });

      io.emit("switch-to-private", { pseudo });

    socket.join("private-" + pseudo);
  });

  socket.on("cancel-private", ({ pseudo }) => {
    privateOwner = null;
    privateActive = false;

    socket.join("public");

    io.to("public").emit("chat-message", {
      pseudo: "Système",
      message: `❌ ${pseudo} a annulé son show privé. Le live est de nouveau public.`
    });

      io.emit("cancel-private", { pseudo });

  });

  socket.on("join-public", ({ pseudo }) => {
    if (privateActive && socket.id !== privateOwner) {
      io.to(socket.id).emit("redirect-dashboard");
    } else {
      socket.join("public");
      viewers[socket.id] = { pseudo, room: "public" };
    }
  });

  /**
   * === WebRTC relays (broadcaster ↔ watcher) ===
   */
  socket.on("offer", (id, description) => {
    socket.to(id).emit("offer", socket.id, description);
  });
  socket.on("answer", (id, description) => {
    socket.to(id).emit("answer", socket.id, description);
  });
  socket.on("candidate", (id, candidate) => {
    socket.to(id).emit("candidate", socket.id, candidate);
  });

  /**
   * === Watcher (public ou privé) ===
   */
  socket.on("watcher", (data = {}) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    const pseudo = data.pseudo || "Anonyme";

    socket.join(room);
    viewers[socket.id] = { room, pseudo };
    socket.to(room).emit("viewer-connected", { socketId: socket.id, pseudo });
    console.log(`👀 Watcher ${pseudo} a rejoint la room ${room}`);

    if (broadcasters[room]) {
      socket.to(broadcasters[room]).emit("watcher", socket.id);
    }
  });

  /**
   * === Chat (public ou privé) ===
   */
  socket.on("chat-message", (data) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    io.to(room).emit("chat-message", data);
  });

  /**
   * === Jetons envoyés ===
   */
  socket.on("jeton-sent", (data) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    io.to(room).emit("jeton-sent", data);
  });

  /**
   * === Surprise envoyée ===
   */
  socket.on("surprise-sent", (data) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    io.to(room).emit("surprise-sent", data);
  });

  /**
   * === Typing ===
   */
  socket.on("typing", (data) => {
    typingUsers[socket.id] = data;
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    socket.to(room).emit("typing", data);
  });

  socket.on("stopTyping", (data = {}) => {
    delete typingUsers[socket.id];
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    socket.to(room).emit("stopTyping");
  });

  // client -> modele
socket.on('client-offer', (data) => {
  const room = data.showPriveId ? `prive-${data.showPriveId}` : 'public';
  const modeleSocketId = broadcasters[room];
  if (!modeleSocketId) return;
  io.to(modeleSocketId).emit('client-offer', { from: socket.id, offer: data.offer });
});

socket.on('client-answer', (data) => {
  const target = data.toClientSocketId;
  if (target) {
    io.to(target).emit('client-answer', { from: socket.id, description: data.description });
  }
});

socket.on('client-candidate', (data) => {
  if (data.to) {
    io.to(data.to).emit('client-candidate', { candidate: data.candidate, to: data.to });
  } else if (data.toRoom) {
    const modeleSocketId = broadcasters[data.toRoom];
    if (modeleSocketId) {
      io.to(modeleSocketId).emit('client-candidate', { candidate: data.candidate, to: data.from });
    }
  }
});

socket.on('client-stop', (data) => {
  const room = data.showPriveId ? `prive-${data.showPriveId}` : 'public';
  const modeleSocketId = broadcasters[room];
  if (modeleSocketId) io.to(modeleSocketId).emit('client-disconnect', { from: socket.id });
});

  /**
   * === Déconnexion ===
   */
  socket.on("disconnect", () => {
    console.log(`❌ Client déconnecté: ${socket.id}`);

    if (viewers[socket.id]) {
      const { room } = viewers[socket.id];
      io.to(room).emit("viewer-disconnected", socket.id);
      delete viewers[socket.id];
    }

    if (typingUsers[socket.id]) {
      const { showPriveId } = typingUsers[socket.id];
      const room = showPriveId ? `prive-${showPriveId}` : "public";
      delete typingUsers[socket.id];
      socket.to(room).emit("stopTyping");
    }

    // Si c'était un broadcaster (modèle) — on supprime et on notifie la room
    Object.entries(broadcasters).forEach(([room, broadcasterId]) => {
      if (broadcasterId === socket.id) {
        delete broadcasters[room];
        console.log(`⚠️ Broadcaster déconnecté pour room ${room}`);

        // Notifier tous les watchers de la room que le modèle est parti
        // Envoi d'une charge utile simple — tu peux ajouter plus de champs si besoin
        io.to(room).emit("modele-deconnecte", {
          room,
          message: "Le modèle a quitté ou coupé le show."
        });
      }
    });

    socket.broadcast.emit("disconnectPeer", socket.id);
  });
});

/**
 * === Lancement du serveur ===
 */
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur lancé sur http://0.0.0.0:${PORT}`);
});
