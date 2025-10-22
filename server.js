const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
// wss://livebeautyofficial.com http://localhost:3000/
// Socket.IO avec CORS sécurisé
const io = socketIO(server, {
  cors: {
    origin: "https://livebeautyofficial.com", // ✅ ton domaine à remplacer en prod
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

io.on("connection", socket => {
  console.log("Client connecté:", socket.id);

  socket.on("modele-stop-live", (data) => {
    // Informer tous les clients regardant ce modèle
    io.emit("modele-stop-live", { modele_id: data.modele_id });
  });
  /**
   * Broadcaster (public ou privé)
   */
socket.on("broadcaster", (data = {}) => {
  const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
  broadcasters[room] = socket.id;
  socket.join(room);
  socket.to(room).emit("broadcaster");

  if (data.showPriveId && data.date && data.startTime && data.endTime) {
    // Construire datetime fin avec date + heure
    const [endH, endM, endS] = data.endTime.split(":").map(Number);
    const [year, month, day] = data.date.split("-").map(Number); // format YYYY-MM-DD

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
 * Passage en show privé
 */
let privateOwner = null; // socket.id du client qui a déclenché le privé
let privateActive = false;

io.on("connection", (socket) => {

  socket.on("switch-to-private", ({ pseudo }) => {
  // Le modèle qui déclenche devient le propriétaire du show privé
  privateOwner = socket.id;
  privateActive = true;

  for (let [id, viewer] of Object.entries(viewers)) {
    // Expulser seulement les spectateurs du show public, pas le modèle
    if (viewer.room === "public" && id !== socket.id) {
      io.to(id).emit("redirect-dashboard"); // éjection
      io.sockets.sockets.get(id)?.leave("public"); // quitter la room publique
      delete viewers[id]; // nettoyer
    }
  }

  // Message système uniquement aux sockets restants dans "public"
  // (donc pas à tout le monde, sinon même le modèle verrait "expulsé")
  io.to("public").emit("chat-message", {
    pseudo: "Système",
    message: `🚪 ${pseudo} a lancé un show privé (les autres ont été expulsés).`
  });

  // Le modèle peut entrer dans sa propre room privée si besoin
  socket.join("private-" + pseudo);
});


  socket.on("cancel-private", ({ pseudo }) => {
    privateOwner = null;
    privateActive = false;

    // Ré-ouvrir la room publique
    socket.join("public");

    // Annonce seulement dans le salon public
    io.to("public").emit("chat-message", {
      pseudo: "Système",
      message: `❌ ${pseudo} a annulé son show privé. Le live est de nouveau public.`
    });
  });


  // Quand un client tente de rejoindre le public
  socket.on("join-public", ({ pseudo }) => {
    if (privateActive && socket.id !== privateOwner) {
      // Refusé → redirigé
      io.to(socket.id).emit("redirect-dashboard");
    } else {
      socket.join("public");
      viewers[socket.id] = { pseudo, room: "public" };
    }
  });

});


/**
 * Annulation du show privé
 */
socket.on("cancel-private", ({ pseudo }) => {
  console.log("❌ Annulation du show privée par", pseudo);

  io.emit("chat-message", {
    pseudo: "Système",
    message: `❌ ${pseudo} a annulé son show privée.`
  });

  // On supprime l’état "public-private"
  delete broadcasters["public-private"];
});



  /**
   * Watcher (public ou privé)
   */
  socket.on("watcher", (data = {}) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    const pseudo = data.pseudo || "Anonyme";

    socket.join(room);
    viewers[socket.id] = { room, pseudo };

    // Notifie les autres clients dans cette room
    socket.to(room).emit("viewer-connected", { socketId: socket.id, pseudo });
    console.log(`👀 Watcher ${pseudo} a rejoint la room ${room}`);

    // Informe le broadcaster
    if (broadcasters[room]) {
      socket.to(broadcasters[room]).emit("watcher", socket.id);
    }
  });

  /**
   * Chat (public ou privé)
   */
  socket.on("chat-message", (data) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    io.to(room).emit("chat-message", data);
  });

  /**
   * Jetons envoyés
   */
  socket.on("jeton-sent", (data) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    io.to(room).emit("jeton-sent", data);
  });

  /**
   * Surprise envoyée
   */
  socket.on("surprise-sent", (data) => {
    const room = data.showPriveId ? `prive-${data.showPriveId}` : "public";
    io.to(room).emit("surprise-sent", data);
  });

  /**
   * WebRTC
   */
  socket.on("client-offer", (id, message) => {
    socket.to(id).emit("client-offer", socket.id, message);
  });
  socket.on("client-answer", (id, message) => {
    socket.to(id).emit("client-answer", socket.id, message);
  });
  socket.on("client-candidate", (id, message) => {
    socket.to(id).emit("client-candidate", socket.id, message);
  });

  /**
   * Typing
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

  /**
   * Déconnexion
   */
  socket.on("disconnect", () => {
    console.log(`❌ Client déconnecté: ${socket.id}`);

    // Si c’était un viewer → informer uniquement sa room
    if (viewers[socket.id]) {
      const { room } = viewers[socket.id];
      io.to(room).emit("viewer-disconnected", socket.id);
      delete viewers[socket.id];
    }

    // Nettoyer typing
    if (typingUsers[socket.id]) {
      const { showPriveId } = typingUsers[socket.id];
      const room = showPriveId ? `prive-${showPriveId}` : "public";
      delete typingUsers[socket.id];
      socket.to(room).emit("stopTyping");
    }

    // Si c’était un broadcaster → supprimer sa room
    Object.entries(broadcasters).forEach(([room, broadcasterId]) => {
      if (broadcasterId === socket.id) {
        delete broadcasters[room];
        console.log(`⚠️ Broadcaster déconnecté pour room ${room}`);
      }
    });

    socket.broadcast.emit("disconnectPeer", socket.id);
  });
});

/**
 * Lancement du serveur
 */
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur lancé sur http://0.0.0.0:${PORT}`);
});
