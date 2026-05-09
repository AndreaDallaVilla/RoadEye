const express = require("express");

const authController = require("../controllers/auth.controller");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();

router.post("/register", authController.register);
router.post("/email-verification/request", authController.requestEmailVerification);
router.post("/login", authController.login);
router.post("/password-reset/request", authController.requestPasswordReset);
router.post("/password-reset/confirm", authController.resetPassword);
router.get("/public-entities", authController.listPublicEntities);
router.get("/me", authenticate, authController.getCurrentUser);
router.post("/logout", authenticate, authController.logout);

module.exports = router;
