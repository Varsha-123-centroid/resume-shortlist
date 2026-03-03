const pool = require("../config/database");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PAN_PARSE_API = process.env.PAN_PARSE_API_URL;     // e.g. http://localhost:8000/parse-pan
const RESUME_PARSE_API = process.env.RESUME_PARSE_API_URL; // e.g. http://localhost:8000/parse-resume

// ─── HELPER: call python API with a file ─────────────────────────────────────
async function callPythonAPI(apiUrl, filePath, fileFieldName = "file") {
  const form = new FormData();
  form.append(fileFieldName, fs.createReadStream(filePath));
  const response = await axios.post(apiUrl, form, {
    headers: form.getHeaders(),
    timeout: 60000,
  });
  return response.data;
}

// ─── 1. UPLOAD PAN ───────────────────────────────────────────────────────────
// POST /api/applications/upload-pan
// Body (multipart): job_id, pan_image (file)
exports.uploadPan = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ status: false, message: "job_id is required" });
    if (!req.file) return res.status(400).json({ status: false, message: "pan_image file is required" });

    const panImagePath = req.file.path; // saved by multer

    // ── Call Python PAN parsing API ──
    let panData;
    try {
      panData = await callPythonAPI(PAN_PARSE_API, panImagePath, "file");
    } catch (err) {
      console.error("PAN API error:", err.message);
      return res.status(502).json({ status: false, message: "PAN parsing service failed", detail: err.message });
    }

    /*
      Expected panData shape from Python API:
      {
        pan_number: "ABCDE1234F",
        full_name: "John Doe",
        dob: "1990-01-01",          // YYYY-MM-DD
        father_name: "James Doe"
      }
    */
   // const { pan_number, full_name, dob, father_name } = panData;
//const { pan_number, name: full_name, date_of_birth: dob, father_name } = panData;
   const dob = date_of_birth
  ? date_of_birth.split("/").reverse().join("-")
  : null;

