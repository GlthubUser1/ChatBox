// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ===== MongoDB Connection =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// ===== Message Schema =====
const messageSchema = new mongoose.Schema({
  username: String,
  message: String,
  channel: String,
  type: { type: String, default: "message" },
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", messageSchema);

// ===== WebSocket Logic =====
wss.on("connection", async (ws) => {
  console.log("User connected");

  // Load last 50 messages
  const messages = await Message.find({})
    .sort({ createdAt: -1 })
    .limit(50);

  ws.send(JSON.stringify({ type: "history", messages: messages.reverse() }));

  ws.on("message", async (data) => {
    const parsed = JSON.parse(data);

    if (parsed.type === "message" || parsed.type === "username_change") {
      const newMsg = new Message({
        username: parsed.username || parsed.oldUsername,
        message: parsed.message,
        channel: parsed.channel || "#general",
        type: parsed.type
      });

      await newMsg.save();

      // Broadcast to all clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(newMsg));
        }
      });
    }
  });

  ws.on("close", () => console.log("User disconnected"));
});

// ===== Basic Test Route =====
app.get("/", (req, res) => {
  res.send("WebSocket Chat Server Running");
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));