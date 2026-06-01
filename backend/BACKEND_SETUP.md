# CampusAssist Backend Setup Guide

## Prerequisites
- Node.js v18+
- MongoDB Atlas account (free tier works)

## Steps to Connect MongoDB Atlas

1. **Install dependencies**
   ```
   cd backend
   npm install
   ```

2. **Create .env file**
   ```
   copy .env.example .env
   ```

3. **Add your MongoDB Atlas URI to .env**
   - Go to MongoDB Atlas → Connect → Drivers
   - Copy the connection string
   - Replace `<username>`, `<password>`, `<cluster>` in MONGO_URI

4. **Run the server**
   ```
   npm run dev        # development (auto-restart)
   npm start          # production
   ```

5. **Server runs at:** http://localhost:5000

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | Public | Register student |
| POST | /api/auth/login | Public | Login |
| GET | /api/auth/me | Protected | Get current user |
| GET | /api/students | Admin | All students |
| GET | /api/students/search/:q | Protected | Search students |
| GET | /api/requests | Protected | My requests |
| POST | /api/requests | Protected | Submit request |
| PUT | /api/requests/:id/status | Admin | Update status |
| GET | /api/leave | Protected | My leave apps |
| POST | /api/leave | Protected | Submit leave |
| PUT | /api/leave/:id/status | Admin | Approve/Reject |
| GET | /api/notices | Protected | All notices |
| POST | /api/notices | Admin | Create notice |
| POST | /api/chat | Protected | Chat with bot |
| GET | /api/exam | Protected | Exam schedule |
| GET | /api/fees | Protected | Fee details |
| GET | /api/library | Protected | Book catalog |
| GET | /api/library/borrowed | Protected | My books |
| GET | /api/timetable | Protected | Weekly timetable |
| GET | /api/timetable/today | Protected | Today's schedule |

## Connect Frontend to Backend

In `app.js`, update:
```js
const API_BASE = 'http://localhost:5000/api';
```
This is already set. The frontend will automatically use the API once the backend is running.
