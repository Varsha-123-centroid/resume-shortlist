const pool = require("../config/database");
const { sendShortlistEmail } = require("../utils/mailer");

// ─── 1. GET ALL APPLICANTS FOR A JOB ─────────────────────────────────────────
exports.getApplicantsByJob = async (req, res) => {
  try {
    const { job_id } = req.params;
    const [job] = await pool.query("SELECT id, title, company FROM jobs WHERE id = ?", [job_id]);
    if (job.length === 0)
      return res.status(404).json({ status: false, message: "Job not found" });

    const [applicants] = await pool.query(
      `SELECT ja.id AS application_id, ja.application_date, ja.current_stage,
              c.id AS candidate_id, c.full_name, c.email, c.phone,
              c.years_of_exp, c.summary, c.status AS candidate_status,
              ci.pan_number, ci.is_verified,
              CASE WHEN sc.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_shortlisted
       FROM job_applications ja
       JOIN candidates c ON ja.candidate_id = c.id
       LEFT JOIN candidate_identity ci ON ci.candidate_id = c.id
       LEFT JOIN shortlisted_candidates sc ON sc.job_id = ja.job_id AND sc.candidate_id = ja.candidate_id
       WHERE ja.job_id = ?
       ORDER BY ja.application_date DESC`,
      [job_id]
    );

    res.json({ status: true, message: "Applicants fetched successfully",
      data: { job: job[0], total_applicants: applicants.length, applicants } });
  } catch (error) {
    res.status(500).json({ status: false, message: "Failed to fetch applicants", detail: error.message });
  }
};

// ─── 2. GET FULL CANDIDATE PROFILE ───────────────────────────────────────────
exports.getCandidateProfile = async (req, res) => {
  try {
    const { candidate_id } = req.params;
    const [candidates] = await pool.query(
      `SELECT c.*, ci.pan_number, ci.is_verified FROM candidates c
       LEFT JOIN candidate_identity ci ON ci.candidate_id = c.id WHERE c.id = ?`,
      [candidate_id]
    );
    if (candidates.length === 0)
      return res.status(404).json({ status: false, message: "Candidate not found" });

    const [education]   = await pool.query("SELECT * FROM candidate_education WHERE candidate_id = ? ORDER BY id DESC", [candidate_id]);
    const [experience]  = await pool.query("SELECT * FROM candidate_experience WHERE candidate_id = ? ORDER BY id DESC", [candidate_id]);
    const [skills]      = await pool.query("SELECT * FROM candidate_skills WHERE candidate_id = ?", [candidate_id]);
    const [applications] = await pool.query(
      `SELECT ja.id, ja.job_id, ja.application_date, ja.current_stage, j.title, j.company, j.location
       FROM job_applications ja JOIN jobs j ON j.id = ja.job_id
       WHERE ja.candidate_id = ? ORDER BY ja.application_date DESC`,
      [candidate_id]
    );

    res.json({ status: true, message: "Candidate profile fetched successfully",
      data: { ...candidates[0], education, experience, skills, applications } });
  } catch (error) {
    res.status(500).json({ status: false, message: "Failed to fetch candidate", detail: error.message });
  }
};

