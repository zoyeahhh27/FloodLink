let io = null;

const initSocket = (server) => {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://flood-link.vercel.app",
      ],
      methods: ["GET", "POST", "PATCH"],
    },
  });

  io.on("connection", (socket) => {
    console.log(
      `Responder connected: ${socket.id} 🟢`
    );

    socket.on("disconnect", () => {
      console.log(
        `Responder disconnected: ${socket.id} 🔴`
      );
    });
  });

  console.log("Socket.IO initialized ✅");

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized"
    );
  }

  return io;
};

module.exports = {
  initSocket,
  getIO,
};