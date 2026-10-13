
const express = require("express");
const mongoose = require("mongoose");

const Student = require("../models/student");
const Attendance = require("../models/attendance");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can modify student records."
    });
  }
  next();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleDatabaseError(error, res) {
  if (error.code === 11000) {
    return res.status(409).json({
      message: "This student ID or class and roll number already exists."
    });
  }

  console.error("Student API error:", error.message);
  return res.status(500).json({
    message: "Unable to process the student request."
  });
}

// GET /api/students
// Admin and faculty can view/search students.
// Optional query parameters: ?classId=CSE-A&search=101
router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (typeof req.query.classId === "string" && req.query.classId.trim()) {
      filter.classId = req.query.classId.trim();
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = escapeRegex(req.query.search.trim());

      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { studentId: { $regex: search, $options: "i" } }
      ];
    }

    const students = await Student.find(filter)
      .sort({ classId: 1, rollNumber: 1 })
      .limit(500)
      .lean();

    return res.json({
      count: students.length,
      students
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

// GET /api/students/classes
// Get list of distinct classes
router.get("/classes", async (req, res) => {
  try {
    const classes = await Student.distinct("classId");
    return res.json({
      classes: classes.filter(Boolean).sort()
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

// GET /api/students/:id
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid student ID." });
    }

    const student = await Student.findById(req.params.id).lean();

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    return res.json({ student });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

// POST /api/students
// Admin only
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      studentId,
      name,
      rollNumber,
      classId,
      parentName,
      parentEmail,
      parentPhone
    } = req.body;

    const requiredFields = {
      studentId,
      name,
      rollNumber,
      classId,
      parentName,
      parentEmail
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (typeof value !== "string" || !value.trim()) {
        return res.status(400).json({
          message: `${field} is required and must be text.`
        });
      }
    }

    if (!validEmail(parentEmail.trim())) {
      return res.status(400).json({
        message: "Enter a valid parent email address."
      });
    }

    if (
      parentPhone !== undefined &&
      typeof parentPhone !== "string"
    ) {
      return res.status(400).json({
        message: "Parent phone must be text."
      });
    }

    const student = await Student.create({
      studentId: studentId.trim(),
      name: name.trim(),
      rollNumber: rollNumber.trim(),
      classId: classId.trim(),
      parentName: parentName.trim(),
      parentEmail: parentEmail.trim().toLowerCase(),
      parentPhone: (parentPhone || "").trim()
    });

    return res.status(201).json({
      message: "Student added successfully.",
      student
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

// PUT /api/students/:id
// Admin only; only approved fields can be updated.
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid student ID." });
    }

    const allowedFields = [
      "studentId",
      "name",
      "rollNumber",
      "classId",
      "parentName",
      "parentEmail",
      "parentPhone"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "string") {
          return res.status(400).json({
            message: `${field} must be text.`
          });
        }

        updates[field] = req.body[field].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "Provide at least one field to update."
      });
    }

    for (const field of [
      "studentId",
      "name",
      "rollNumber",
      "classId",
      "parentName",
      "parentEmail"
    ]) {
      if (
        updates[field] !== undefined &&
        !updates[field]
      ) {
        return res.status(400).json({
          message: `${field} cannot be empty.`
        });
      }
    }

    if (updates.parentEmail !== undefined) {
      updates.parentEmail = updates.parentEmail.toLowerCase();

      if (!validEmail(updates.parentEmail)) {
        return res.status(400).json({
          message: "Enter a valid parent email address."
        });
      }
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    return res.json({
      message: "Student updated successfully.",
      student
    });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

// DELETE /api/students/:id
// Admin only; preserve students with attendance history.
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid student ID." });
    }

    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    const attendanceExists = await Attendance.exists({
      studentId: student._id
    });

    if (attendanceExists) {
      return res.status(409).json({
        message:
          "This student has attendance history and cannot be deleted. Update the record instead."
      });
    }

    await Student.deleteOne({ _id: student._id });

    return res.json({ message: "Student deleted successfully." });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
});

module.exports = router;
