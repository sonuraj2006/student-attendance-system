
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },
    classId: {
      type: String,
      required: true,
      trim: true,
    },
    parentName: {
      type: String,
      required: true,
      trim: true,
    },
    parentEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    parentPhone: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

studentSchema.index({ classId: 1, rollNumber: 1 }, { unique: true });

module.exports = mongoose.model("Student", studentSchema);
