const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // replace with deployed client URL after deployment
    methods: ["GET", "POST"]
  }
});

// In-memory storage (for demo purposes)
let messages = [];
let onlineUsers = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User login
  socket.on("login", ({ username, room }) => {
    socket.username = username;
    socket.room = room;
    if (!onlineUsers.includes(username)) onlineUsers.push(username);
    socket.join(room);
    io.to(room).emit("user joined", username);
    io.emit("online users", onlineUsers);
    socket.emit("load messages", messages.filter(msg => msg.room === room));
  });

  // Join room
  socket.on("join room", (newRoom) => {
    const oldRoom = socket.room;
    socket.leave(oldRoom);
    socket.room = newRoom;
    socket.join(newRoom);
    socket.emit("load messages", messages.filter(msg => msg.room === newRoom));
  });

  // Chat message
  socket.on("chat message", ({ message, to }) => {
    const msgObj = {
      username: socket.username,
      message,
      room: socket.room,
      private: !!to,
      to: to || null,
      time: new Date().toLocaleTimeString(),
      type: "text",
      reactions: []
    };
    messages.push(msgObj);

    if (to) {
      // Private message
      const targetSocket = [...io.sockets.sockets.values()].find(s => s.username === to);
      if (targetSocket) {
        socket.emit("private message", msgObj);
        targetSocket.emit("private message", msgObj);
      }
    } else {
      // Global message
      io.to(socket.room).emit("chat message", msgObj);
    }
  });

  // Typing indicator
  socket.on("typing", ({ to }) => {
    if (to) {
      const targetSocket = [...io.sockets.sockets.values()].find(s => s.username === to);
      if (targetSocket) targetSocket.emit("typing", socket.username);
    } else {
      socket.to(socket.room).emit("typing", socket.username);
    }
  });

  // File upload
  socket.on("file upload", ({ filename, fileData, to }) => {
    const buffer = Buffer.from(fileData, "base64");
    const filePath = path.join(__dirname, "uploads", filename);
    require("fs").writeFileSync(filePath, buffer);

    const fileMsg = {
      username: socket.username,
      message: filename,
      room: socket.room,
      private: !!to,
      to: to || null,
      time: new Date().toLocaleTimeString(),
      type: "file",
      reactions: []
    };
    messages.push(fileMsg);

    if (to) {
      const targetSocket = [...io.sockets.sockets.values()].find(s => s.username === to);
      if (targetSocket) {
        socket.emit("private message", fileMsg);
        targetSocket.emit("private message", fileMsg);
      }
    } else {
      io.to(socket.room).emit("chat message", fileMsg);
    }
  });

  // Message reactions
  socket.on("message reaction", ({ msgId, reaction }) => {
    const msg = messages[msgId];
    if (msg) {
      msg.reactions.push({ username: socket.username, reaction });
      if (msg.private) {
        const targetSocket = [...io.sockets.sockets.values()].find(s => s.username === msg.to);
        if (targetSocket) targetSocket.emit("message reaction", { msgId, reaction, username: socket.username });
        socket.emit("message reaction", { msgId, reaction, username: socket.username });
      } else {
        io.to(msg.room).emit("message reaction", { msgId, reaction, username: socket.username });
      }
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.username);
    onlineUsers = onlineUsers.filter(u => u !== socket.username);
    io.emit("user left", socket.username);
    io.emit("online users", onlineUsers);
  });
});

// Dynamic port for Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