if (!pan_number) {
      return res.status(422).json({ status: false, message: "Could not extract PAN number from image" });
    }

    await conn.beginTransaction();

    // ── Check if PAN already exists ──
    const [existingIdentity] = await conn.query(
      "SELECT ci.id, ci.candidate_id FROM candidate_identity ci WHERE ci.pan_number = ?",
      [pan_number]
    );

    let candidate_id;

    if (existingIdentity.length > 0) {
      // PAN already on record — reuse candidate
      candidate_id = existingIdentity[0].candidate_id;

      // Update pan_image_path on candidates row
      await conn.query("UPDATE candidates SET pan_image_path = ? WHERE id = ?", [panImagePath, candidate_id]);
    } else {
      // New candidate — insert into candidates first
      const [candResult] = await conn.query(
        `INSERT INTO candidates (full_name, dob, father_name, pan_image_path, status)
         VALUES (?, ?, ?, ?, 'Pending')`,
        [full_name || null, dob || null, father_name || null, panImagePath]
      );
      candidate_id = candResult.insertId;

      // Insert into candidate_identity
      await conn.query(
        "INSERT INTO candidate_identity (candidate_id, pan_number, is_verified) VALUES (?, ?, FALSE)",
        [candidate_id, pan_number]
      );
    }

    await conn.commit();

    res.json({
      status: true,
      message: "PAN uploaded and parsed successfully",
      data: {
        candidate_id,
        pan_number,
        full_name,
        dob,
        father_name,
        is_new_candidate: existingIdentity.length === 0,
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error("uploadPan error:", error);
    res.status(500).json({ status: false, message: "Failed to process PAN", detail: error.message });
  } finally {
    conn.release();
  }
};

// ─── 2. UPLOAD RESUME ────────────────────────────────────────────────────────
// POST /api/applications/upload-resume
// Body (multipart): job_id, candidate_id, resume (file)
exports.uploadResume = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { job_id, candidate_id } = req.body;
    if (!job_id || !candidate_id)
      return res.status(400).json({ status: false, message: "job_id and candidate_id are required" });
    if (!req.file)
      return res.status(400).json({ status: false, message: "resume file is required" });

    const resumePath = req.file.path;

    // ── Verify candidate exists ──
    const [candRows] = await conn.query("SELECT id FROM candidates WHERE id = ?", [candidate_id]);
    if (candRows.length === 0)
      return res.status(404).json({ status: false, message: "Candidate not found" });

    // ── Call Python resume parsing API ──
    let resumeData;
    try {
      resumeData = await callPythonAPI(RESUME_PARSE_API, resumePath, "file");
    } catch (err) {
      console.error("Resume API error:", err.message);
      return res.status(502).json({ status: false, message: "Resume parsing service failed", detail: err.message });
    }

    /*
      Expected resumeData shape from Python API:
      {
        full_name: "John Doe",
        email: "john@example.com",
        phone: "9876543210",
        summary: "Experienced developer...",
        years_of_exp: 5,
        education: [
          { institution: "MIT", degree: "B.Tech", start_date: "2010", end_date: "2014" }
        ],
        experience: [
          { company: "Acme", title: "Developer", job_description: "...", start_date: "2014-06", end_date: "2020-01" }
        ],
        skills: [
          { skill_name: "Python", skill_type: "Technology" },
          { skill_name: "Communication", skill_type: "Skill" }
        ]
      }
    */

    const { full_name, email, phone, summary, years_of_exp, education = [], experience = [], skills = [] } = resumeData;

    await conn.beginTransaction();

    // ── Update candidates row ──
    await conn.query(
      `UPDATE candidates
       SET full_name = COALESCE(?, full_name),
           email     = COALESCE(?, email),
           phone     = COALESCE(?, phone),
           summary   = COALESCE(?, summary),
           years_of_exp = COALESCE(?, years_of_exp),
           resume_path = ?
       WHERE id = ?`,
      [full_name || null, email || null, phone || null, summary || null, years_of_exp ?? null, resumePath, candidate_id]
    );
await conn.query("DELETE FROM candidate_education WHERE candidate_id = ?", [candidate_id]);
await conn.query("DELETE FROM candidate_experience WHERE candidate_id = ?", [candidate_id]);
await conn.query("DELETE FROM candidate_skills WHERE candidate_id = ?", [candidate_id]);

    // ── Insert education ──
    for (const edu of education) {
      await conn.query(
        "INSERT INTO candidate_education (candidate_id, institution, degree, start_date, end_date) VALUES (?, ?, ?, ?, ?)",
        [candidate_id, edu.institution || null, edu.degree || null, edu.start_date || null, edu.end_date || null]
      );
    }

    // ── Insert experience ──
    for (const exp of experience) {
      await conn.query(
        "INSERT INTO candidate_experience (candidate_id, company, title, job_description, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
        [candidate_id, exp.company || null, exp.title || null, exp.job_description || null, exp.start_date || null, exp.end_date || null]
      );
    }

    // ── Insert skills ──
    for (const sk of skills) {
      await conn.query(
        "INSERT INTO candidate_skills (candidate_id, skill_name, skill_type) VALUES (?, ?, ?)",
        [candidate_id, sk.skill_name || null, sk.skill_type || "Skill"]
      );
    }

    // ── Create job application record ──
    // Avoid duplicate applications for the same job
    const [existingApp] = await conn.query(
      "SELECT id FROM job_applications WHERE job_id = ? AND candidate_id = ?",
      [job_id, candidate_id]
    );

    let application_id;
    if (existingApp.length === 0) {
      const [appResult] = await conn.query(
        "INSERT INTO job_applications (job_id, candidate_id, current_stage) VALUES (?, ?, 'Applied')",
        [job_id, candidate_id]
      );
      application_id = appResult.insertId;
    } else {
      application_id = existingApp[0].id;
    }

    await conn.commit();

    res.json({
      status: true,
      message: "Resume uploaded and parsed successfully. Application submitted.",
      data: {
        application_id,
        candidate_id,
        job_id: Number(job_id),
        parsed: { full_name, email, phone, summary, years_of_exp, education, experience, skills },
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error("uploadResume error:", error);
    res.status(500).json({ status: false, message: "Failed to process resume", detail: error.message });
  } finally {
    conn.release();
  }
};