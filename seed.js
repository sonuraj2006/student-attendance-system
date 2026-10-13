require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/user");
const Student = require("./models/student");
const Attendance = require("./models/attendance");
const Notification = require("./models/notification");

async function seed() {
  console.log("Starting database seeding...");
  await connectDB();

  // 1. Seed or update Users
  const adminPasswordHash = await bcrypt.hash("Admin@123456", 12);
  const facultyPasswordHash = await bcrypt.hash("Faculty@123456", 12);

  let admin = await User.findOne({ email: "admin@college.edu" });
  if (!admin) {
    admin = await User.create({
      name: "System Admin",
      email: "admin@college.edu",
      passwordHash: adminPasswordHash,
      role: "admin"
    });
    console.log("Admin account created: admin@college.edu");
  }

  let faculty = await User.findOne({ email: "faculty@college.edu" });
  if (!faculty) {
    faculty = await User.create({
      name: "Prof. Neha Verma",
      email: "faculty@college.edu",
      passwordHash: facultyPasswordHash,
      role: "faculty"
    });
    console.log("Faculty account created: faculty@college.edu");
  }

  // 2. Realistic students (matching sample names from lab specification)
  const initialStudents = [
    {
      studentId: "SKL/2026/0182",
      name: "Aarav Sharma",
      rollNumber: "24R21A6601",
      classId: "CSE-A",
      parentName: "Sanjay Sharma",
      parentEmail: "sanjay.sharma@example.com",
      parentPhone: "+91 98765 43210"
    },
    {
      studentId: "SKL/2026/0094",
      name: "Diya Verma",
      rollNumber: "24R21A6602",
      classId: "CSE-A",
      parentName: "Rajesh Verma",
      parentEmail: "rajesh.verma@example.com",
      parentPhone: "+91 98765 43211"
    },
    {
      studentId: "SKL/2026/0247",
      name: "Ishaan Patel",
      rollNumber: "24R21A6603",
      classId: "CSE-A",
      parentName: "Manoj Patel",
      parentEmail: "manoj.patel@example.com",
      parentPhone: "+91 98765 43212"
    },
    {
      studentId: "SKL/2026/0038",
      name: "Ananya Kapoor",
      rollNumber: "24R21A6604",
      classId: "CSE-A",
      parentName: "Vikram Kapoor",
      parentEmail: "vikram.kapoor@example.com",
      parentPhone: "+91 98765 43213"
    },
    {
      studentId: "SKL/2026/0163",
      name: "Vihaan Rao",
      rollNumber: "24R21A6605",
      classId: "CSE-A",
      parentName: "Kishore Rao",
      parentEmail: "kishore.rao@example.com",
      parentPhone: "+91 98765 43214"
    },
    {
      studentId: "SKL/2026/0312",
      name: "Saanvi Mehta",
      rollNumber: "24R21A6606",
      classId: "CSE-A",
      parentName: "Anil Mehta",
      parentEmail: "anil.mehta@example.com",
      parentPhone: "+91 98765 43215"
    },
    {
      studentId: "SKL/2026/0021",
      name: "Rohan Iyer",
      rollNumber: "24R21A6607",
      classId: "CSE-A",
      parentName: "Suresh Iyer",
      parentEmail: "suresh.iyer@example.com",
      parentPhone: "+91 98765 43216"
    },
    {
      studentId: "SKL/2026/0271",
      name: "Myra Joshi",
      rollNumber: "24R21A6608",
      classId: "CSE-A",
      parentName: "Sunil Joshi",
      parentEmail: "sunil.joshi@example.com",
      parentPhone: "+91 98765 43217"
    },
    // CSE-B students
    {
      studentId: "SKL/2026/0401",
      name: "Rahul Kumar",
      rollNumber: "24R21A6623",
      classId: "CSE-B",
      parentName: "Mahesh Kumar",
      parentEmail: "mahesh.kumar@example.com",
      parentPhone: "+91 98765 43218"
    },
    {
      studentId: "SKL/2026/0402",
      name: "Kavya Reddy",
      rollNumber: "24R21A6624",
      classId: "CSE-B",
      parentName: "Venkat Reddy",
      parentEmail: "venkat.reddy@example.com",
      parentPhone: "+91 98765 43219"
    },
    {
      studentId: "SKL/2026/0403",
      name: "Arjun Nair",
      rollNumber: "24R21A6625",
      classId: "CSE-B",
      parentName: "Gopal Nair",
      parentEmail: "gopal.nair@example.com",
      parentPhone: "+91 98765 43220"
    }
  ];

  const studentDocs = [];
  for (const s of initialStudents) {
    let student = await Student.findOne({ studentId: s.studentId });
    if (!student) {
      student = await Student.create(s);
      console.log(`Created student: ${s.name} (${s.classId})`);
    }
    studentDocs.push(student);
  }

  // 3. Seed past attendance records (past 3 days)
  const pastDates = ["2026-10-09", "2026-10-10", "2026-10-11"];
  const markerId = faculty ? faculty._id : admin._id;

  for (const date of pastDates) {
    for (let i = 0; i < studentDocs.length; i++) {
      const student = studentDocs[i];
      // Mark 1 or 2 students absent on each date
      const isAbsent = (i + date.charCodeAt(date.length - 1)) % 5 === 0;
      const status = isAbsent ? "Absent" : "Present";

      let attendance = await Attendance.findOne({ studentId: student._id, date });
      if (!attendance) {
        attendance = await Attendance.create({
          studentId: student._id,
          date,
          status,
          markedBy: markerId,
          notificationStatus: isAbsent ? "Sent" : "NotRequired"
        });

        if (isAbsent) {
          await Notification.create({
            studentId: student._id,
            attendanceId: attendance._id,
            parentContact: student.parentEmail,
            message: `Dear Parent,\n\nYour child, ${student.name} (Roll No. ${student.rollNumber}), has been marked absent for today's classes on ${date}.\n\nPlease contact the college if you need further information.\n\nRegards,\nCollege Attendance System`,
            deliveryStatus: "Sent",
            sentAt: new Date(`${date}T10:15:00.000Z`),
            attempts: 1
          });
        }
      }
    }
  }

  console.log("Seeding completed successfully!");
  console.log("Credentials:");
  console.log("  Admin:   admin@college.edu / Admin@123456");
  console.log("  Faculty: faculty@college.edu / Faculty@123456");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
