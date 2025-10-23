import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import './App.css';

// Use environment variable for server URL (Vite)
// Use environment variable if set
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "https://real-time-communication-with-socket-io.onrender.com";

const socket = io(SERVER_URL, { reconnection: true, reconnectionAttempts: 5 });

function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("General");
  const [loggedIn, setLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [privateTo, setPrivateTo] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const typingTimeout = useRef(null);
  const windowFocused = useRef(true);
  const messagesEndRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  // Browser notifications
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // Track window focus for unread messages
  useEffect(() => {
    const onFocus = () => { windowFocused.current = true; setUnreadCount(0); };
    const onBlur = () => windowFocused.current = false;
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const playSound = () => {
      const audio = new Audio("/notification.mp3");
      audio.play().catch(() => {});
    };

    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
      if (!windowFocused.current) {
        setUnreadCount(prev => prev + 1);
        playSound();
        if (Notification.permission === "granted") {
          new Notification(`New message from ${msg.username}`, { body: msg.message });
        }
      }
    };

    socket.on("chat message", handleMessage);
    socket.on("private message", handleMessage);
    socket.on("load messages", (msgs) => setMessages(msgs));

    socket.on("user joined", (user) =>
      setMessages(prev => [...prev, { username: "System", message: `${user} joined`, time: new Date().toLocaleTimeString() }])
    );
    socket.on("user left", (user) =>
      setMessages(prev => [...prev, { username: "System", message: `${user} left`, time: new Date().toLocaleTimeString() }])
    );

    socket.on("online users", (users) => setOnlineUsers(users.filter(u => u !== username)));

    socket.on("typing", (user) => {
      setTypingUser(user);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTypingUser(""), 2000);
    });

    socket.on("message reaction", ({ msgId, reaction, username }) => {
      setMessages(prev => {
        const newMessages = [...prev];
        if (!newMessages[msgId].reactions) newMessages[msgId].reactions = [];
        newMessages[msgId].reactions.push({ reaction, username });
        return newMessages;
      });
    });

    return () => socket.off();
  }, [username]);

  const login = () => {
    if (username.trim()) {
      socket.emit("login", { username, room });
      setLoggedIn(true);
    }
  };

  const sendMessage = () => {
    if (message.trim()) {
      socket.emit("chat message", { message, to: privateTo || null });
      setMessage("");
    }
  };

  const handleTyping = () => socket.emit("typing", { to: privateTo || null });

  const changeRoom = (newRoom) => {
    socket.emit("join room", newRoom);
    setRoom(newRoom);
    setMessages([]);
    setPrivateTo("");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result.split(",")[1];
      socket.emit("file upload", { filename: file.name, fileData: base64Data, to: privateTo || null });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="container">
      {!loggedIn ? (
        <div>
          <h2>Enter username and choose a room</h2>
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <select value={room} onChange={e => setRoom(e.target.value)}>
            <option value="General">General</option>
            <option value="Tech">Tech</option>
            <option value="Sports">Sports</option>
          </select>
          <button onClick={login}>Join Chat</button>
        </div>
      ) : (
        <div>
          <h2>Room: {room} {unreadCount > 0 && <span>({unreadCount} unread)</span>}</h2>
          <div><b>Online Users:</b> {onlineUsers.join(", ")}</div>

          <div>
            <b>Private Message:</b>
            <select value={privateTo} onChange={e => setPrivateTo(e.target.value)}>
              <option value="">--None--</option>
              {onlineUsers.map((user, idx) => <option key={idx} value={user}>{user}</option>)}
            </select>
          </div>

          <div>
            <b>Change Room:</b>
            <select value={room} onChange={e => changeRoom(e.target.value)}>
              <option value="General">General</option>
              <option value="Tech">Tech</option>
              <option value="Sports">Sports</option>
            </select>
          </div>

          <div className="chat-box">
            {messages.map((msg, idx) => (
              <div key={idx} className="message" style={{ color: msg.private ? "blue" : "black" }}>
                <b>{msg.username}</b> [{msg.time}]{msg.private ? " (private)" : ""}:
                {msg.type === "file" ? (
                  <a href={`${SERVER_URL}/uploads/${msg.message}`} target="_blank" rel="noopener noreferrer">{msg.message}</a>
                ) : msg.message}
                <span className="reactions">
                  <button onClick={() => socket.emit("message reaction", { msgId: idx, reaction: "👍" })}>👍</button>
                  <button onClick={() => socket.emit("message reaction", { msgId: idx, reaction: "❤️" })}>❤️</button>
                </span>
                {msg.reactions && msg.reactions.map((r, i) => <span key={i}> {r.reaction}({r.username}) </span>)}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {typingUser && <div className="typing">{typingUser} is typing...</div>}

          <input type="text" value={message} onChange={e => setMessage(e.target.value)} onKeyPress={handleTyping} placeholder="Type a message..." />
          <button onClick={sendMessage}>Send</button>
          <input type="file" onChange={handleFileUpload} style={{ marginTop: "10px" }} />
        </div>
      )}
    </div>
  );
}

export default App;
