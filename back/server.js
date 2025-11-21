require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const db = require("./models");
const PORT = process.env.PORT || 5000;
const authRoutes = require("./routes/auth");
const initializeDatabase = require("./seeders/init");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("io", io);

app.use("/auth", authRoutes);

const socketHandler = require("./socket");
socketHandler(io);

db.sequelize
  .sync({ alter: false })
  .then(async () => {
    console.log("Database connected successfully");

    // 개발 모드에서만 더미 데이터 초기화
    if (process.env.NODE_ENV === "development") {
      await initializeDatabase();
    }

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Socket.IO is ready`);
    });
  })
  .catch((err) => {
    console.error("Unable to connect to database:", err);
  });
