const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// All admin routes protected
router.use(authMiddleware);

// ── Applicants ──────────────────────────────────────────────────────
router.get("/jobs/:job_id/applicants",          adminController.getApplicantsByJob);

// ── Candidate Profile ───────────────────────────────────────────────
router.get("/candidates/:candidate_id",         adminController.getCandidateProfile);

// ── Shortlist ───────────────────────────────────────────────────────
router.post("/jobs/:job_id/shortlist/generate", adminController.generateShortlist);
router.get("/jobs/:job_id/shortlist",           adminController.getShortlist);
router.put("/shortlist/:shortlist_id",          adminController.updateShortlistEntry);
router.delete("/shortlist/:shortlist_id",       adminController.removeFromShortlist);

// ── Resend email to single candidate ───────────────────────────────
router.post("/shortlist/:shortlist_id/send-email", adminController.resendShortlistEmail);

module.exports = router;