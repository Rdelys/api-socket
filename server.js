const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*"
  }
});

let broadcaster;

io.on("connection", socket => {
  console.log("Client connecté: " + socket.id);

  socket.on("broadcaster", () => {
    broadcaster = socket.id;
    socket.broadcast.emit("broadcaster");
  });

  socket.on("watcher", () => {
    if (broadcaster) {
      socket.to(broadcaster).emit("watcher", socket.id);
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
  });
});

server.listen(3000, () => console.log("✅ Serveur de signalisation WebRTC lancé sur http://localhost:3000"));
