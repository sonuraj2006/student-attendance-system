
const express = require("express");
const mongoose = require("mongoose");

const Student = require("../models/student");
const Attendance = require("../models/attendance");
const Notification = require("../models/notification");
const authMiddleware = require("../middleware/authMiddleware");
const { sendAbsenceEmail, formatAbsenceMessage } = require("../services/emailService");

const router = express.Router();

router.use(authMiddleware);

function todayLocalDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// GET /api/attendance/sheet?classId=CSE-A&date=YYYY-MM-DD
// Returns all students of the class and their attendance status for the given date
router.get("/sheet", async (req, res) => {
  try {
    const { classId } = req.query;
    const date = req.query.date || todayLocalDate();

    if (!classId || !classId.trim()) {
      return res.status(400).json({ message: "classId query parameter is required." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Date must use YYYY-MM-DD format." });
    }

    const students = await Student.find({ classId: classId.trim() })
      .sort({ rollNumber: 1 })
      .lean();

    if (students.length === 0) {
      return res.json({
        classId: classId.trim(),
        date,
        count: 0,
        students: []
      });
    }

    const studentIds = students.map((s) => s._id);

    const attendanceRecords = await Attendance.find({
      studentId: { $in: studentIds },
      date
    }).lean();

    const attendanceMap = new Map();
    for (const record of attendanceRecords) {
      attendanceMap.set(String(record.studentId), record);
    }

    const sheet = students.map((student) => {
      const existing = attendanceMap.get(String(student._id));
      return {
        _id: student._id,
        studentId: student.studentId,
        name: student.name,
        rollNumber: student.rollNumber,
        classId: student.classId,
        parentName: student.parentName,
        parentEmail: student.parentEmail,
        parentPhone: student.parentPhone,
        status: existing ? existing.status : null,
        attendanceId: existing ? existing._id : null,
        notificationStatus: existing ? existing.notificationStatus : null
      };
    });

    return res.json({
      classId: classId.trim(),
      date,
      count: sheet.length,
      students: sheet
    });
  } catch (error) {
    console.error("Attendance sheet error:", error.message);
    return res.status(500).json({ message: "Unable to load attendance sheet." });
  }
});

// POST /api/attendance/batch
// Bulk mark attendance for a class
// Body: { date: "YYYY-MM-DD", records: [ { studentId: "...", status: "Present"|"Absent" } ] }
router.post("/batch", async (req, res) => {
  try {
    const date = req.body.date || todayLocalDate();
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "records must be a non-empty array." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Date must use YYYY-MM-DD format." });
    }

    const studentIds = records.map((r) => r.studentId);
    const students = await Student.find({ _id: { $in: studentIds } }).lean();
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    let presentCount = 0;
    let absentCount = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    const results = [];

    for (const item of records) {
      const student = studentMap.get(String(item.studentId));
      if (!student) continue;

      const status = item.status === "Absent" ? "Absent" : "Present";
      if (status === "Present") {
        presentCount++;
      } else {
        absentCount++;
      }

      // Upsert attendance record for (studentId, date)
      let attendance = await Attendance.findOne({ studentId: student._id, date });
      const previousStatus = attendance ? attendance.status : null;

      if (!attendance) {
        attendance = new Attendance({
          studentId: student._id,
          date,
          status,
          markedBy: req.user.sub,
          notificationStatus: status === "Absent" ? "Pending" : "NotRequired"
        });
      } else {
        attendance.status = status;
        attendance.markedBy = req.user.sub;
        if (status === "Present") {
          attendance.notificationStatus = "NotRequired";
        }
      }

      await attendance.save();

      // Trigger notification if status is Absent and wasn't already successfully sent
      if (status === "Absent") {
        const message = formatAbsenceMessage({ student, attendanceDate: date });

        let notification = await Notification.findOne({ attendanceId: attendance._id });
        if (!notification) {
          notification = new Notification({
            studentId: student._id,
            attendanceId: attendance._id,
            parentContact: student.parentEmail,
            message,
            deliveryStatus: "Pending",
            attempts: 0
          });
        }

        // Only send if not previously marked sent today, or if explicitly requested
        if (notification.deliveryStatus !== "Sent" || previousStatus !== "Absent") {
          notification.attempts = (notification.attempts || 0) + 1;
          try {
            await sendAbsenceEmail({ student, attendanceDate: date });
            notification.deliveryStatus = "Sent";
            notification.sentAt = new Date();
            attendance.notificationStatus = "Sent";
            emailsSent++;
          } catch (emailErr) {
            console.error(`Email error for ${student.name}:`, emailErr.message);
            notification.deliveryStatus = "Failed";
            attendance.notificationStatus = "Failed";
            emailsFailed++;
          }
          await notification.save();
          await attendance.save();
        }
      }

      results.push({
        studentId: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        status,
        notificationStatus: attendance.notificationStatus
      });
    }

    return res.json({
      message: `Attendance saved successfully for ${records.length} students.`,
      date,
      total: records.length,
      presentCount,
      absentCount,
      emailsSent,
      emailsFailed,
      results
    });
  } catch (error) {
    console.error("Batch attendance error:", error.message);
    return res.status(500).json({ message: "Unable to process batch attendance." });
  }
});

// POST /api/attendance
// Body: { studentId: "<MongoDB student _id>", status: "Present"|"Absent" }
// Optional date: "YYYY-MM-DD". Defaults to today's date in India.
router.post("/", async (req, res) => {
  try {
    const { studentId, status } = req.body;
    const date = req.body.date || todayLocalDate();

    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({
        message: "A valid MongoDB student ID is required."
      });
    }

    if (!["Present", "Absent"].includes(status)) {
      return res.status(400).json({
        message: 'Status must be "Present" or "Absent".'
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        message: "Date must use YYYY-MM-DD format."
      });
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({ message: "Invalid calendar date." });
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    // Upsert or create
    let attendance = await Attendance.findOne({ studentId: student._id, date });

    if (!attendance) {
      attendance = await Attendance.create({
        studentId: student._id,
        date,
        status,
        markedBy: req.user.sub,
        notificationStatus: status === "Absent" ? "Pending" : "NotRequired"
      });
    } else {
      attendance.status = status;
      attendance.markedBy = req.user.sub;
      if (status === "Present") {
        attendance.notificationStatus = "NotRequired";
      }
      await attendance.save();
    }

    if (status === "Present") {
      return res.status(200).json({
        message: "Attendance marked Present.",
        attendance
      });
    }

    const message = formatAbsenceMessage({ student, attendanceDate: date });

    // Create or find notification log
    let notification = await Notification.findOne({ attendanceId: attendance._id });
    if (!notification) {
      notification = await Notification.create({
        studentId: student._id,
        attendanceId: attendance._id,
        parentContact: student.parentEmail,
        message,
        deliveryStatus: "Pending",
        attempts: 0
      });
    }

    try {
      await Notification.updateOne(
        { _id: notification._id },
        { $inc: { attempts: 1 } }
      );

      await sendAbsenceEmail({ student, attendanceDate: date });

      notification.deliveryStatus = "Sent";
      notification.sentAt = new Date();
      await notification.save();

      attendance.notificationStatus = "Sent";
      await attendance.save();

      return res.status(200).json({
        message: "Attendance marked Absent and parent email sent.",
        attendance,
        notification: {
          deliveryStatus: notification.deliveryStatus,
          sentAt: notification.sentAt
        }
      });
    } catch (emailError) {
      console.error("Parent email failed:", emailError.message);

      notification.deliveryStatus = "Failed";
      await notification.save();

      attendance.notificationStatus = "Failed";
      await attendance.save();

      return res.status(200).json({
        message:
          "Attendance was recorded, but the parent email failed. Retry it after checking email configuration.",
        attendance,
        notification: {
          deliveryStatus: "Failed"
        }
      });
    }
  } catch (error) {
    console.error("Attendance API error:", error.message);
    return res.status(500).json({
      message: "Unable to record attendance."
    });
  }
});

// GET /api/attendance?date=YYYY-MM-DD&classId=CSE-A
router.get("/", async (req, res) => {
  try {
    const date = req.query.date || todayLocalDate();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        message: "Date must use YYYY-MM-DD format."
      });
    }

    const filter = { date };

    let records = await Attendance.find(filter)
      .populate("studentId", "studentId name rollNumber classId")
      .populate("markedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    if (typeof req.query.classId === "string" && req.query.classId.trim()) {
      records = records.filter(
        (record) => record.studentId?.classId === req.query.classId.trim()
      );
    }

    return res.json({
      date,
      count: records.length,
      attendance: records
    });
  } catch (error) {
    console.error("Attendance history error:", error.message);
    return res.status(500).json({
      message: "Unable to retrieve attendance."
    });
  }
});

module.exports = router;
