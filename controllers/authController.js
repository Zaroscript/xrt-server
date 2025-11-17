import User from "../models/User.js";
import Client from "../models/Client.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../utils/generateToken.js";
import { sendPasswordResetEmail } from "../utils/emailService.js";
import { AppError } from "../utils/errors.js";
import jwt from "jsonwebtoken";

// Register
export const register = async (req, res, next) => {
  console.log(
    "Registration request received:",
    JSON.stringify(req.body, null, 2)
  );

  const { email, password, fName, lName, phone, oldWebsite, companyName } =
    req.body;

  try {
    // Input validation
    if (!email || !password || !fName || !lName || !phone || !companyName) {
      console.error("Missing required fields:", {
        email: !!email,
        password: !!password,
        fName: !!fName,
        lName: !!lName,
        phone: !!phone,
        companyName: !!companyName,
      });
      return next(new AppError("All fields are required", 400));
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.error("Registration failed: Email already exists", { email });
      return next(new AppError("Email is already registered", 400));
    }

    // Create new user
    console.log("Creating new user with data:", {
      email,
      fName,
      lName,
      phone: phone.substring(0, 5) + "...",
      companyName,
    });

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password,
      fName: fName.trim(),
      lName: lName.trim(),
      phone: phone.trim(),
      companyName: companyName.trim(),
      oldWebsite: (oldWebsite || "").trim(),
      role: "client",
      isApproved: false,
    });

    console.log("User created successfully:", {
      userId: user._id,
      email: user.email,
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as HTTP-only cookie
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
      // For development, don't set domain to allow localhost
      ...(process.env.NODE_ENV === "production" && { domain: ".xrt-tech.com" }),
    });

    // Remove password from output
    user.password = undefined;

    res.status(201).json({
      status: "success",
      message: "Registration successful. Awaiting admin approval.",
      data: {
        id: user._id,
        email: user.email,
        name: `${user.fName} ${user.lName}`,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Registration error:", {
      name: err.name,
      message: err.message,
      code: err.code,
      errors: err.errors ? Object.keys(err.errors) : null,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    // Handle specific MongoDB errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((val) => val.message);
      return next(
        new AppError(`Validation failed: ${messages.join(". ")}`, 400)
      );
    }

    if (err.code === 11000) {
      return next(new AppError("Email is already registered", 400));
    }

    next(new AppError("Registration failed. Please try again later.", 500));
  }
};

// Get current user
export const getMe = async (req, res, next) => {
  console.log('=== GETME REQUEST RECEIVED ===');
  console.log('Request headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    cookie: req.headers.cookie,
    authorization: req.headers.authorization
  });
  
  try {
    // Get user from database (exclude sensitive data)
    const user = await User.findById(req.user.id).select(
      "-password -refreshTokens -__v"
    );

    if (!user) {
      return next(new AppError("No user found with that ID", 404));
    }

    // Check if user is approved
    if (!user.isApproved) {
      return next(new AppError("Your account is pending approval", 403));
    }

    // Get client profile if user is a client
    let clientProfile = null;
    if (user.role === 'client') {
      clientProfile = await Client.findOne({ user: user._id })
        .populate('services', 'name description')
        .populate('currentPlan');
    }

    // Generate new access token (extend session)
    const accessToken = generateAccessToken(user);

    // Set new access token in response header
    res.setHeader("Authorization", `Bearer ${accessToken}`);

    res.status(200).json({
      status: "success",
      data: {
        user,
        clientProfile,
        tokens: {
          accessToken,
        },
      },
    });
  } catch (err) {
    console.error("Error in getMe:", err);
    next(new AppError("Error fetching user data", 500));
  }
};

