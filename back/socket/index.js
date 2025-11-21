const jwt = require("jsonwebtoken");
const db = require("../models");

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db.User.findByPk(decoded.email);

      if (!user) {
        return next(new Error("Authentication error: Invalid user"));
      }

      socket.user = {
        email: user.email,
        name: user.name,
      };

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.id})`);

    socket.join(`user:${socket.user.email}`);

    socket.emit("connected", {
      message: "소켓 연결 성공",
      user: socket.user,
    });

    socket.on("device:status", (data) => {
      console.log("Device status update:", data);
      io.emit("device:status:update", {
        userEmail: socket.user.email,
        ...data,
      });
    });

    socket.on("device:control", (data) => {
      console.log("Device control command:", data);
      socket.broadcast.emit("device:control:command", {
        userEmail: socket.user.email,
        ...data,
      });
    });

    socket.on("disconnect", (reason) => {
      console.log(
        `User disconnected: ${socket.user.name} (${socket.id}) - Reason: ${reason}`
      );
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  return io;
};
