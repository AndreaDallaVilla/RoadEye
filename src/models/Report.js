const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {},
  {
    timestamps: true,
    strict: false,
  },
);

module.exports = mongoose.model("Report", reportSchema);
