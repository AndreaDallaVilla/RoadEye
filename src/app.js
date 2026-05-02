const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const apiRouter = require("./routes");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
  }),
);
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "roadeye-api" });
});

app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
