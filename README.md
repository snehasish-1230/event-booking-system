<div align="center">
  <p>
    <strong>🎫 Event Booking System</strong>
  </p>

  <h1>Event Booking System</h1>

  <p><em>A full-stack event booking platform with role-based access control, atomic capacity management, QR code tickets, and a security-hardened REST API — built on the MERN stack.</em></p>

  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square" alt="Node.js version" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white" alt="Express 5" />
    <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB Atlas" />
    <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
    <img src="https://img.shields.io/badge/API-Render-46E3B7?style=flat-square&logo=render&logoColor=white" alt="API on Render" />
    <img src="https://img.shields.io/badge/Web-Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Web on Vercel" />
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs welcome" />
  </p>

  <p>
    <a href="https://event-booking-system-xi-two.vercel.app/">Live Demo</a> •
    <a href="#features">Features</a> •
    <a href="#installation">Quick Start</a> •
    <a href="#api-endpoints">API Docs</a> •
    <a href="#screenshots">Screenshots</a>
  </p>

  <a href="https://event-booking-system-xi-two.vercel.app/">
    <img src="./assets/screenshots/landing.png" alt="Event Booking System landing page" />
  </a>
</div>

---

## Features

- **Role-Based Access Control** — Three distinct roles (Attendee, Organizer, Admin) with granular permissions and route guards
- **JWT Authentication** — Secure token-based auth with bcrypt hashing, login attempt limiting, and account locking
- **Full Event Lifecycle** — Draft → Published → Cancelled/Completed status workflow with slug-based SEO-friendly URLs
- **Atomic Capacity Management** — Race-condition-safe registration using MongoDB `findOneAndUpdate` + `$expr` to prevent overbooking
- **Email Notifications** — Automated confirmation and cancellation emails via Gmail SMTP with HTML templates
- **QR Code Tickets** — Unique UUID-based confirmation codes with printable ticket view and QR code generation
- **Organizer Dashboard** — Event statistics, attendee management, check-in system, revenue tracking, and upcoming events overview
- **Admin Panel** — System-wide dashboard with user management, event moderation, and registration oversight
- **Image Upload** — Multer-based file upload with MIME type validation, size limits, and server-generated filenames
- **Dark Mode** — System/light/dark theme support with persistent preference storage
- **Responsive Design** — Mobile-first layout with Tailwind CSS utility classes across all pages
- **Security Hardened** — Helmet, CORS, multi-tier rate limiting, MongoDB sanitization, input validation, XSS prevention

---

## Live Demo

