const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { validationResult } = require("express-validator");
const response = require("../utils/response");
const jwtConfig = require("../config/jwt");

// REGISTER
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return response.error(res, errors.array()[0].msg, 422);
  }

  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    response.success(res, "User registered successfully");
  } catch (err) {
    response.error(res, err.message);
  }
};

// LOGIN
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return response.error(res, "Invalid credentials", 422);
  }

  const { email, password } = req.body;

  try {
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (!users.length) {
      return response.error(res, "User not found", 404);
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return response.error(res, "Invalid password", 401);
    }
    if (!user.password || typeof user.password !== "string") {
    return response.error(res, "Password not set for this user", 500);
    }
    const token = jwt.sign(
      { id: user.id, email: user.email },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn }
    );

    response.success(res, "Login successful", { token });
  } catch (err) {
    response.error(res, err.message);
  }
};
