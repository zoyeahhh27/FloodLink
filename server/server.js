
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");

dotenv.config();

// =====================================================
// SOCKET
// =====================================================

const { initSocket } = require("./socket");

// =====================================================
// ROUTES
// =====================================================

const emergencyRoutes = require("./routes/emergencyRoutes");
const shelterRoutes = require("./routes/shelterRoutes");
const hazardRoutes = require("./routes/hazardRoutes");
const evacuationRoutes = require("./routes/evacuationRoutes");

// =====================================================
// CONFIG
// =====================================================

const app = express();
const server = http.createServer(app);

// =====================================================
// CORS CONFIGURATION
// =====================================================

const allowedOrigins = [
  "http://localhost:5173",
  "https://flood-link.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// =====================================================
// SOCKET.IO
// =====================================================

initSocket(server);

// =====================================================
// API ROUTES
// =====================================================

app.use("/api/emergencies", emergencyRoutes);
app.use("/api/shelters", shelterRoutes);
app.use("/api/hazards", hazardRoutes);
app.use("/api/evacuation", evacuationRoutes);

// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message: "FloodLink API is running 🌊🚨",
  });
});

// =====================================================
// DATABASE + SERVER
// =====================================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected ✅");

    const PORT = process.env.PORT || 5050;

    server.listen(PORT, () => {
      console.log(
        `FloodLink server running on port ${PORT} 🚀`
      );
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed ❌");
    console.error(error.message);
  });
