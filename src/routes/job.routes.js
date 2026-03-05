const express = require("express");
const router = express.Router();
const jobController = require("../controllers/job.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// ── Public routes ──
router.get("/",    jobController.getJobs);
router.get("/:id", jobController.getJobById);

// ── Protected routes ──
router.post("/",      authMiddleware, jobController.createJob);
router.put("/:id",    authMiddleware, jobController.updateJob);
router.delete("/:id", authMiddleware, jobController.deleteJob);

module.exports = router;