
const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    throw new Error("EMAIL_USER or EMAIL_PASS is missing from .env");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  return transporter;
}

function formatAbsenceMessage({ student, attendanceDate }) {
  const dateLabel = new Date(`${attendanceDate}T00:00:00`).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
  );

  return (
    `Dear Parent,\n\n` +
    `Your child, ${student.name} (Roll No. ${student.rollNumber}), has been marked absent for today's classes on ${dateLabel}.\n\n` +
    `Please contact the college if you need further information.\n\n` +
    `Regards,\nCollege Attendance System`
  );
}

async function sendAbsenceEmail({ student, attendanceDate }) {
  const mailer = getTransporter();

  const messageText = formatAbsenceMessage({ student, attendanceDate });

  const message = {
    from: process.env.EMAIL_USER,
    to: student.parentEmail,
    subject: "Student Attendance Alert",
    text: messageText,
  };

  return mailer.sendMail(message);
}

module.exports = { sendAbsenceEmail, formatAbsenceMessage };