// ─── 3. GENERATE / REGENERATE SHORTLIST + SEND EMAILS ────────────────────────
// POST /api/admin/jobs/:job_id/shortlist/generate
// Body: { candidate_ids: [1,2,3], send_email: true }
// candidate_ids is optional — omit for auto-shortlist all applicants
exports.generateShortlist = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { job_id } = req.params;
    const { candidate_ids, send_email = true } = req.body;

    const [job] = await conn.query("SELECT id, title, company FROM jobs WHERE id = ?", [job_id]);
    if (job.length === 0) {
      conn.release();
      return res.status(404).json({ status: false, message: "Job not found" });
    }

    await conn.beginTransaction();

    // DELETE existing shortlist (regenerate support)
    await conn.query("DELETE FROM shortlisted_candidates WHERE job_id = ?", [job_id]);

    let selectedCandidates = [];

    if (candidate_ids && Array.isArray(candidate_ids) && candidate_ids.length > 0) {
      const placeholders = candidate_ids.map(() => "?").join(",");
      const [valid] = await conn.query(
        `SELECT candidate_id FROM job_applications WHERE job_id = ? AND candidate_id IN (${placeholders})`,
        [job_id, ...candidate_ids]
      );
      selectedCandidates = valid.map(r => r.candidate_id);
    } else {
  // Fetch job requirements
  const [jobDetail] = await conn.query(
    "SELECT experience_required, skill_required FROM jobs WHERE id = ?", [job_id]
  );

  // Parse minimum years from "2-4 years" or "3+" → extract first number
  let minYears = 0;
  if (jobDetail[0]?.experience_required) {
    const match = jobDetail[0].experience_required.match(/\d+/);
    if (match) minYears = parseInt(match[0]);
  }

  const [auto] = await conn.query(
    `SELECT ja.candidate_id FROM job_applications ja
     JOIN candidates c ON c.id = ja.candidate_id
     WHERE ja.job_id = ?
       AND c.resume_path IS NOT NULL
       AND c.email IS NOT NULL
       AND c.full_name IS NOT NULL
       AND (c.years_of_exp IS NULL OR c.years_of_exp >= ?)
     ORDER BY c.years_of_exp DESC, ja.application_date ASC`,
    [job_id, minYears]
  );
  selectedCandidates = auto.map(r => r.candidate_id);
}

    if (selectedCandidates.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ status: false, message: "No valid candidates to shortlist" });
    }

    for (const cid of selectedCandidates) {
      await conn.query("INSERT INTO shortlisted_candidates (job_id, candidate_id) VALUES (?, ?)", [job_id, cid]);
      await conn.query(
        "UPDATE job_applications SET current_stage = 'Screening' WHERE job_id = ? AND candidate_id = ?",
        [job_id, cid]
      );
    }

    await conn.commit();

    // Fetch shortlist with email info
    const [shortlist] = await conn.query(
      `SELECT sc.id AS shortlist_id, sc.shortlisted_at,
              c.id AS candidate_id, c.full_name, c.email, c.phone,
              c.years_of_exp, c.summary, ci.pan_number
       FROM shortlisted_candidates sc
       JOIN candidates c ON c.id = sc.candidate_id
       LEFT JOIN candidate_identity ci ON ci.candidate_id = c.id
       WHERE sc.job_id = ? ORDER BY c.years_of_exp DESC`,
      [job_id]
    );

    // Send emails
    const emailResults = [];
    if (send_email) {
      for (const candidate of shortlist) {
        if (!candidate.email) {
          emailResults.push({ candidate_id: candidate.candidate_id, status: "skipped", reason: "No email on record" });
          continue;
        }
        try {
          await sendShortlistEmail({
            to: candidate.email,
            candidate_name: candidate.full_name,
            job_title: job[0].title,
            company: job[0].company,
            job_id,
          });
          emailResults.push({ candidate_id: candidate.candidate_id, email: candidate.email, status: "sent" });
        } catch (mailErr) {
          console.error(`Mail failed for candidate ${candidate.candidate_id}:`, mailErr.message);
          emailResults.push({ candidate_id: candidate.candidate_id, email: candidate.email, status: "failed", reason: mailErr.message });
        }
      }
    }

    res.json({
      status: true,
      message: `Shortlist generated for: ${job[0].title}`,
      data: {
        job_id: Number(job_id),
        job_title: job[0].title,
        total_shortlisted: shortlist.length,
        shortlist,
        email_notifications: send_email ? emailResults : "Emails disabled",
      },
    });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ status: false, message: "Failed to generate shortlist", detail: error.message });
  } finally {
    conn.release();
  }
};

