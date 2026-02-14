const db = require("../config/database");

// GET users
exports.index = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM users");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CREATE user
exports.store = async (req, res) => {
  try {
    const { name, email } = req.body;

    const [result] = await db.query(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      [name, email]
    );

    res.json({
      message: "User created successfully",
      id: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
