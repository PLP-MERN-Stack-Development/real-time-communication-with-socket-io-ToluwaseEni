const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded files
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});

// Track users
let onlineUsers = {}; // { socketId: { username, room } }

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  // User login with username and room
  socket.on("login", ({ username, room }) => {
    onlineUsers[socket.id] = { username, room: room || "General" };
    socket.join(onlineUsers[socket.id].room);

    // Notify room
    io.to(onlineUsers[socket.id].room).emit(
      "online users",
      Object.values(onlineUsers)
        .filter(u => u.room === onlineUsers[socket.id].room)
        .map(u => u.username)
    );
    socket.to(onlineUsers[socket.id].room).emit("user joined", username);
  });

  // Chat message
  socket.on("chat message", ({ message, to }) => {
    const sender = onlineUsers[socket.id];
    const msgData = {
      username: sender.username,
      message,
      time: new Date().toLocaleTimeString(),
    };

    if (to) {
      // Private message
      const targetSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].username === to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("private message", msgData);
        socket.emit("private message", msgData);
      }
    } else {
      // Broadcast to room
      io.to(sender.room).emit("chat message", msgData);
    }
  });

  // Typing indicator
  socket.on("typing", ({ to }) => {
    const sender = onlineUsers[socket.id];
    if (to) {
      const targetSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].username === to);
      if (targetSocketId) socket.to(targetSocketId).emit("typing", sender.username);
    } else {
      socket.to(sender.room).emit("typing", sender.username);
    }
  });

  // Join/change room
  socket.on("join room", (room) => {
    const sender = onlineUsers[socket.id];
    if (sender.room !== room) {
      socket.leave(sender.room);
      socket.join(room);
      sender.room = room;
      // Notify new room
      io.to(room).emit("user joined", sender.username);
      io.to(room).emit(
        "online users",
        Object.values(onlineUsers)
          .filter(u => u.room === room)
          .map(u => u.username)
      );
    }
  });

  // File upload
  socket.on("file upload", ({ filename, fileData, to }) => {
    const filePath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(fileData, "base64");
    fs.writeFileSync(filePath, buffer);

    const msgData = {
      username: onlineUsers[socket.id].username,
      message: filename,
      type: "file",
      time: new Date().toLocaleTimeString(),
    };

    if (to) {
      const targetSocketId = Object.keys(onlineUsers).find(id => onlineUsers[id].username === to);
      if (targetSocketId) io.to(targetSocketId).emit("private message", msgData);
      socket.emit("private message", msgData);
    } else {
      io.to(onlineUsers[socket.id].room).emit("chat message", msgData);
    }
  });

  // Message reactions
  socket.on("message reaction", ({ msgId, reaction }) => {
    const sender = onlineUsers[socket.id];
    io.to(sender.room).emit("message reaction", { msgId, reaction, username: sender.username });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const user = onlineUsers[socket.id];
    if (user) {
      socket.to(user.room).emit("user left", user.username);
      delete onlineUsers[socket.id];
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
