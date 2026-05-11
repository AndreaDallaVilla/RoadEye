const express = require("express");

const authController = require("../controllers/auth.controller");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const {
  emailOnlySchema,
  loginSchema,
  phoneCountriesQuerySchema,
  registerSchema,
  resetPasswordSchema,
} = require("../validators/auth.validation");

const router = express.Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/email-verification/request", validate(emailOnlySchema), authController.requestEmailVerification);
router.post("/login", validate(loginSchema), authController.login);
router.get("/phone-countries", validate(phoneCountriesQuerySchema, "query"), authController.listPhoneCountries);
router.post("/password-reset/request", validate(emailOnlySchema), authController.requestPasswordReset);
router.post("/password-reset/confirm", validate(resetPasswordSchema), authController.resetPassword);
router.get("/public-entities", authController.listPublicEntities);
router.get("/me", authenticate, authController.getCurrentUser);
router.post("/logout", authenticate, authController.logout);

module.exports = router;
