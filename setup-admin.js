
require("dotenv").config();

const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");
const bcrypt = require("bcryptjs");

const connectDB = require("./config/db");
const User = require("./models/user");

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    await connectDB();

    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log("An administrator already exists. Setup cancelled.");
      return;
    }

    const name = (await rl.question("Admin name: ")).trim();
    const email = (await rl.question("Admin email: "))
      .trim()
      .toLowerCase();
    const password = await rl.question(
      "Admin password (input will be visible): "
    );
    const confirm = await rl.question("Confirm password: ");

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid name and email.");
    }

    if (password.length < 12 || password.length > 72) {
      throw new Error("Password must be 12–72 characters long.");
    }

    if (password !== confirm) {
      throw new Error("Passwords do not match.");
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new Error("This email is already registered.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await User.create({
      name,
      email,
      passwordHash,
      role: "admin",
    });

    console.log("Initial administrator created successfully.");
    console.log("Email:", email);
    console.log("You can now log in using the login API.");
  } finally {
    rl.close();
    await require("mongoose").disconnect();
  }
}

main().catch((error) => {
  console.error("Admin setup failed:", error.message);
  process.exitCode = 1;
});
