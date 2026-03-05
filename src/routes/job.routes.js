const express = require("express");
const router = express.Router();
const jobController = require("../controllers/job.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// ── Public routes (no token required) ──────────────────────────────
router.get("/",     jobController.getJobs);       // GET  /api/jobs
router.get("/:id",  jobController.getJobById);    // GET  /api/jobs/:id

// ── Protected routes (admin token required) ────────────────────────
router.post("/",        verifyToken, jobController.createJob);   // POST   /api/jobs
router.put("/:id",      verifyToken, jobController.updateJob);   // PUT    /api/jobs/:id
router.delete("/:id",   verifyToken, jobController.deleteJob);   // DELETE /api/jobs/:id

module.exports = router;