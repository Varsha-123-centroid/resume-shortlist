const pool = require("../config/database");

exports.getJobs = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM jobs ORDER BY id DESC");
    res.json({ status: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Failed to fetch jobs" });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM jobs WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ status: false, message: "Job not found" });
    }
    res.json({ status: true, data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Failed to fetch job" });
  }
};