const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");

router.get("/", userController.index);
router.post("/", userController.store);

module.exports = router;
