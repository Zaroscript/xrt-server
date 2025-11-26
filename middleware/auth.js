import User from "../models/User.js";
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
      "+isActive +isApproved +passwordChangedAt"
    );
    if (!user) {
      clearAccessTokenCookie(res);
      return next(new UnauthorizedError("User no longer exists."));
    }

    if (!user.isActive) {
      clearAccessTokenCookie(res);
      return next(new ForbiddenError("Your account has been deactivated."));
    }

    if (!user.isApproved) {
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
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError("You are not authorized."));
    }
    next();
  };
};
