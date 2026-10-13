const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/notification");
const Attendance = require("../models/attendance");
const Student = require("../models/student");
const authMiddleware = require("../middleware/authMiddleware");
const { sendAbsenceEmail } = require("../services/emailService");

const router = express.Router();

router.use(authMiddleware);

// GET /api/notifications
// Retrieves list of parent notifications with optional status filter
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && ["Sent", "Failed", "Pending"].includes(req.query.status)) {
      filter.deliveryStatus = req.query.status;
    }

    const notifications = await Notification.find(filter)
      .populate("studentId", "studentId name rollNumber classId parentName parentEmail parentPhone")
      .populate("attendanceId", "date status notificationStatus")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({
      count: notifications.length,
      notifications
    });
  } catch (error) {
    console.error("Notifications list error:", error.message);
    return res.status(500).json({ message: "Unable to retrieve notifications." });
  }
});

// POST /api/notifications/:id/retry
// Retries sending email for a failed notification
router.post("/:id/retry", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid notification ID." });
    }

    const notification = await Notification.findById(req.params.id)
      .populate("studentId")
      .populate("attendanceId");

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    const student = notification.studentId;
    const attendance = notification.attendanceId;

    if (!student || !attendance) {
      return res.status(400).json({ message: "Associated student or attendance record not found." });
    }

    notification.attempts = (notification.attempts || 0) + 1;

    try {
      await sendAbsenceEmail({ student, attendanceDate: attendance.date });
      notification.deliveryStatus = "Sent";
      notification.sentAt = new Date();
      await notification.save();

      attendance.notificationStatus = "Sent";
      await attendance.save();

      return res.json({
        message: "Email re-sent successfully.",
        notification
      });
    } catch (emailError) {
      console.error("Notification retry failed:", emailError.message);
      notification.deliveryStatus = "Failed";
      await notification.save();

      attendance.notificationStatus = "Failed";
      await attendance.save();

      return res.status(500).json({
        message: `Retry failed: ${emailError.message}`,
        notification
      });
    }
  } catch (error) {
    console.error("Notification retry error:", error.message);
    return res.status(500).json({ message: "Unable to retry notification." });
  }
});

module.exports = router;
