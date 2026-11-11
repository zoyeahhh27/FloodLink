const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");

// =====================================================
// SOCKET
// =====================================================

const { initSocket } = require("./socket");

// =====================================================
// ROUTES
// =====================================================

const emergencyRoutes =
  require("./routes/emergencyRoutes");

const shelterRoutes =
  require("./routes/shelterRoutes");

const hazardRoutes =
  require("./routes/hazardRoutes");

const evacuationRoutes =
  require("./routes/evacuationRoutes");

// =====================================================
// CONFIG
// =====================================================

dotenv.config();

const app = express();

const server =
  http.createServer(app);

// =====================================================
// SOCKET.IO
// =====================================================

initSocket(server);

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

// =====================================================
// API ROUTES
// =====================================================

app.use(
  "/api/emergencies",
  emergencyRoutes
);

app.use(
  "/api/shelters",
  shelterRoutes
);

app.use(
  "/api/hazards",
  hazardRoutes
);

app.use(
  "/api/evacuation",
  evacuationRoutes
);

// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message:
      "FloodLink API is running 🌊🚨",
  });
});

// =====================================================
// DATABASE + SERVER
// =====================================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(
      "MongoDB connected ✅"
    );

    server.listen(
      process.env.PORT,
      () => {
        console.log(
          `FloodLink server running on port ${process.env.PORT} 🚀`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed ❌"
    );

    console.error(
      error.message
    );
  });