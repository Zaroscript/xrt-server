import User from "../models/User.js";
import Client from "../models/Client.js";
import jwt from "jsonwebtoken";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'",
};

const clearAccessTokenCookie = (res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/",
  });
};

export const protect = async (req, res, next) => {
  try {
    if (req.method !== "OPTIONS") {
      Object.entries(securityHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return next(new UnauthorizedError("Authentication required."));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        ignoreExpiration: false,
      });
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(
          new UnauthorizedError("Session expired. Please log in again.")
        );
      }
      return next(new UnauthorizedError("Invalid token. Please log in again."));
    }

    const user = await User.findById(decoded.id).select(
      "+isActive +isApproved +passwordChangedAt +status"
    );
    if (!user) {
      clearAccessTokenCookie(res);
      return next(new UnauthorizedError("User no longer exists."));
    }

    if (!user.isActive) {
      clearAccessTokenCookie(res);
      return next(new ForbiddenError("Your account has been deactivated."));
    }

    // Check if user is pending approval
    if (user.status === "pending" || !user.isApproved) {
      return next(new ForbiddenError("Your account is pending approval."));
    }

    if (user.changedPasswordAfter(decoded.iat)) {
      clearAccessTokenCookie(res);
      return next(
        new UnauthorizedError("Password changed recently. Please log in again.")
      );
    }

    req.user = user;
    res.locals.user = user;

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    clearAccessTokenCookie(res);
    next(err);
  }
};

export const handleTokenExpiration = (err, req, res, next) => {
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      message: "Session expired. Please log in again.",
      code: "TOKEN_EXPIRED",
    });
  }
  next(err);
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError("User not found in request."));
    }
    
    const userRole = req.user.role;
    if (!userRole) {
      console.error("User role is missing:", { userId: req.user._id, user: req.user });
      return next(new ForbiddenError("User role is not set. Please contact support."));
    }
    
    if (!roles.includes(userRole)) {
      console.error("Authorization failed:", {
        userRole,
        allowedRoles: roles,
        userId: req.user._id,
        email: req.user.email,
        isApproved: req.user.isApproved,
        isActive: req.user.isActive
      });
      return next(
        new ForbiddenError(
          `You are not authorized. Required role: ${roles.join(" or ")}, Your role: ${userRole}`
        )
      );
    }
    next();
  };
};

// Middleware to check if user has a client profile
export const requireClientProfile = async (req, res, next) => {
  try {
    const client = await Client.findOne({ user: req.user.id });
    
    if (!client) {
      return next(new ForbiddenError("Client profile not found. Please contact support to set up your client profile."));
    }
    
    req.client = client;
    next();
  } catch (error) {
    console.error("Error checking client profile:", error);
    next(new ForbiddenError("Error verifying client profile."));
  }
};
