# 🚀 Metro Nexus Festival OS
### AI-Powered Event Scheduling & Conflict Resolution Platform

Metro Nexus Festival OS is a full-stack MERN web application designed to simplify the management of large-scale festivals and events. It provides intelligent event scheduling, automated conflict detection, participant registration, and role-based event management through dedicated Admin and Student portals.

The platform aims to reduce manual scheduling efforts, prevent resource conflicts, and provide a seamless event management experience.

---

## 🌟 Key Features

### 🔐 1. Authentication & Role-Based Access
- Secure user registration and login.
- Role-based access for Admin and Students.
- Protected routes and authorization middleware.
- Password management and account security.
- Secure initial Admin setup.

### 🎪 2. Event Management
- Create, update, publish, and manage events.
- Configure event date, time, venue, capacity, and resources.
- Manage event information through the Admin Dashboard.
- Track scheduled and completed events.

### 🤖 3. AI-Powered Scheduling
- Generate ranked schedule proposals.
- Analyze event scheduling requirements.
- Recommend feasible scheduling arrangements.
- Help administrators optimize event planning.
- Review proposals before applying them.

### ⚠️ 4. Intelligent Conflict Detection & Resolution
Detect scheduling conflicts involving:
- Venue availability
- Staff availability
- Resource allocation
- Event timing overlaps
- Venue capacity
- Buffer-time constraints

Identify conflicts and help administrators review and resolve scheduling issues.

### 📝 5. Student Event Registration
- Browse available events.
- Register for events.
- View registered events.
- Track registration and event status.

### ✅ 6. Attendance Management
- Admin/Organizer can mark participants as Present or Absent.
- Attendance is stored against the respective event registration.
- Students can view their attendance status.
- Display event completion and attendance status in the Student Portal.

### 🔔 7. Notification System
- Event-related notifications.
- Registration updates.
- User-specific notification management.

### 📊 8. Role-Based Dashboards

**Admin Dashboard**
- Event management
- Scheduling proposals
- Conflict monitoring
- Registration management
- Attendance management
- Event statistics

**Student Dashboard**
- Browse events
- My Registrations
- Event status
- Attendance status
- Notifications

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| AI Integration | OpenAI API |
| Authentication | JWT, Password Hashing |
| API Communication | REST APIs |
| Development Tools | Git, GitHub, VS Code, Postman |

---

## 🏗️ Project Architecture

```text
Metro-Nexus-Festival-OS/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── utils/
│   ├── package.json
│   └── ...
│
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/nidhikumari23/Ai-based-event-scheduling-conflict-resolution.git

cd Ai-based-event-scheduling-conflict-resolution
```

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Configure Backend Environment

Create a `.env` file inside the `server` directory.

Add the required configuration:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=your_openai_api_key
```

Add other environment variables required by your existing project, including email configuration if password reset is enabled.

**Important:** Never commit `.env` files, passwords, API keys, or other sensitive credentials to GitHub.

### 4. Start Backend Server

```bash
npm run dev
```

Backend runs at:

```text
http://localhost:5000
```

### 5. Install Frontend Dependencies

Open a new terminal:

```bash
cd client
npm install
```

### 6. Start Frontend Server

```bash
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

---

## 🔄 Application Workflow

```text
Admin Login
    |
    v
Create & Manage Events
    |
    v
Configure Venues, Staff & Resources
    |
    v
Generate AI Scheduling Proposal
    |
    v
Detect Scheduling Conflicts
    |
    v
Review & Apply Schedule
    |
    v
Students Browse & Register
    |
    v
Event Takes Place
    |
    v
Admin Marks Attendance
    |
    v
Students View Attendance Status
```

---

## 🔒 Security & Reliability

The application includes security and validation mechanisms such as:

- JWT-based authentication.
- Role-based authorization.
- Password hashing and password reset workflows.
- Account status validation.
- Notification ownership checks.
- Protected Admin operations.
- Backend-side event and registration validation.
- Secure API response handling.

---

## 🎯 Project Objectives

- Automate complex event scheduling workflows.
- Reduce venue, staff, and resource conflicts.
- Improve festival planning efficiency.
- Provide transparent event registration and attendance tracking.
- Simplify event administration through AI-assisted scheduling.

---

## 🚀 Future Enhancements

- Advanced scheduling optimization algorithms.
- More comprehensive automated testing.
- Improved scheduling analytics.
- Enhanced real-time notification workflows.
- Performance and scalability improvements.

---

## 👩‍💻 Developed By

**Nidhi Kumari**

B.Tech – Computer Science & Engineering

GitHub: [nidhikumari23](https://github.com/nidhikumari23)

---

## ⭐ Support

If you find this project interesting, consider giving the repository a star on GitHub!

**Metro Nexus Festival OS – Smarter Scheduling. Seamless Events.**