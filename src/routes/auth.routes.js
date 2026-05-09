const express = require("express");

const authController = require("../controllers/auth.controller");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/phone-countries", authController.listPhoneCountries);
router.get("/public-entities", authController.listPublicEntities);
router.get("/me", authenticate, authController.getCurrentUser);
router.post("/logout", authenticate, authController.logout);

module.exports = router;
