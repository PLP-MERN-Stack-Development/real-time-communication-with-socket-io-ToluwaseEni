Project Structure
real-time-chat/
├── client/                 # React client
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── public/
│   │   └── notification.mp3
│   └── package.json
├── server/                 # Node.js + Express + Socket.io server
│   ├── index.js
│   ├── uploads/            # Uploaded files
│   └── package.json
└── README.md

Setup Instructions
Server

Navigate to the server folder:

cd server


Install dependencies:

npm install


Start the development server:

npm run dev


Server runs on: http://localhost:3000

Client

Navigate to the client folder:

cd client


Install dependencies:

npm install


Start the development server:

npm run dev


Client runs on: http://localhost:5173

Deployment

Server URL: [YOUR_RENDER_SERVER_URL]

Client URL: [YOUR_RENDER_CLIENT_URL]

Note: Update App.jsx with the deployed server URL for the Socket.io connection:

const socket = io("https://YOUR_RENDER_SERVER_URL", { reconnection: true, reconnectionAttempts: 5 });

Screenshots / GIFs

Insert screenshots or GIFs showing:

Global chat and multiple rooms

Private messaging

File upload

Typing indicator

Notifications

Message reactions

Usage Instructions

Open the client URL in a browser.

Enter a username and select a chat room.

Start chatting globally or privately.

Upload files/images using the file input.

React to messages with 👍 or ❤️.

Open multiple tabs to see real-time updates.

Technologies Used

Frontend: React, Vite, Socket.io-client, CSS

Backend: Node.js, Express, Socket.io

Deployment: Render (Server + Client)