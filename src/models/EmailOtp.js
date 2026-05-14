const mongoose = require("mongoose");

const emailOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["email-verification", "password-reset"],
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    verifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

emailOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.model("EmailOtp", emailOtpSchema);
