const pool = require("../config/database");

exports.getJobs = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM jobs ORDER BY id DESC");

    res.json({
      status: true,
      data: rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: false,
      message: "Failed to fetch jobs"
    });
  }
};
