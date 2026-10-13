
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      required: true,
    },
    parentContact: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveryStatus: {
      type: String,
      enum: ["Pending", "Sent", "Failed"],
      default: "Pending",
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ attendanceId: 1 }, { unique: true });

module.exports = mongoose.model("Notification", notificationSchema);
