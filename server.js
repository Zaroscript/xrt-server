import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import connectDB from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import subscriberRoutes from "./routes/subscriberRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import errorHandler from "./middleware/errorHandler.js";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// ========================
// MIDDLEWARE
// ========================

// Trust first proxy (if behind a proxy like nginx, heroku, etc.)
app.set("trust proxy", 1);

// Security headers - must come before CORS
app.use((req, res, next) => {
  // Don't set these headers for OPTIONS requests (preflight)
  if (req.method !== "OPTIONS") {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()"
    );
  }
  next();
});

const corsOriginsFromEnv = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
  : [];

const allowedOrigins = [
  ...corsOriginsFromEnv,
  process.env.DASHBOARD_FRONTEND_URL,
  process.env.USER_FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (process.env.NODE_ENV === "development") return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Set-Cookie", "Authorization", "Content-Range", "X-Content-Range"],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Body parser middleware with increased limit
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      // Add any parameters you want to allow in query string
    ],
  })
);

// Serve static files (uploaded avatars)
app.use("/uploads", express.static("uploads"));

// Rate limiting (temporarily disabled for testing)
// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // Limit each IP to 5 login requests per windowMs
//   message: { status: 'error', message: 'Too many login attempts, please try again later.' },
// });

// Apply rate limiting to login route (temporarily disabled)
// app.use("/api/v1/auth/login", loginLimiter);

// ========================
// ROUTES
// ========================
// Root API route
app.get("/api/v1", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "XRT API is running",
    endpoints: {
      auth: "/api/v1/auth",
      admin: "/api/v1/admin",
      services: "/api/v1/services",
      plans: "/api/v1/plans",
      subscribers: "/api/v1/subscribers",
      subscriptions: "/api/v1/subscriptions",
      invoices: "/api/v1/invoices",
      requests: "/api/v1/requests",
    },
    documentation: "Coming soon...",
  });
});

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/services", serviceRoutes);
app.use("/api/v1/plans", planRoutes);
app.use("/api/v1/subscribers", subscriberRoutes);
app.use("/api/v1/plan-management", subscriptionRoutes);
app.use("/api/v1/invoices", invoiceRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/requests", requestRoutes);

// ========================
// ERROR HANDLING
// ========================
app.use(errorHandler);

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 3000;

// Scheduled jobs
const startScheduledJobs = () => {
  // Import the auto-sync function
  import("./controllers/subscriberController.js").then(
    ({ autoSyncClientsToSubscribers }) => {
      // Run sync every hour (3600000 ms)
      setInterval(async () => {
        try {
          console.log("Running scheduled client-to-subscriber sync...");
          await autoSyncClientsToSubscribers();
          console.log("Scheduled sync completed successfully");
        } catch (error) {
          console.error("Error in scheduled sync:", error);
        }
      }, 3600000); // 1 hour

      // Also run once on server start
      setTimeout(async () => {
        try {
          console.log(
            "Running initial client-to-subscriber sync on server start..."
          );
          await autoSyncClientsToSubscribers();
          console.log("Initial sync completed successfully");
        } catch (error) {
          console.error("Error in initial sync:", error);
        }
      }, 5000); // 5 seconds after server starts
    }
  );
};

const start = async () => {
  try {
    await connectDB();

    // Create Super Admin if not exists
    // const superAdmin = await User.findOne({
    //   email: process.env.DEFAULT_ADMIN_EMAIL,
    // });

    // if (!superAdmin && process.env.DEFAULT_ADMIN_EMAIL && process.env.DEFAULT_ADMIN_PASS) {
    //   // Extract first name and last name from email
    //   const emailPrefix = process.env.DEFAULT_ADMIN_EMAIL.split('@')[0];
    //   const fName = emailPrefix.split('.')[0] || 'Admin';
    //   const lName = emailPrefix.split('.').length > 1 ? emailPrefix.split('.')[1] : 'User';

    //   await User.create({
    //     email: process.env.DEFAULT_ADMIN_EMAIL,
    //     password: process.env.DEFAULT_ADMIN_PASS,
    //     fName: fName.charAt(0).toUpperCase() + fName.slice(1), // Capitalize first letter
    //     lName: lName.charAt(0).toUpperCase() + lName.slice(1), // Capitalize first letter
    //     role: "super_admin",
    //     isApproved: true,
    //     companyName: "XRT Tech",
    //     phone: "(000) 000-0000",
    //   });
    //   console.log("✅ Super Admin created successfully");
    // }

    // Start scheduled jobs
    startScheduledJobs();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(
        `Admin Panel: ${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/admin`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
