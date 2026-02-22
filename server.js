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
.catch(err => console.error("Mongo Error:", err));

// ===== Message Schema =====
const messageSchema = new mongoose.Schema({
    username: String,
    message: String,
    channel: String,
    createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", messageSchema);

// ===== WebSocket Logic =====
wss.on("connection", async (ws) => {
    console.log("User connected");

    // Send last 50 messages from default channel
    const messages = await Message.find({ channel: "general" })
        .sort({ createdAt: 1 })
        .limit(50);

    ws.send(JSON.stringify({ type: "history", messages }));

    ws.on("message", async (data) => {
        const parsed = JSON.parse(data);

        if (parsed.type === "message") {
            const newMessage = new Message({
                username: parsed.username,
                message: parsed.message,
                channel: parsed.channel
            });

            await newMessage.save();

            // Broadcast to everyone
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: "message",
                        username: parsed.username,
                        message: parsed.message,
                        channel: parsed.channel
                    }));
                }
            });
        }
    });
});

app.get("/", (req, res) => {
    res.send("WebSocket Chat Server Running");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));