const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// routes
const userRoutes = require("./routes/user.routes");
app.use("/api/users", userRoutes);

const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);

module.exports = app;
