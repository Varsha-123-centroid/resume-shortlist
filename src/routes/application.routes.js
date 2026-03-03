const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const applicationController = require("../controllers/application.controller");

// ─── Multer storage config ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = "uploads/";
    if (file.fieldname === "pan_image") folder = "uploads/pan/";
    if (file.fieldname === "resume") folder = "uploads/resumes/";

    // Create directory if it doesn't exist
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "pan_image") {
    // Accept images only
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Only image files allowed for PAN"), false);
  }
  if (file.fieldname === "resume") {
    // Accept PDF, Word docs, and images
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Only PDF/DOC/DOCX/Image files allowed for resume"), false);
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

// ─── Routes ──────────────────────────────────────────────────────────────────
// Step 1: Upload PAN card 
router.post("/upload-pan", upload.single("pan_image"), applicationController.uploadPan);

// Step 2: Upload Resume (after PAN step returns candidate_id)
router.post("/upload-resume", upload.single("resume"), applicationController.uploadResume);

// ─── Multer error handler ─────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ status: false, message: err.message });
  }
  next(err);
});

module.exports = router;