const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const {
  registerValidation,
  loginValidation,
} = require("../validations/auth.validation");

router.post("/register", registerValidation, authController.register);
router.post("/login", loginValidation, authController.login);

module.exports = router;
