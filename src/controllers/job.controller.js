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
// ─── 3. CREATE JOB (Admin only) ──────────────────────────────────────────────
// POST /api/jobs
// Headers: Authorization: Bearer <token>
// Body (JSON): title, company, salary, department, skill_required, experience_required, location, description
exports.createJob = async (req, res) => {
  try {
    const {
      title,
      company,
      salary,
      department,
      skill_required,
      experience_required,
      location,
      description,
      is_premium
    } = req.body;

    // ── Required field validation ──
    if (!title || !company || !salary) {
      return res.status(400).json({
        status: false,
        message: "title, company, and salary are required",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO jobs 
        (title, company, salary, department, skill_required, experience_required, location, description, is_premium)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)`,
      [
        title,
        company,
        salary,
        department || null,
        skill_required || null,
        experience_required || null,
        location || null,
        description || null,
        is_premium ? 1 : 0
      ]
    );

    // Fetch the newly created job to return full data
    const [newJob] = await pool.query("SELECT * FROM jobs WHERE id = ?", [result.insertId]);

    res.status(201).json({
      status: true,
      message: "Job created successfully",
      data: newJob[0],
    });
  } catch (error) {
    console.error("createJob error:", error);
    res.status(500).json({ status: false, message: "Failed to create job", detail: error.message });
  }
};

// ─── 4. UPDATE JOB (Admin only) ──────────────────────────────────────────────
// PUT /api/jobs/:id
// Headers: Authorization: Bearer <token>
exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query("SELECT id FROM jobs WHERE id = ?", [id]);
    if (existing.length === 0)
      return res.status(404).json({ status: false, message: "Job not found" });

    const {
      title, company, salary, department,
      skill_required, experience_required,
      location, description, is_premium
    } = req.body;

    // Build query dynamically to avoid CASE WHEN issue
    const fields = [];
    const values = [];

    if (title !== undefined)               { fields.push("title = ?");               values.push(title); }
    if (company !== undefined)             { fields.push("company = ?");             values.push(company); }
    if (salary !== undefined)              { fields.push("salary = ?");              values.push(salary); }
    if (department !== undefined)          { fields.push("department = ?");          values.push(department); }
    if (skill_required !== undefined)      { fields.push("skill_required = ?");      values.push(skill_required); }
    if (experience_required !== undefined) { fields.push("experience_required = ?"); values.push(experience_required); }
    if (location !== undefined)            { fields.push("location = ?");            values.push(location); }
    if (description !== undefined)         { fields.push("description = ?");         values.push(description); }
    if (is_premium !== undefined)          { fields.push("is_premium = ?");          values.push(is_premium ? 1 : 0); }

    if (fields.length === 0)
      return res.status(400).json({ status: false, message: "No fields to update" });

    values.push(id);
    await pool.query(`UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`, values);

    const [updated] = await pool.query("SELECT * FROM jobs WHERE id = ?", [id]);

    res.json({ status: true, message: "Job updated successfully", data: updated[0] });
  } catch (error) {
    console.error("updateJob error:", error);
    res.status(500).json({ status: false, message: "Failed to update job", detail: error.message });
  }
};

// ─── 5. DELETE JOB (Admin only) ──────────────────────────────────────────────
// DELETE /api/jobs/:id
// Headers: Authorization: Bearer <token>
exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query("SELECT id FROM jobs WHERE id = ?", [id]);
    if (existing.length === 0)
      return res.status(404).json({ status: false, message: "Job not found" });

    await pool.query("DELETE FROM jobs WHERE id = ?", [id]);

    res.json({ status: true, message: "Job deleted successfully" });
  } catch (error) {
    console.error("deleteJob error:", error);
    res.status(500).json({ status: false, message: "Failed to delete job", detail: error.message });
  }
};