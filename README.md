# Metro Nexus Festival OS

**AI-Based Dynamic Event Scheduling and Conflict Resolution System for Large-Scale Festivals**

A full-stack MERN web application for managing large-scale festivals. It provides separate **Admin** and **User (Participant)** portals, AI-powered schedule optimization via OpenAI, real-time conflict detection, registration workflows, notifications, analytics, and reporting.

---

## Table of Contents

- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [How to Run the Project](#how-to-run-the-project)
- [Default Credentials](#default-credentials)
- [Environment Variables](#environment-variables)
- [Seed Data](#seed-data)
- [Admin Panel Modules](#admin-panel-modules)
- [User Panel Modules](#user-panel-modules)
- [OpenAI Integration](#openai-integration)
- [API Overview](#api-overview)
- [Available Scripts](#available-scripts)

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI library for building interactive interfaces |
| **Vite 5** | Fast development server and production build tool |
| **React Router 6** | Client-side routing (public, admin, user routes) |
| **Tailwind CSS 3** | Utility-first styling for professional UI |
| **Axios** | HTTP client for REST API communication |
| **PostCSS / Autoprefixer** | CSS processing |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime |
| **Express 4** | REST API framework |
| **MongoDB** | NoSQL database |
| **Mongoose 8** | ODM for MongoDB schemas and queries |
| **JWT (jsonwebtoken)** | Authentication tokens |
| **bcryptjs** | Password hashing |
| **Multer** | File uploads (event posters, brand logos) |
| **OpenAI SDK** | AI schedule generation and recommendations |
| **xlsx** | Excel report export |
| **dotenv** | Environment variable management |
| **CORS** | Cross-origin resource sharing |

### Architecture
- **MERN Stack**: MongoDB + Express + React + Node.js
- **Monorepo layout**: Root orchestrates `client/` and `server/`
- **Role-based access**: Admin vs User JWT authentication
- **RESTful API**: `/api/*` endpoints with protected routes

---

## Key Features

- Professional **landing page** with featured events and AI highlights
- **Admin console** with grouped sidebar and full CRUD across all modules
- **Participant portal** with sidebar, personal schedule, and AI recommendations
- **AI scheduling** using OpenAI (with rule-based fallback when no API key)
- **Conflict detection** for timing, venue, resource, staff, and capacity
- **Event registration** workflow with admin approval
- **Personal schedule planner** for users (add/remove events, overlap warnings)
- **Notifications** (broadcast and targeted)
- **Feedback & ratings** with admin replies
- **Reports & analytics** with Excel export
- **Seed script** with 8 sample records per major entity

---

## Project Structure

```
festival-scheduler-mern/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── api/               # Axios API services
│   │   ├── components/        # Shared UI (admin, user, layout)
│   │   ├── context/           # AuthContext (JWT, user state)
│   │   └── pages/             # Landing, auth, admin, user pages
│   ├── index.html
│   └── vite.config.js
├── server/                    # Express backend
│   ├── src/
│   │   ├── config/            # Database connection
│   │   ├── controllers/       # Business logic
│   │   ├── middleware/        # Auth, file upload
│   │   ├── models/            # Mongoose schemas
│   │   ├── routes/            # API route definitions
│   │   ├── seeds/             # Database seed script
│   │   └── utils/             # AI service, conflict detector
│   ├── uploads/               # Uploaded images
│   └── .env                   # Environment config (create from .env.example)
├── package.json               # Root scripts (dev, seed, build)
└── README.md
```

---

## Prerequisites

Before running the project, ensure you have:

1. **Node.js 18+** — [https://nodejs.org](https://nodejs.org)
2. **MongoDB** — Running locally or a MongoDB Atlas connection string
   - Local default: `mongodb://127.0.0.1:27017/festival_scheduler`
3. **npm** (comes with Node.js)
4. **OpenAI API Key** (optional) — For full AI features; app works without it using fallbacks

---

## Installation & Setup

### Step 1: Clone or open the project

```bash
cd "AI-Based Dynamic Event Scheduling and Conflict Resolution System for Large-Scale Festivals"
```

### Step 2: Install dependencies

```bash
npm install
npm run install:all
```

This installs root, server, and client dependencies.

### Step 3: Configure environment

Copy the example environment file:

**Windows (PowerShell / CMD):**
```bash
copy server\.env.example server\.env
```

**macOS / Linux:**
```bash
cp server/.env.example server/.env
```

Edit `server/.env` and set at minimum:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/festival_scheduler
JWT_SECRET=your_super_secret_jwt_key_change_in_production
CLIENT_URL=http://localhost:5173
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
```

### Step 4: Start MongoDB

Make sure MongoDB is running on your machine before seeding or starting the server.

### Step 5: Seed the database

```bash
npm run seed
```

This clears existing data and inserts demo admin, users, categories, venues, events, and more.

---

## How to Run the Project

### Development (recommended)

Run **both** API and frontend together:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| **Frontend (React)** | http://localhost:5173 |
| **Backend API** | http://localhost:5000 |
| **Health Check** | http://localhost:5000/api/health |

### Run separately

```bash
# Terminal 1 — Backend only
npm run dev:server

# Terminal 2 — Frontend only
npm run dev:client
```

### Production build (frontend)

```bash
npm run build
npm run preview --prefix client
```

### Production start (backend)

```bash
npm run start --prefix server
```

---

## Default Credentials

After running `npm run seed`, use these accounts:

### Admin Account

| Field | Value |
|-------|-------|
| **Email** | `admin@metronexus.com` |
| **Password** | `admin123` |
| **Portal** | Admin Console → http://localhost:5173/login |

### Participant (User) Accounts

All demo users share the password **`user123`**.

| Name | Email | Interests |
|------|-------|-----------|
| Sarah Chen | sarah@example.com | Music, Cultural |
| James Wilson | james@example.com | Technical, Sports |
| Priya Sharma | priya@example.com | Dance, Food |
| Marcus Lee | marcus@example.com | Music, Drama |
| Emma Davis | emma@example.com | Cultural, Food |
| Alex Rivera | alex@example.com | Sports, Technical |
| Nina Patel | nina@example.com | Dance, Music |

**Suggested demo user:** `sarah@example.com` / `user123`

### Auth Pages

| Page | URL |
|------|-----|
| Login | http://localhost:5173/login |
| Register | http://localhost:5173/register |
| Forgot Password | http://localhost:5173/forgot-password |
| Landing Page | http://localhost:5173 |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/festival_scheduler` |
| `JWT_SECRET` | Secret key for JWT tokens | Required |
| `CLIENT_URL` | Frontend URL for CORS | `http://localhost:5173` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Optional |
| `NODE_ENV` | Environment mode | `development` |

---

## Seed Data

The seed script (`npm run seed`) creates:

| Entity | Count | Examples |
|--------|-------|----------|
| Admin users | 1 | Festival Admin |
| Participant users | 7 | Sarah, James, Priya, etc. |
| Event categories | 8 | Music, Dance, Drama, Technical, Sports, Food, Cultural, Art |
| Brands / sponsors | 8 | SoundWave Audio, LumiTech, FreshBite, etc. |
| Venues | 8 | Grand Main Stage, Harmony Hall, Innovation Arena, etc. |
| Resources | 8 | Sound system, LED lighting, chairs, security staff, etc. |
| Staff members | 8 | Managers, technicians, volunteers, security |
| Festival events | 8 | Opening Night Concert, Tech Summit, Food Festival, etc. |
| Registrations | 8 | Mixed pending/approved statuses |
| Conflicts | Auto-detected | Timing, venue, resource clashes |
| Notifications | 3 | Sample alerts for users |
| Feedback | 4 | Event ratings and comments |
| Schedule | 1 | Published AI-generated festival schedule |
| Settings | 1 | Festival name, dates, scheduling rules |

---

## Admin Panel Modules

Access: Login as **admin@metronexus.com** → Admin Console

### 1. Dashboard (`/admin`)
- View total events, venues, participants, resources, registrations
- See open conflict count and upcoming events
- Resource utilization overview with progress bars
- AI schedule summary and quick action links
- Live conflict alerts

### 2. Event Categories (`/admin/categories`)
- **Create** new categories (name, description, color)
- **View** all categories with search and sort
- **Update** category details
- **Delete** categories
- **Activate / deactivate** categories (toggle status)

### 3. Brands & Sponsors (`/admin/brands`)
- **Add** brand/sponsor with tier (Platinum, Gold, Silver, Bronze, Partner)
- **View** brand list with contact and website
- **Update** brand details and logo URL
- **Delete** brands
- **Activate / deactivate** brands

### 4. Venue Management (`/admin/venues`)
- **Add** venues with location, capacity, facilities
- **View** venue list with utilization stats
- **Update** venue details
- **Delete** venues
- **Block / unblock** venues for maintenance
- **View booking status** — events scheduled per venue

### 5. Resource Management (`/admin/resources`)
- **Add** resources (sound, lighting, stage, chairs, staff, etc.)
- **View** resources with utilization bars
- **Update** quantity, availability, cost
- **Delete** resources
- **Toggle** availability
- **Detect overbooking** alerts

### 6. Staff Management (`/admin/staff`)
- **Add** staff members (manager, coordinator, technician, security, volunteer, host)
- **View** staff list with assigned events
- **Update** staff details and availability notes
- **Delete** staff
- **Assign** staff to events
- **Toggle** availability

### 7. Event Management (`/admin/events`)
- **Create** events with category, venue, organizer, date/time, priority, status
- **View** all events with filters (draft, scheduled, published, cancelled)
- **Update** event details, rules, expected audience
- **Delete** events
- **Cancel** events
- **Reschedule** events (date, time, venue)
- **Mark as featured**
- **View** event detail modal (registrations, venue, organizer)

### 8. Participant Management (`/admin/participants`)
- **View** all registered users and registrations
- **Approve / reject** pending registrations
- **Remove** participants from events
- **Filter** by status and event
- **Export** participant list (JSON)
- **Send** broadcast notifications to all users

### 9. AI Scheduling (`/admin/ai-scheduling`)
- **Generate** optimized schedule using OpenAI
- **Detect** conflicts across events, venues, resources, staff
- **Regenerate** schedule after admin changes
- **Save** AI output to festival schedule
- View AI suggestions and conflict counts

### 10. Conflict Resolution (`/admin/conflicts`)
- **View** all schedule conflicts by type and severity
- **Detect** new conflicts automatically
- **Get AI-suggested** resolutions
- **Accept** AI fix, **manually resolve**, or **ignore** conflicts
- Filter by status: open, resolved, ignored, accepted
- Summary by type: timing, venue, resource, staff, capacity

### 11. Schedule Management (`/admin/schedule`)
- **View** complete festival schedule (day / venue / category views)
- **Sync** schedule from published events
- **Edit** schedule entries (via API)
- **Lock** final schedule
- **Publish / unpublish** schedule to users
- View AI summary and lock/publish status

### 12. Notifications (`/admin/notifications`)
- **Send** event update, schedule change, cancellation, reminder notifications
- **Broadcast** to all users or target specific user IDs
- **Quick templates** for common notification types
- **View** recent notification history
- **Delete** notifications

### 13. Reports & Analytics (`/admin/reports`)
- **Participation report** — fill rates per event
- **Venue utilization** — bookings per venue
- **Resource utilization** — equipment usage
- **Conflict report** — all conflicts log
- **Registration report** — status breakdown
- **Cancelled events** report
- **AI schedule performance** report
- **Export** reports to Excel (.xlsx)

### 14. Feedback Management (`/admin/feedback`)
- **View** all user feedback and ratings
- **Reply** to feedback (admin response)
- **Delete** inappropriate feedback
- **View** top-rated / popular events
- Filter unreplied vs replied feedback

### 15. System Settings (`/admin/settings`)
- **Festival settings** — name, dates, contact email/phone
- **Scheduling rules** — min gap, max events per venue, priority weights
- **OpenAI API key** configuration
- **Notification preferences** — email/push toggles
- **Admin profile** — update name, phone
- **Change password**

---

## User Panel Modules

Access: Login as any participant user → Participant Portal

### 1. Dashboard (`/user`)
- Personal stats: registrations, pending approvals, personal plan, notifications
- Festival dates and user interests
- Live events happening now
- Upcoming registered events
- Recent notifications and AI-recommended events

### 2. Browse Events (`/user/events`)
- **View** all published upcoming events
- **Search** by title
- **Filter** by category, venue, date, featured
- **Sort** by date, priority, audience size
- **Register** for events directly from list
- **Add** events to personal schedule plan
- Grid and list view modes

### 3. Event Details (`/user/events/:id`)
- Full event info: description, date, time, venue, capacity, organizer
- Seat availability bar
- Sponsor/brand details
- Event rules and ratings
- **Register / cancel** registration
- **Add / remove** from personal plan
- **Submit, edit, delete** event feedback and ratings

### 4. My Registrations (`/user/registrations`)
- **View** all registrations with status (pending, approved, rejected, cancelled)
- **Filter** by registration status
- **Cancel** registration with confirmation
- Stats cards for each status type

### 5. Personal Schedule (`/user/personal-schedule`)
- **Build** custom festival plan (add events from browse/detail pages)
- **View** timeline and card layouts
- **Remove** events from personal plan
- **Check conflicts** — detect overlapping events in your plan
- AI overlap warnings

### 6. Festival Schedule (`/user/schedule`)
- **View** complete published festival schedule
- **Day-wise, venue-wise, category-wise** views
- **Today's and tomorrow's** events
- **Live / currently running** events
- Tab for **my registered** approved events

### 7. AI Recommendations (`/user/recommendations`)
- **Personalized event recommendations** based on interests (OpenAI or rule-based)
- **Match scores** and recommendation reasons
- **Add recommended events** to personal plan
- **Personal festival plan** table with overlap warnings

### 8. My Feedback (`/user/feedback`)
- **View** all submitted reviews
- **Edit** rating and comment
- **Delete** feedback
- View admin replies
- Stats: total reviews, average rating given

### 9. Notifications (`/user/notifications`)
- **View** all notifications (registration, reminders, schedule updates, AI picks)
- **Filter** all / unread / read
- **Mark** individual or all as read
- **Delete** notifications

### 10. Profile & Settings (`/user/profile`)
- **Update** name, phone, interests (tag picker)
- **Change password**
- View registration activity and festival info
- Account stats: registrations, plan items, reviews

---

## User Authentication (Both Portals)

| Feature | Description |
|---------|-------------|
| **Register** | Create participant account with interests |
| **Login** | JWT-based authentication |
| **Forgot password** | Reset token generation and password reset |
| **Change password** | Update password from profile/settings |
| **Logout** | Clear session and redirect |
| **Role-based routing** | Admin → `/admin`, User → `/user` |

---

## OpenAI Integration

### Admin Side
- AI schedule generation
- Conflict detection assistance
- Venue and resource optimization suggestions
- Event priority ordering
- Alternative time slot suggestions
- Conflict resolution recommendations
- Regenerate schedule after changes

### User Side
- Personalized event recommendations
- Personal festival plan generation
- Overlap warnings for selected events
- Alternative event suggestions
- Smart notification content (via templates)

### Configuration
1. Add `OPENAI_API_KEY` in `server/.env`, **or**
2. Set key in **Admin → Settings → OpenAI** tab

**Without an API key:** The system uses intelligent **rule-based fallbacks** (priority sorting, interest matching, conflict detection algorithms).

---

## API Overview

| Prefix | Module |
|--------|--------|
| `/api/auth` | Login, register, profile, password |
| `/api/users` | Admin user management |
| `/api/categories` | Event categories CRUD |
| `/api/brands` | Brand/sponsor CRUD |
| `/api/venues` | Venue CRUD, block, bookings |
| `/api/resources` | Resource CRUD, overbooking check |
| `/api/events` | Event CRUD, cancel, reschedule, featured |
| `/api/registrations` | Register, approve, export |
| `/api/staff` | Staff CRUD, assign to events |
| `/api/schedules` | Schedule view, lock, publish |
| `/api/conflicts` | Detect, resolve conflicts |
| `/api/ai` | AI schedule, recommendations, personal plan |
| `/api/notifications` | Send, read, delete notifications |
| `/api/dashboard` | Admin and user dashboard stats |
| `/api/feedback` | Ratings and feedback CRUD |
| `/api/settings` | Festival and system settings |
| `/api/reports` | Analytics and Excel export |
| `/api/user-portal` | Personal schedule (add/remove) |
| `/api/health` | Server health check |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install root dependencies |
| `npm run install:all` | Install server + client dependencies |
| `npm run dev` | Start API (port 5000) + React (port 5173) concurrently |
| `npm run dev:server` | Start backend only |
| `npm run dev:client` | Start frontend only |
| `npm run seed` | Reset and populate MongoDB with demo data |
| `npm run build` | Build React app for production |
| `npm run start --prefix server` | Run production backend |
| `npm run preview --prefix client` | Preview production frontend build |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED 127.0.0.1:27017` | Start MongoDB service before running seed or dev |
| Login fails after seed | Run `npm run seed` again and use credentials above |
| AI features not working | Add valid `OPENAI_API_KEY` or use rule-based fallback |
| CORS errors | Ensure `CLIENT_URL` in `.env` matches frontend URL |
| Port already in use | Change `PORT` in `.env` or stop conflicting process |

---

## License

This project is built for educational and demonstration purposes as part of a MERN stack festival management system.

---

**Metro Nexus Festival OS** — Intelligent scheduling & conflict orchestration for large-scale festivals.
