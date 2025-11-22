import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import connectDB from "./config/database.js";
import rateLimit from "express-rate-limit";
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
import errorHandler from "./middleware/errorHandler.js";
import User from "./models/User.js";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// ========================
// CORS FIX + Security headers
// ========================
app.set("trust proxy", 1);

// Allowed origins
const allowedOrigins = [
  "https://xrttech.com",
  "https://www.xrttech.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.DASHBOARD_FRONTEND_URL,
  process.env.USER_FRONTEND_URL
].filter(Boolean);

// Full CORS config
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Preflight (important!)
app.options("*", cors());

// ========================
// GLOBAL MIDDLEWARE
// ========================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());

// ========================
// ROUTES
// ========================
app.get("/api/v1", (req, res) => {
  res.status(200).json({ message: "XRT API is running 🚀" });
});

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

// Error Handler
app.use(errorHandler);

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();

    const superAdmin = await User.findOne({
      email: process.env.DEFAULT_ADMIN_EMAIL,
    });

    if (!superAdmin) {
      const emailPrefix = process.env.DEFAULT_ADMIN_EMAIL.split("@")[0];
      const fName = emailPrefix.split(".")[0] || "Admin";
      const lName = emailPrefix.split(".")[1] || "User";

      await User.create({
        email: process.env.DEFAULT_ADMIN_EMAIL,
        password: process.env.DEFAULT_ADMIN_PASS,
        fName: fName[0].toUpperCase() + fName.slice(1),
        lName: lName[0].toUpperCase() + lName.slice(1),
        role: "super_admin",
        isApproved: true,
      });

      console.log("Super Admin created");
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server start failed:", error);
    process.exit(1);
  }
};

start();
