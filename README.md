# Student Attendance System

A modern full-stack web application designed for educational institutions to record, manage, and analyze student attendance with real-time reporting and automated email notifications.

## Features

- **Authentication & Roles**: Secure JWT-based authentication for Administrators and Faculty.
- **Attendance Management**: Quick batch attendance marking (Present / Absent / Late) with customizable dates.
- **Student & Class Directory**: Search, filter, and manage students by class, branch, and roll number.
- **Reports & Analytics**: Comprehensive attendance percentages, low-attendance alerts, and export capabilities.
- **Email Notifications**: Automated email alerts to students and guardians for low attendance.

---

## Tech Stack

- **Backend**: Node.js & Express.js
- **Database**: MongoDB Atlas with Mongoose ORM
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (Modern responsive UI)
- **Security**: bcryptjs password hashing, JSON Web Tokens (JWT), express-rate-limit

---

## Local Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/<your-username>/student-attendance-system.git
cd student-attendance-system
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory based on `.env.example`:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_app_password
```

### 3. Database Seeding & Admin Setup
- To create the initial administrator:
  ```bash
  npm run setup:admin
  ```
- To seed sample student and class data:
  ```bash
  npm run seed
  ```

### 4. Run the Application
- In development mode:
  ```bash
  npm run dev
  ```
- In production mode:
  ```bash
  npm start
  ```
Access the application at `http://localhost:5000`.

---

## Deployment (Render.com)

1. Push your repository to GitHub.
2. Sign up on [Render](https://render.com) and create a new **Web Service**.
3. Connect your GitHub repository.
4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. In **Environment Variables**, add:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `EMAIL_USER`
   - `EMAIL_PASS`
6. Click **Deploy**. Render will deploy your application on a live HTTPS domain.
