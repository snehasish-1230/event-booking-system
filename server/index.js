const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const env = require("./config/env");
const { version } = require("./package.json");
const connectDB = require("./config/db");
const { globalLimiter } = require("./middlewares/rateLimiter");
const errorHandler = require("./middlewares/errorHandler");
const { verifyConnection } = require("./utils/emailService");

const app = express();

// CORS — supports comma-separated CLIENT_URL for multiple origins
const localDevelopmentOrigins =
  env.NODE_ENV === "development"
    ? ["http://localhost:5175", "http://localhost:5173"]
    : [];
const allowedOrigins = [
  ...new Set([
    ...localDevelopmentOrigins,
    ...env.CLIENT_URL.split(",").map((o) => o.trim()).filter(Boolean),
  ]),
];

app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser tools (Postman, curl) that send no origin
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Retry-After"],
  }),
);

// The deployed API runs behind one platform proxy; local development is direct.
if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Disable x-powered-by header
app.disable("x-powered-by");

// Security headers with CSP
if (env.NODE_ENV === "production") {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
} else {
  app.use(helmet({ contentSecurityPolicy: false }));
}

// Body parsing with size limits
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Mongo sanitize (Express 5 compatible — do NOT use mongoSanitize() directly)
app.use((req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});

// HTTP request logging
if (env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Global rate limiter for all /api routes
app.use("/api", globalLimiter);

// Static files — block directory listing and dotfiles
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads"), {
    dotfiles: "deny",
    index: false,
  }),
);

// Swagger API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Event Booking System — API Docs",
  }),
);

// Root welcome page
app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Booking System API</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      font-family:'Segoe UI',system-ui,-apple-system,sans-serif;
      background:#0f0e17;color:#fffffe;overflow:hidden;
    }
    body::before{
      content:'';position:fixed;inset:0;z-index:0;
      background:
        radial-gradient(ellipse 60% 50% at 20% 30%,rgba(255,61,113,.12) 0%,transparent 70%),
        radial-gradient(ellipse 50% 60% at 80% 70%,rgba(114,9,183,.15) 0%,transparent 70%),
        radial-gradient(ellipse 40% 40% at 50% 50%,rgba(72,149,239,.08) 0%,transparent 70%);
    }
    body::after{
      content:'';position:fixed;inset:0;z-index:0;
      background:
        repeating-linear-gradient(90deg,rgba(255,255,255,.015) 0px,rgba(255,255,255,.015) 1px,transparent 1px,transparent 80px),
        repeating-linear-gradient(0deg,rgba(255,255,255,.015) 0px,rgba(255,255,255,.015) 1px,transparent 1px,transparent 80px);
    }
    .container{
      position:relative;z-index:1;text-align:center;padding:3rem 2rem;
      max-width:520px;width:100%;
    }
    .ticket-icon{
      display:inline-block;margin-bottom:1.5rem;position:relative;
      width:80px;height:52px;
      background:linear-gradient(135deg,#ff3d71,#7209b7);
      border-radius:8px;transform:rotate(-6deg);
      box-shadow:0 8px 32px rgba(255,61,113,.25);
    }
    .ticket-icon::before,.ticket-icon::after{
      content:'';position:absolute;width:14px;height:14px;
      background:#0f0e17;border-radius:50%;top:50%;transform:translateY(-50%);
    }
    .ticket-icon::before{left:-7px}
    .ticket-icon::after{right:-7px}
    .ticket-icon span{
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(6deg);
      font-size:.85rem;font-weight:700;letter-spacing:1px;color:#fffffe;
    }
    h1{
      font-size:2.2rem;font-weight:800;letter-spacing:-0.5px;
      background:linear-gradient(135deg,#fffffe 0%,#ff3d71 50%,#7209b7 100%);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;margin-bottom:.5rem;line-height:1.2;
    }
    .version{
      font-size:.85rem;color:rgba(255,255,255,.4);letter-spacing:2px;
      font-weight:500;margin-bottom:2.5rem;text-transform:uppercase;
    }
    .links{display:flex;flex-direction:column;gap:.75rem;margin-bottom:2.5rem}
    .btn{
      display:inline-flex;align-items:center;justify-content:center;
      padding:.85rem 1.5rem;border-radius:12px;text-decoration:none;
      font-size:.95rem;font-weight:600;letter-spacing:.3px;
      transition:all .3s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden;
    }
    .btn-primary{
      background:linear-gradient(135deg,#ff3d71,#7209b7);color:#fffffe;
      box-shadow:0 4px 20px rgba(255,61,113,.3);
    }
    .btn-primary:hover{
      transform:translateY(-2px);
      box-shadow:0 8px 30px rgba(255,61,113,.45);
    }
    .btn-secondary{
      background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);
      border:1px solid rgba(255,255,255,.08);
      backdrop-filter:blur(10px);
    }
    .btn-secondary:hover{
      background:rgba(255,255,255,.1);
      border-color:rgba(255,61,113,.3);color:#fffffe;
      transform:translateY(-2px);
    }
    .sign{
      font-size:.8rem;color:rgba(255,255,255,.3);
      padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.06);
    }
    .sign a{
      color:rgba(255,61,113,.7);text-decoration:none;
      transition:color .2s ease;
    }
    .sign a:hover{color:#ff3d71}
    @media(max-width:480px){
      h1{font-size:1.6rem}
      .container{padding:2rem 1.25rem}
      .ticket-icon{width:64px;height:42px}
      .ticket-icon span{font-size:.7rem}
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="ticket-icon"><span>TICKET</span></div>
    <h1>Event Booking System</h1>
    <p class="version">v${version}</p>
    <div class="links">
      <a href="/api-docs" class="btn btn-primary">API Documentation</a>
      <a href="/api/health" class="btn btn-secondary">Health Check</a>
    </div>
    <footer class="sign">
      Created by
      <a href="https://serkanbayraktar.com/" target="_blank" rel="noopener noreferrer">Serkanby</a>
      |
      <a href="https://github.com/Serkanbyx" target="_blank" rel="noopener noreferrer">Github</a>
    </footer>
  </div>
</body>
</html>`);
});

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});



// Connect to MongoDB before handling API requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});










// Route mounting
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const userRoutes = require("./routes/userRoutes");
const organizerRoutes = require("./routes/organizerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

//new--
console.log("ROUTE CHECK:", {
  authRoutes: typeof authRoutes,
  eventRoutes: typeof eventRoutes,
  registrationRoutes: typeof registrationRoutes,
  uploadRoutes: typeof uploadRoutes,
  userRoutes: typeof userRoutes,
  organizerRoutes: typeof organizerRoutes,
  adminRoutes: typeof adminRoutes,
  paymentRoutes: typeof paymentRoutes,
});
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);

// 404 handler
app.use((_req, _res, next) => {
  const error = new Error("Route not found");
  error.statusCode = 404;
  next(error);
});

// Global error handler
app.use(errorHandler);

// Connect to DB, then start server
// connectDB().then(() => {
//   verifyConnection();

//   app.listen(env.PORT, () => {
//     console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
//   });
// });






// Start local server during development
if (require.main === module) {
  connectDB()
    .then(() => {
      verifyConnection();

      app.listen(env.PORT, () => {
        console.log(
          `Server running in ${env.NODE_ENV} mode on port ${env.PORT}`
        );
      });
    })
    .catch((error) => {
      console.error("Server startup failed:", error);
      process.exit(1);
    });
}

module.exports = app;