[🚀 View Live Demo](https://event-booking-system-xi-two.vercel.app/)

---

## Screenshots

All screenshots are captured from the [live deployment](https://event-booking-system-xi-two.vercel.app/) running against the seeded demo dataset.

<table>
  <tr>
    <td align="center" width="33%">
      <a href="./assets/screenshots/landing.png"><img src="./assets/screenshots/landing.png" alt="Landing" /></a>
      <sub><b>Landing</b><br/>Hero & featured events</sub>
    </td>
    <td align="center" width="33%">
      <a href="./assets/screenshots/events.png"><img src="./assets/screenshots/events.png" alt="Events" /></a>
      <sub><b>Events</b><br/>Search, filter & paginate</sub>
    </td>
    <td align="center" width="33%">
      <a href="./assets/screenshots/event-detail.png"><img src="./assets/screenshots/event-detail.png" alt="Event detail" /></a>
      <sub><b>Event detail</b><br/>Details & registration CTA</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <a href="./assets/screenshots/ticket.png"><img src="./assets/screenshots/ticket.png" alt="Ticket" /></a>
      <sub><b>Ticket</b><br/>QR code & printable view</sub>
    </td>
    <td align="center" width="33%">
      <a href="./assets/screenshots/my-tickets.png"><img src="./assets/screenshots/my-tickets.png" alt="My tickets" /></a>
      <sub><b>My tickets</b><br/>Personal registrations list</sub>
    </td>
    <td align="center" width="33%">
      <a href="./assets/screenshots/register.png"><img src="./assets/screenshots/register.png" alt="Register" /></a>
      <sub><b>Register</b><br/>JWT-based sign up & login</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <a href="./assets/screenshots/organizer-dashboard.png"><img src="./assets/screenshots/organizer-dashboard.png" alt="Organizer dashboard" /></a>
      <sub><b>Organizer dashboard</b><br/>Stats, revenue & upcoming</sub>
    </td>
    <td align="center" width="33%">
      <a href="./assets/screenshots/attendees.png"><img src="./assets/screenshots/attendees.png" alt="Attendees" /></a>
      <sub><b>Attendees</b><br/>Check-in & attendee management</sub>
    </td>
    <td align="center" width="33%">
      <a href="./assets/screenshots/admin-dashboard.png"><img src="./assets/screenshots/admin-dashboard.png" alt="Admin console" /></a>
      <sub><b>Admin console</b><br/>Users, events & registrations</sub>
    </td>
  </tr>
</table>

> Drop the captured images into `assets/screenshots/` using the file names above to populate this grid.

---

## Architecture

A high-level visual map of the system. Both diagrams render natively on GitHub thanks to Mermaid support.

### Domain Model

How the core collections relate to each other and how confirmations fan out to users.

```mermaid
graph LR
  User(("User"))
  Event(["Event"])
  Registration(["Registration"])

  User -- "organizes" --> Event
  User -- "books" --> Registration
  Event -- "has many" --> Registration
  Registration -. "triggers email to" .-> User
```

### Request Lifecycle

How a single registration request travels through the stack.

```mermaid
flowchart LR
  Browser["React 19 SPA<br/>(Vite + Tailwind 4)"]
  API["Express 5 API<br/>(REST + JWT)"]
  DB[("MongoDB Atlas<br/>Mongoose 9")]
  SMTP[("Gmail SMTP<br/>Nodemailer")]

  Browser -- "Axios + JWT (Bearer)" --> API
  API -- "atomic findOneAndUpdate + $expr" --> DB
  API -. "confirmation email" .-> SMTP
  SMTP -. "ticket + QR code" .-> Browser
```

---

## Technologies

### Frontend

- **React 19**: Modern UI library with hooks and context for state management
- **React Router DOM**: Client-side routing with nested layouts and route guards
- **Tailwind CSS 4**: Utility-first CSS framework with dark mode support
- **Vite**: Lightning-fast build tool and dev server with HMR
- **Axios**: Promise-based HTTP client with request/response interceptors
- **qrcode.react**: QR code generation for printable tickets
- **React Hot Toast**: Elegant toast notifications
- **date-fns**: Lightweight date utility library

### Backend

- **Node.js**: Server-side JavaScript runtime
- **Express 5**: Minimal and flexible web application framework
- **MongoDB (Mongoose 9)**: NoSQL database with elegant object modeling and compound indexes
- **JWT (jsonwebtoken + bcryptjs)**: Stateless authentication with secure password hashing
- **Nodemailer**: Email sending via Gmail SMTP with HTML templates
- **Multer**: Multipart form data handling for file uploads
- **Helmet**: Secure HTTP response headers with CSP
- **express-rate-limit**: Multi-tier request rate limiting
- **express-validator**: Declarative input validation and sanitization
- **express-mongo-sanitize**: NoSQL injection prevention
- **Morgan**: HTTP request logging
- **swagger-jsdoc + swagger-ui-express**: Interactive API documentation with Swagger/OpenAPI 3.0

---

## Installation

### Prerequisites

- **Node.js** v18+ and **npm**
- **MongoDB** — [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier) or local instance

### Local Development

**1. Clone the repository:**

```bash
git clone https://github.com/Serkanbyx/event-booking-system.git
cd event-booking-system
```

**2. Set up environment variables:**

```bash
cp server/.env.example server/.env
```

**server/.env**

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5175,http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-generated-app-password
SMTP_FROM_NAME=EventBooking
EMAIL_OTP_SECRET=optional_dedicated_secret_defaults_to_JWT_SECRET
UPLOAD_MAX_SIZE=5242880
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=your_admin_password
ADMIN_SEED_NAME=Admin
```

> Email verification and password reset require `SMTP_USER` and `SMTP_PASS` in every environment. For Gmail, use a Google App Password. Set `EMAIL_OTP_SECRET` to a long random secret if you want a dedicated HMAC key for OTP and reset-token hashes; otherwise the backend uses `JWT_SECRET`. Codes and reset credentials are never included in email-delivery logs or ordinary API responses.

**client/.env** (optional — local development and production API URLs are configured separately)

```env
VITE_API_URL_LOCAL=http://localhost:5002/api
VITE_API_URL=https://event-booking-system-yn5h.onrender.com/api
```

Vite development uses `VITE_API_URL_LOCAL`; production builds use `VITE_API_URL`. Configure `VITE_API_URL` in the frontend host with the backend URL ending in `/api`.

**3. Install dependencies:**

```bash
cd server && npm install
cd ../client && npm install
```

**4. Seed admin user:**

```bash
cd server
npm run seed
```

**5. Run the application:**

```bash
# Terminal 1 — Backend (http://localhost:5002)
cd server && npm run dev

# Terminal 2 — Frontend (http://localhost:5175)
cd client && npm run dev
```

---

## Usage

1. **Register** an account at `/auth/register` as an Attendee
2. **Browse events** on the homepage or `/events` with search, filter, and pagination
3. **View event details** by clicking on any event card
4. **Register for an event** — receive a confirmation email with a unique code
5. **View your tickets** at `/tickets` with QR codes and printable ticket view
6. **Organizers** can create, edit, publish, and cancel events from the Organizer Dashboard
7. **Admins** can manage users, moderate events, and oversee registrations from the Admin Panel

### Roles & Permissions

| Feature | Attendee | Organizer | Admin |
| --- | --- | --- | --- |
| Browse events | ✅ | ✅ | ✅ |
| Register for events | ✅ | ✅ | ✅ |
| View tickets | ✅ | ✅ | ✅ |
| Create events | ❌ | ✅ | ✅ |
| Manage events | ❌ | Own only | All |
| View attendees | ❌ | Own events | All |
| Check-in attendees | ❌ | Own events | All |
| Manage users | ❌ | ❌ | ✅ |
| System dashboard | ❌ | ❌ | ✅ |

---

## How It Works?

### Authentication Flow

1. New users register, verify their email using a six-digit code that expires after five minutes, and then log in to receive a JWT token. Unverified users cannot log in.
2. Token is stored in `localStorage` and sent via the `Authorization: Bearer <token>` header
3. `AuthContext` calls `/api/auth/me` on mount to restore the session
4. Protected routes check authentication and role via route guard components (`ProtectedRoute`, `OrganizerRoute`, `AdminRoute`)
5. Failed login attempts are tracked; the account locks for 15 minutes after 5 consecutive failures

### Registration Flow

1. User clicks "Register" on an event detail page
2. The server performs an atomic `findOneAndUpdate` with `$expr` to check capacity and increment `registeredCount` in a single operation — preventing race conditions
3. A `Registration` document is created with a unique UUID-based confirmation code
4. A confirmation email is sent via Gmail SMTP with an HTML template
5. The user can view their ticket with a QR code at `/tickets/:id`

---

## API Endpoints

### Health Check

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Server health check |

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Create a pending account and send an email verification code |
| POST | `/api/auth/verify-email` | No | Verify an email code and activate the account |
| POST | `/api/auth/resend-email-otp` | No | Request a replacement verification code |
| POST | `/api/auth/forgot-password` | No | Request a password-reset OTP (generic response) |
| POST | `/api/auth/verify-password-reset-otp` | No | Verify a password-reset OTP and receive short-lived reset authorization |
| POST | `/api/auth/resend-password-reset-otp` | No | Request a replacement password-reset OTP |
| POST | `/api/auth/reset-password` | No | Set a new password using single-use reset authorization |
| POST | `/api/auth/login` | No | Login and receive JWT |
| GET | `/api/auth/me` | Yes | Get current user profile |
| PUT | `/api/auth/profile` | Yes | Update user profile |
| PUT | `/api/auth/change-password` | Yes | Change password |
| DELETE | `/api/auth/delete-account` | Yes | Delete own account |

### Events (`/api/events`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/events` | No | List events (search, filter, paginate) |
| GET | `/api/events/featured` | No | Get featured events |
| GET | `/api/events/categories` | No | Get event categories |
| GET | `/api/events/id/:id` | No | Get event by ID |
| GET | `/api/events/:slug` | No | Get event by slug |
| POST | `/api/events` | Organizer | Create a new event |
| PUT | `/api/events/:id` | Organizer | Update own event |
| DELETE | `/api/events/:id` | Organizer | Delete own event |
| PUT | `/api/events/:id/publish` | Organizer | Publish a draft event |
| PUT | `/api/events/:id/cancel` | Organizer | Cancel an event |
| GET | `/api/events/:id/registrations` | Organizer | Get event registrations |
| GET | `/api/events/:id/stats` | Organizer | Get event statistics |
| POST | `/api/events/:id/register` | Yes | Register for an event |
| GET | `/api/events/my/organized` | Organizer | Get own organized events |

### Registrations (`/api/registrations`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/registrations/my` | Yes | Get own registrations |
| GET | `/api/registrations/code/:code` | Yes | Find by confirmation code |
| GET | `/api/registrations/:id` | Yes | Get registration details |
| PUT | `/api/registrations/:id/check-in` | Organizer | Check-in an attendee |
| DELETE | `/api/registrations/:id` | Yes | Cancel a registration |

### Payments (`/api/payments`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/payments/config` | Yes | Get UPI payment configuration and upload limits |
| POST | `/api/payments` | Yes | Submit genuine payment details and screenshot as multipart form data |
| GET | `/api/payments/my` | Yes | Get own payment submissions |
| GET | `/api/payments/:id` | Yes | Get own payment or booking details |
| GET | `/api/payments/admin/all` | Admin | List genuine payment submissions and status totals |
| PATCH | `/api/payments/admin/:id/review` | Admin | Approve or reject a genuine payment |
| POST | `/api/payments/test` | Yes, non-production only | Create a separate `TEST_ONLY` payment record without changing ticket status |
| GET | `/api/payments/admin/test/all` | Admin, non-production only | List development test payments |
| PATCH | `/api/payments/admin/test/:id/review` | Admin, non-production only | Review a test payment without changing a real registration |

### Users (`/api/users`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/users/me/stats` | Yes | Get own statistics |
| GET | `/api/users/:id/profile` | No | Get public user profile |
| GET | `/api/users/:id/organizer` | No | Get organizer profile |

### Organizer (`/api/organizer`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/organizer/dashboard` | Organizer | Dashboard statistics |
| GET | `/api/organizer/revenue` | Organizer | Revenue breakdown |
| GET | `/api/organizer/recent-registrations` | Organizer | Recent registrations |
| GET | `/api/organizer/upcoming-events` | Organizer | Upcoming events list |

### Admin (`/api/admin`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/admin/dashboard` | Admin | System-wide dashboard |
| GET | `/api/admin/users` | Admin | List all users |
| PUT | `/api/admin/users/:id/role` | Admin | Update user role |
| PUT | `/api/admin/users/:id/toggle-active` | Admin | Toggle user active status |
| DELETE | `/api/admin/users/:id` | Admin | Delete a user |
| GET | `/api/admin/events` | Admin | List all events |
| PUT | `/api/admin/events/:id/status` | Admin | Update event status |
| DELETE | `/api/admin/events/:id` | Admin | Delete an event |
| GET | `/api/admin/registrations` | Admin | List all registrations |

### Upload (`/api/upload`)

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/upload/image` | Organizer | Upload an event image |
| DELETE | `/api/upload/:filename` | Organizer | Delete an uploaded image |

> Auth endpoints require the `Authorization: Bearer <token>` header. Rate limits apply per tier: global (100/15min), auth (10/15min), registration (20/15min), upload (10/15min).

### API Documentation (Swagger)

Interactive API documentation is available at `/api-docs` when the server is running:

- **Local:** [http://localhost:5002/api-docs](http://localhost:5002/api-docs)
- Provides a complete OpenAPI 3.0 specification with all endpoints, request/response schemas, and authentication details
- Test API endpoints directly from the browser with the built-in "Try it out" feature

---

## Project Structure

A clean monorepo layout with an explicit backend / frontend split. Each panel below is collapsible — expand the one you care about.

<details open>
<summary><b>Server</b> — Express 5 API</summary>

```
server/
├── config/         # env validation, db connection, swagger spec
├── controllers/    # auth, event, registration, user, organizer, admin, upload
├── middlewares/    # auth/rbac, errorHandler, rateLimiter, upload, validate
├── models/         # User, Event, Registration (schemas + indexes)
├── routes/         # one file per resource group (7 routers)
├── templates/      # HTML email templates (confirmation, cancellation, cancelled)
├── utils/          # AppError, emailService, escapeHtml, escapeRegex, token, seed
├── validators/     # express-validator rule sets per resource
├── uploads/        # uploaded images (gitignored, keeps .gitkeep)
├── index.js        # Express app composition + bootstrap
├── .env.example
└── package.json
```

</details>

<details>
<summary><b>Client</b> — React 19 + Vite SPA</summary>

```
client/
├── public/         # _redirects (Netlify SPA fallback)
├── src/
│   ├── components/ # common (route guards), layout, ui, organizer
│   ├── contexts/   # AuthContext, ThemeContext
│   ├── hooks/      # useDebounce, usePagination, useLocalStorage, useDocumentTitle
│   ├── pages/      # public, auth, protected, organizer, admin
│   ├── services/   # Axios instance + endpoint modules
│   ├── utils/      # constants, formatters, helpers
│   ├── App.jsx     # router + layouts + route guards
│   ├── main.jsx    # entry point with providers
│   └── index.css   # Tailwind directives + global styles
├── netlify.toml    # Netlify deployment config
├── vite.config.js  # Vite config with API proxy
└── package.json
```

</details>

<details>
<summary><b>Repository root</b> — governance & shared config</summary>

```
event-booking-system/
├── client/         # → see Client panel above
├── server/         # → see Server panel above
├── docs/           # build-guide.md (original step-by-step build playbook)
├── .github/        # issue templates, PR template, governance docs
│   ├── ISSUE_TEMPLATE/
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── SECURITY.md
├── LICENSE
└── README.md
```

</details>

---

## Security

- **Helmet** — Sets secure HTTP response headers with explicit CSP directives in production
- **CORS** — Restricts cross-origin requests to the allowed frontend URL (never wildcard in production)
- **Rate Limiting** — Multiple tiers: global (100/15min), auth (10/15min), registration (20/15min), upload (10/15min), and confirmation-specific limits, with standardized `RateLimit-*` headers
- **MongoDB Sanitization** — Prevents NoSQL injection via `express-mongo-sanitize` middleware (Express 5 compatible)
- **Input Validation** — All endpoints validated with `express-validator` rules and centralized validation middleware
- **XSS Prevention** — HTML escaping utility for user-generated content in email templates
- **ReDoS Prevention** — Regex special characters escaped in search queries via `escapeRegex()`
- **Password Security** — Bcrypt hashing (salt rounds 12), login attempt tracking, account locking after 5 failed attempts
- **JWT Security** — Token-based auth with configurable expiration, `passwordChangedAt` invalidation, minimum 32-char secret enforced in production
- **Mass Assignment Protection** — Only whitelisted fields destructured in every controller
- **User Enumeration Prevention** — Identical error messages for wrong email and wrong password on login
- **File Upload Security** — MIME type whitelist (JPEG, PNG, GIF, WebP), 5MB size limit, server-generated filenames, path traversal protection
- **Request Size Limiting** — JSON and URL-encoded body size restrictions (10kb)
- **Static File Security** — Directory listing disabled, dotfiles denied
- **Admin Self-Protection** — Cannot delete self, cannot change own role, last admin check enforced
- **Atomic Operations** — Race-condition-safe capacity management with `findOneAndUpdate` + `$expr`
- **Error Handling** — Centralized error handler that hides internal details (stack traces, field names) in production

---

## Deployment

### Backend (Render / Railway)

1. Create a new Web Service on [Render](https://render.com/) or [Railway](https://railway.app/)
2. Set the root directory to `server`
3. Configure:

| Setting | Value |
| --- | --- |
| Build command | `npm install` |
| Start command | `npm start` |

4. Add all environment variables from the table below, including `NODE_ENV=production`
5. Set `CLIENT_URL=https://event-booking-system-xi-two.vercel.app,https://event-booking-system-3jw3p0uq2-ff-team8.vercel.app` (comma-separated origins; do not include paths).
6. Configure `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` (Gmail address), and `SMTP_PASS` (Gmail App Password). Set `NODE_ENV=production`; the server verifies MongoDB and SMTP before accepting traffic.

### Frontend (Vercel or Netlify)

1. Connect your GitHub repository to [Netlify](https://www.netlify.com/)
2. Set build settings:

| Setting | Value |
| --- | --- |
| Base directory | `client` |
| Build command | `npm run build` |
| Publish directory | `client/dist` |

3. Add environment variable:

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://event-booking-system-yn5h.onrender.com/api` |

> The `netlify.toml` and `_redirects` files are already configured for SPA routing.
> Set the same `VITE_API_URL` build variable for Vercel. After changing it, trigger a new frontend deployment.

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | Server port (Render provides this automatically) | `5002` locally |
| `NODE_ENV` | Environment mode; set to `production` on Render | `development` locally |
| `MONGO_URI` | MongoDB connection string | — |
| `JWT_SECRET` | JWT signing secret (min 32 chars in production) | — |
| `JWT_EXPIRE` | JWT token expiration | `7d` |
| `CLIENT_URL` | Comma-separated frontend origins for CORS | Production: both deployed Vercel origins; local: `http://localhost:5175,http://localhost:5173` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `465` (TLS); `587` (STARTTLS) is also supported |
| `SMTP_USER` | SMTP email address | — |
| `SMTP_PASS` | SMTP app password | — |
| `SMTP_FROM_NAME` | Sender display name | `EventBooking` |
| `EMAIL_OTP_SECRET` | HMAC secret for OTP/reset credentials; defaults to `JWT_SECRET` | — |
| `UPLOAD_MAX_SIZE` | Max upload size in bytes | `5242880` (5MB) |
| `UPI_ID` | Merchant UPI address for payment QR generation | `merchant@upi` |
| `PAYMENT_QR_URL` | Optional hosted payment QR image URL | — |
| `MAX_PAYMENT_SCREENSHOT_SIZE_MB` | Maximum payment screenshot size | `5` |
| `ADMIN_SEED_EMAIL` | Admin email for seed script | — |
| `ADMIN_SEED_PASSWORD` | Required only when intentionally running the seed script; do not set a default production password | — |
| `ADMIN_SEED_NAME` | Optional display name for the seed script | — |
| `VITE_API_URL` | Production frontend API base URL (include `/api`) | `https://event-booking-system-yn5h.onrender.com/api` |
| `VITE_API_URL_LOCAL` | Local development backend API base URL (include `/api`) | `http://localhost:5002/api` |

### Development-only admin unlock

The login lockout is per account; the HTTP 429 login limiter is per client IP and is not cleared by changing a user's lock fields. To clear lock state for one active, email-verified admin in a development database, run from `server/`:

```bash
NODE_ENV=development npm run unlock-admin -- admin@example.com
```

The command requires the exact admin email and refuses to run unless `NODE_ENV=development`. It changes only that verified admin's `loginAttempts` and `lockUntil`; it does not change the password or other users. Do not use it as a way to bypass shared-IP HTTP 429 limits.

### Email Setup (Gmail SMTP)

1. Enable **2-Step Verification** on your Google Account at [Google Account Security](https://myaccount.google.com/security)
2. Go to [App passwords](https://myaccount.google.com/apppasswords) and generate a new 16-character app password for "Event Booking System"
3. Configure the SMTP environment variables in `server/.env` (use the app password — **not** your account password — for `SMTP_PASS`)
4. The server verifies the SMTP connection on startup, but this only checks connectivity and authentication; it does not verify delivery to a recipient's Inbox.
5. Registration returns success only after Nodemailer reports that the OTP recipient was accepted by SMTP. Failed or rejected SMTP submissions return an error and safe server diagnostics (masked recipient, message ID when available, response code, and SMTP command).
6. SMTP acceptance means the provider accepted the message for processing, not that Gmail delivered it to Inbox. Check Inbox, Spam, Promotions, and All Mail; review sender reputation, authentication, and Gmail sending limits if delivery varies. Consider a transactional email service for production delivery monitoring.
7. SMTP credentials are required for OTP and password-reset email. Without them, those endpoints fail rather than logging or exposing OTPs.

---

## Features in Detail

**Completed Features:**

- ✅ JWT authentication with role-based access control
- ✅ Full event CRUD with draft/publish/cancel workflow
- ✅ Atomic registration with race-condition prevention
- ✅ Email notifications (confirmation, cancellation, event cancelled)
- ✅ QR code tickets with printable view
- ✅ Organizer dashboard with analytics and check-in
- ✅ Admin panel with user/event/registration management
- ✅ Dark mode with system preference detection
- ✅ Responsive design across all pages
- ✅ Image upload with validation
- ✅ Multi-tier rate limiting and security hardening
- ✅ Login and registration requests are limited to 10 per 15 minutes in production and 50 per 15 minutes in development; the global API limit remains 100 per 15 minutes
- ✅ Search, filter, and pagination with debounced queries
- ✅ SEO-friendly slug-based event URLs

**Future Features:**

- 🔮 [ ] Payment integration (Stripe/PayPal)
- 🔮 [ ] Real-time notifications with WebSocket
- 🔮 [ ] Calendar integration (Google Calendar, iCal)
- 🔮 [ ] Social sharing for events
- 🔮 [ ] Event comments and reviews
- 🔮 [ ] Analytics dashboard with charts

---

## Contributing

1. **Fork** the repository
2. **Create** your feature branch (`git checkout -b feat/amazing-feature`)
3. **Commit** your changes following the convention below
4. **Push** to the branch (`git push origin feat/amazing-feature`)
5. **Open** a Pull Request

| Prefix | Description |
| --- | --- |
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code refactoring |
| `docs:` | Documentation changes |
| `style:` | Formatting, missing semicolons, etc. |
| `chore:` | Maintenance and dependency updates |

> Please read our [Contributing Guide](.github/CONTRIBUTING.md) and [Code of Conduct](.github/CODE_OF_CONDUCT.md) before submitting a pull request. To understand how the project was built end to end, see the [Build Guide](docs/build-guide.md).

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Developer

**Serkanby**

- Website: [serkanbayraktar.com](https://serkanbayraktar.com/)
- GitHub: [@Serkanbyx](https://github.com/Serkanbyx)
- Email: [serkanbyx1@gmail.com](mailto:serkanbyx1@gmail.com)

---

## Contact

- [Open an Issue](https://github.com/Serkanbyx/event-booking-system/issues)
- Email: [serkanbyx1@gmail.com](mailto:serkanbyx1@gmail.com)
- Website: [serkanbayraktar.com](https://serkanbayraktar.com/)

---

⭐ If you like this project, don't forget to give it a star!
