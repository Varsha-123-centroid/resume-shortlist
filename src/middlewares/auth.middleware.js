const jwt = require("jsonwebtoken");
const jwtConfig = require("../config/jwt");

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    req.user = jwt.verify(token, jwtConfig.secret);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
