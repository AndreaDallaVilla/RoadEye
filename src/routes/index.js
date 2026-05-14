const express = require("express");

const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const reportRoutes = require("./report.routes");
const dashboardRoutes = require("./dashboard.routes");
const mapsRoutes = require("./maps.routes");
const announcementsRoutes = require("./announcements.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/reports", reportRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/maps", mapsRoutes);
router.use("/announcements", announcementsRoutes);

module.exports = router;
