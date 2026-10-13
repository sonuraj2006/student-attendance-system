
const express = require("express");
const Attendance = require("../models/attendance");
const Student = require("../models/student");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// All report endpoints require authentication.
router.use(authMiddleware);

// GET /api/reports
// Returns attendance summary and student-wise attendance statistics.
router.get("/", async (req, res) => {
  try {
    const { startDate, endDate, classId } = req.query;

    const match = {};

    if (startDate || endDate) {
      match.date = {};

      if (startDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          return res.status(400).json({
            message: "startDate must use YYYY-MM-DD format."
          });
        }
        match.date.$gte = startDate;
      }

      if (endDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          return res.status(400).json({
            message: "endDate must use YYYY-MM-DD format."
          });
        }
        match.date.$lte = endDate;
      }

      if (startDate && endDate && startDate > endDate) {
        return res.status(400).json({
          message: "startDate cannot be after endDate."
        });
      }
    }

    const studentsFilter = classId
      ? { classId: String(classId).trim() }
      : {};

    const students = await Student.find(studentsFilter)
      .select("_id studentId name rollNumber classId")
      .lean();

    const studentIds = students.map((student) => student._id);

    match.studentId = { $in: studentIds };

    const records = await Attendance.find(match)
      .select("studentId date status notificationStatus")
      .lean();

    const studentStats = new Map();

    for (const student of students) {
      studentStats.set(String(student._id), {
        studentId: student.studentId,
        name: student.name,
        rollNumber: student.rollNumber,
        classId: student.classId,
        present: 0,
        absent: 0,
        total: 0,
        attendancePercentage: 0
      });
    }

    let presentCount = 0;
    let absentCount = 0;

    for (const record of records) {
      const stats = studentStats.get(String(record.studentId));
      if (!stats) continue;

      stats.total++;

      if (record.status === "Present") {
        stats.present++;
        presentCount++;
      } else if (record.status === "Absent") {
        stats.absent++;
        absentCount++;
      }
    }

    for (const stats of studentStats.values()) {
      stats.attendancePercentage =
        stats.total > 0
          ? Number(((stats.present / stats.total) * 100).toFixed(2))
          : 0;
    }

    const total = presentCount + absentCount;

    return res.json({
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        classId: classId || null
      },
      summary: {
        totalStudents: students.length,
        totalAttendanceRecords: total,
        present: presentCount,
        absent: absentCount,
        attendancePercentage:
          total > 0
            ? Number(((presentCount / total) * 100).toFixed(2))
            : 0
      },
      students: Array.from(studentStats.values())
    });
  } catch (error) {
    console.error("Reports API error:", error.message);
    return res.status(500).json({
      message: "Unable to generate attendance reports."
    });
  }
});

module.exports = router;