// Login
export const login = async (req, res, next) => {
  const { email, password } = req.body;
  
  console.log('=== LOGIN REQUEST RECEIVED ===');
  console.log('Email:', email);
  console.log('Request headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    cookie: req.headers.cookie
  });

  try {
    // 1) Check if email and password exist
    if (!email || !password) {
      console.log("Login attempt with missing email or password");
      return next(new AppError("Please provide both email and password!", 400));
    }

    // 2) Check if user exists
    const user = await User.findOne({ email }).select("+password +isApproved");

    if (!user) {
      console.log(`Login failed: No user found with email ${email}`);
      return next(new AppError("Incorrect email or password", 401));
    }

    // 3) Check if password is correct
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      console.log(`Login failed: Incorrect password for user ${email}`);
      return next(new AppError("Incorrect email or password", 401));
    }

    // 4) Check if user is approved
    if (!user.isApproved) {
      console.log(`Login failed: Account not approved for user ${email}`);
      return next(
        new AppError(
          "Your account is pending approval. Please contact support.",
          403
        )
      );
    }

    // 5) Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 6) Add refresh token to user's refreshTokens array
    user.refreshTokens.push({ token: refreshToken });
    await user.save({ validateBeforeSave: false });

    // 7) Remove sensitive data from output
    const userData = user.toObject();
    delete userData.password;
    delete userData.refreshTokens;

    // 8) Set cookie with refresh token
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: "/",
      // For development, don't set domain to allow localhost
      ...(isProduction && { domain: ".xrt-tech.com" }),
    };

    res.cookie("jwt", refreshToken, cookieOptions);
    
    console.log('=== LOGIN COOKIE SET ===');
    console.log('Refresh token cookie set with options:', cookieOptions);
    console.log('Cookie value preview:', refreshToken.substring(0, 20) + '...');
    console.log('Response headers before sending:', {
      'set-cookie': res.getHeader('set-cookie')
    });

    // 9) Send response with tokens
    res.status(200).json({
      status: "success",
      data: {
        user: userData,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });

    console.log(`User ${user.email} logged in successfully`);
  } catch (err) {
    console.error("Login error:", err);
    return next(new AppError("An error occurred during login", 500));
  }
};

// Refresh Token
export const refresh = async (req, res, next) => {
  console.log('=== REFRESH TOKEN REQUEST ===');
  console.log('Request cookies:', req.cookies);
  console.log('Request headers:', {
    cookie: req.headers.cookie,
    authorization: req.headers.authorization,
    origin: req.headers.origin,
    referer: req.headers.referer
  });
  
  try {
    // Try to get refresh token from multiple sources
    let refreshToken =
      req.cookies.jwt ||
      req.body.refreshToken ||
      (req.headers.authorization && req.headers.authorization.split(" ")[1]);

    console.log('Refresh token sources:', {
      fromCookie: !!req.cookies.jwt,
      fromBody: !!req.body.refreshToken,
      fromHeader: !!(req.headers.authorization && req.headers.authorization.split(" ")[1]),
      tokenFound: !!refreshToken
    });

    if (!refreshToken) {
      console.log("No refresh token found in request");
      console.log('=== REFRESH TOKEN FAILED: NO TOKEN ===');
      return next(
        new AppError("No refresh token provided. Please log in again.", 401)
      );
    }

    console.log("Attempting to refresh token...");
    console.log('Token preview:', refreshToken.substring(0, 20) + '...');

    // Verify the refresh token
    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (!decoded || !decoded.id) {
      console.error("Invalid refresh token - verification failed");
      // Clear invalid token from cookies
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        path: "/",
      });
      return next(
        new AppError("Invalid refresh token. Please log in again.", 401)
      );
    }

    // Find the user and check if the refresh token is still valid
    const user = await User.findOne({ _id: decoded.id }).select(
      "+refreshTokens"
    );

    if (!user) {
      console.log(`No user found with ID: ${decoded.id}`);
      return next(new AppError("No user found with this token", 404));
    }

    // Check if the refresh token exists in the user's refreshTokens array
    console.log(`Looking for refresh token in user's ${user.refreshTokens?.length || 0} stored tokens`);
    
    // Clean up old tokens (keep only last 10 tokens to prevent bloat)
    if (user.refreshTokens && user.refreshTokens.length > 10) {
      console.log(`Cleaning up ${user.refreshTokens.length - 10} old refresh tokens`);
      user.refreshTokens = user.refreshTokens
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
      await user.save({ validateBeforeSave: false });
    }
    
    const tokenIndex = user.refreshTokens.findIndex(
      (token) => token.token === refreshToken
    );
    if (tokenIndex === -1) {
      console.log("Refresh token not found in user's tokens - clearing all tokens and forcing logout");
      // Clear all refresh tokens for this user to prevent accumulation
      user.refreshTokens = [];
      await user.save({ validateBeforeSave: false });
      
      // Clear the invalid refresh token cookie
      res.clearCookie("jwt", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        path: "/",
      });
      res.clearCookie("access_token", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
        path: "/",
      });
      return next(
        new AppError("Session expired. Please log in again.", 401)
      );
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    
    console.log('Generated new tokens successfully');
    console.log('New access token preview:', newAccessToken.substring(0, 20) + '...');
    console.log('New refresh token preview:', newRefreshToken.substring(0, 20) + '...');

    // Replace the old refresh token with the new one (token rotation)
    user.refreshTokens[tokenIndex] = { 
      token: newRefreshToken,
      createdAt: new Date()
    };
    await user.save({ validateBeforeSave: false });

    // Set cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      path: "/",
      // For development, don't set domain to allow localhost
      ...(process.env.NODE_ENV === "production" && { domain: ".xrt-tech.com" }),
    };

    // Set the refresh token in HTTP-only cookie
    res.cookie("jwt", newRefreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    console.log('=== REFRESH COOKIE SET ===');
    console.log('New refresh token cookie set');
    console.log('New refresh token preview:', newRefreshToken.substring(0, 20) + '...');

    // Set the access token in a separate cookie (non-httpOnly for client-side access)
    res.cookie("access_token", newAccessToken, {
      ...cookieOptions,
      httpOnly: false, // Allow client-side access
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Return the user data and tokens in the response
    res.status(200).json({
      status: "success",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          _id: user._id,
          email: user.email,
          fName: user.fName,
          lName: user.lName,
          role: user.role,
        },
      },
    });
    
    console.log('=== REFRESH TOKEN SUCCESS ===');
  } catch (err) {
    console.error('Refresh token error:', err);
    
    // Clear the invalid refresh token cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      path: "/",
      ...(process.env.NODE_ENV === "production" && {
        domain: ".xrt-tech.com",
      }),
    });

    if (err.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token. Please log in again!", 401));
    }
    if (err.name === "TokenExpiredError") {
      return next(
        new AppError("Your session has expired! Please log in again.", 401)
      );
    }
    return next(
      new AppError("Error refreshing token. Please log in again.", 500)
    );
  }
};