// ─── 4. GET SHORTLIST FOR A JOB ──────────────────────────────────────────────
exports.getShortlist = async (req, res) => {
  try {
    const { job_id } = req.params;
    const [job] = await pool.query("SELECT id, title, company FROM jobs WHERE id = ?", [job_id]);
    if (job.length === 0)
      return res.status(404).json({ status: false, message: "Job not found" });

    const [shortlist] = await pool.query(
      `SELECT sc.id AS shortlist_id, sc.shortlisted_at, sc.recruiter_notes, sc.interview_score,
              c.id AS candidate_id, c.full_name, c.email, c.phone, c.years_of_exp, c.summary,
              c.status AS candidate_status, ci.pan_number, ja.current_stage
       FROM shortlisted_candidates sc
       JOIN candidates c ON c.id = sc.candidate_id
       LEFT JOIN candidate_identity ci ON ci.candidate_id = c.id
       LEFT JOIN job_applications ja ON ja.job_id = sc.job_id AND ja.candidate_id = sc.candidate_id
       WHERE sc.job_id = ?
       ORDER BY sc.interview_score DESC, c.years_of_exp DESC`,
      [job_id]
    );

    res.json({ status: true, message: "Shortlist fetched successfully",
      data: { job: job[0], total_shortlisted: shortlist.length, shortlist } });
  } catch (error) {
    res.status(500).json({ status: false, message: "Failed to fetch shortlist", detail: error.message });
  }
};

// ─── 5. UPDATE SHORTLIST ENTRY ────────────────────────────────────────────────
exports.updateShortlistEntry = async (req, res) => {
  try {
    const { shortlist_id } = req.params;
    const { recruiter_notes, interview_score, current_stage } = req.body;

    const [existing] = await pool.query("SELECT * FROM shortlisted_candidates WHERE id = ?", [shortlist_id]);
    if (existing.length === 0)
      return res.status(404).json({ status: false, message: "Shortlist entry not found" });

    await pool.query(
      `UPDATE shortlisted_candidates SET
         recruiter_notes = COALESCE(?, recruiter_notes),
         interview_score = COALESCE(?, interview_score)
       WHERE id = ?`,
      [recruiter_notes || null, interview_score ?? null, shortlist_id]
    );

    if (current_stage) {
      await pool.query(
        "UPDATE job_applications SET current_stage = ? WHERE job_id = ? AND candidate_id = ?",
        [current_stage, existing[0].job_id, existing[0].candidate_id]
      );
    }

    res.json({ status: true, message: "Shortlist entry updated successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: "Failed to update entry", detail: error.message });
  }
};

// ─── 6. REMOVE FROM SHORTLIST ─────────────────────────────────────────────────
exports.removeFromShortlist = async (req, res) => {
  try {
    const { shortlist_id } = req.params;
    const [existing] = await pool.query("SELECT * FROM shortlisted_candidates WHERE id = ?", [shortlist_id]);
    if (existing.length === 0)
      return res.status(404).json({ status: false, message: "Shortlist entry not found" });

    await pool.query("DELETE FROM shortlisted_candidates WHERE id = ?", [shortlist_id]);
    await pool.query(
      "UPDATE job_applications SET current_stage = 'Applied' WHERE job_id = ? AND candidate_id = ?",
      [existing[0].job_id, existing[0].candidate_id]
    );

    res.json({ status: true, message: "Candidate removed from shortlist" });
  } catch (error) {
    res.status(500).json({ status: false, message: "Failed to remove", detail: error.message });
  }
};

// ─── 7. RESEND EMAIL TO A SINGLE CANDIDATE ────────────────────────────────────
// POST /api/admin/shortlist/:shortlist_id/send-email
exports.resendShortlistEmail = async (req, res) => {
  try {
    const { shortlist_id } = req.params;
    const [rows] = await pool.query(
      `SELECT sc.*, c.full_name, c.email, j.title AS job_title, j.company
       FROM shortlisted_candidates sc
       JOIN candidates c ON c.id = sc.candidate_id
       JOIN jobs j ON j.id = sc.job_id
       WHERE sc.id = ?`,
      [shortlist_id]
    );

    if (rows.length === 0)
      return res.status(404).json({ status: false, message: "Shortlist entry not found" });

    const { full_name, email, job_title, company, job_id } = rows[0];
    if (!email)
      return res.status(400).json({ status: false, message: "Candidate has no email address" });

    await sendShortlistEmail({ to: email, candidate_name: full_name, job_title, company, job_id });

    res.json({ status: true, message: `Email sent successfully to ${email}` });
  } catch (error) {
    res.status(500).json({ status: false, message: "Failed to send email", detail: error.message });
  }
};