// Clear all refresh tokens (for debugging/cleanup)
export const clearAllTokens = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(new AppError("Email is required", 400));
    }
    
    const user = await User.findOne({ email }).select("+refreshTokens");
    
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    
    const tokenCount = user.refreshTokens?.length || 0;
    user.refreshTokens = [];
    await user.save({ validateBeforeSave: false });
    
    res.status(200).json({
      status: "success",
      message: `Cleared ${tokenCount} refresh tokens for user ${email}`
    });
  } catch (error) {
    console.error("Error clearing tokens:", error);
    return next(new AppError("Error clearing tokens", 500));
  }
};

// Logout (single session)
export const logout = async (req, res, next) => {
  try {
    // Get refresh token from body or cookie
    const refreshToken = req.body.refreshToken || req.cookies.jwt;

    if (!refreshToken) {
      console.log("No refresh token provided for logout");
      return next(new AppError("No refresh token provided", 400));
    }

    // Get user from request (added by protect middleware)
    const user = req.user;

    if (user) {
      // Remove the refresh token from the user's tokens array
      const initialLength = user.refreshTokens.length;
      user.refreshTokens = user.refreshTokens.filter(
        (token) => token.token !== refreshToken
      );

      // Only save if tokens were actually removed
      if (user.refreshTokens.length < initialLength) {
        await user.save({ validateBeforeSave: false });
        console.log(`User ${user._id} logged out successfully`);
      }
    }

    // Clear the JWT cookie with proper options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      path: "/",
      // For development, don't set domain to allow localhost
      ...(process.env.NODE_ENV === "production" && {
        domain: ".xrt-tech.com",
      }),
    };

    res.clearCookie("jwt", cookieOptions);

    res.status(200).json({
      status: "success",
      message: "Successfully logged out",
    });
  } catch (err) {
    console.error("Logout error:", err);
    next(new AppError("Error during logout", 500));
  }
};

// Forgot Password
export const requestPasswordReset = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return next(new AppError("No user with that email", 404));

    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    await sendPasswordResetEmail(email, resetToken);

    res.json({ status: "success", message: "Password reset email sent" });
  } catch (err) {
    next(err);
  }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return next(new AppError("Invalid token", 400));

    user.password = password;
    await user.save();

    res.json({ status: "success", message: "Password reset successful" });
  } catch (err) {
    next(new AppError("Invalid or expired token", 400));
  }
};
