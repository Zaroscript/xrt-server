// controllers/authController.js

import User from "../models/User.js";
import Client from "../models/Client.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/generateToken.js";
import { sendPasswordResetEmail } from "../utils/emailService.js";
import { AppError } from "../utils/errors.js";
import jwt from "jsonwebtoken";

// Register
export const register = async (req, res, next) => {
  const { email, password, fName, lName, phone, oldWebsite, companyName } =
    req.body;

  try {
    if (!email || !password || !fName || !lName || !phone || !companyName) {
      return next(new AppError("All fields are required", 400));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return next(new AppError("Email is already registered", 400));

    const user = await User.create({
      email: email.toLowerCase().trim(),
      password,
      fName,
      lName,
      phone,
      companyName,
      companyName,
      oldWebsite: oldWebsite || "",
      role: "client",
      isApproved: false, // New registrations require admin approval
      isActive: false, // User is inactive until approved
      status: "pending", // User status is pending until admin approval
      plainPassword: password, // Save plain password for admin view
    });

    // Create Client profile for the new user (inactive until approved)
    await Client.create({
      user: user._id,
      companyName: companyName,
      oldWebsite: oldWebsite || "",
      isActive: false, // Client is inactive until admin approves
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.password = undefined;

    res.status(201).json({
      status: "success",
      message: "Registration successful. Your account is pending admin approval. You will be notified once your account is approved.",
      data: {
        user: {
          ...user.toObject(),
          isApproved: false, // Explicitly show approval status
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    console.error(err);
    next(new AppError("Registration failed", 500));
  }
};

// Login
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password)
      return next(new AppError("Email and password required", 400));

    const user = await User.findOne({ email }).select("+password +isApproved");
    if (!user) return next(new AppError("Incorrect email or password", 401));

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect)
      return next(
        new AppError(
          "The email or password you entered is incorrect. Please try again.",
          401
        )
      );

    // Check if user is blocked
    if (user.status === "blocked") {
      return next(
        new AppError(
          "Your account has been blocked. Please contact support for assistance.",
          403
        )
      );
    }

    // Check if user is pending approval
    if (user.status === "pending" || !user.isApproved) {
      return next(
        new AppError(
          "Your account is currently pending approval. You will be notified once an admin reviews your registration.",
          403
        )
      );
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      status: "success",
      data: {
        user: userData,
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    console.error(err);
    next(new AppError("Login failed", 500));
  }
};

// Get current user
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return next(new AppError("User not found", 404));

    let clientProfile = null;
    if (user.role === "client") {
      clientProfile = await Client.findOne({ user: user._id })
        .populate("services", "name description")
        .populate("currentPlan");
    }

    res.status(200).json({
      status: "success",
      data: {
        user,
        clientProfile,
      },
    });
  } catch (err) {
    next(new AppError("Error fetching user data", 500));
  }
};

// Logout
export const logout = async (req, res, next) => {
  try {
    res
      .status(200)
      .json({ status: "success", message: "Logged out successfully" });
  } catch (err) {
    next(new AppError("Logout error", 500));
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

// Refresh Token
export const refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError("Refresh token is required", 400));
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.status(200).json({
      status: "success",
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    return next(new AppError("Invalid refresh token", 401));
  }
};

// Update user details
export const updateDetails = async (req, res, next) => {
  try {
    console.log("updateDetails called");
    console.log("req.body:", req.body);
    console.log("req.user:", req.user ? req.user._id : "no user");

    const { fName, lName, email } = req.body;

    const fieldsToUpdate = {};
    if (fName) fieldsToUpdate.fName = fName;
    if (lName) fieldsToUpdate.lName = lName;
    if (email) {
      console.log("Checking email uniqueness for:", email);
      // Check if email already exists
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user.id },
      });
      if (existingUser) {
        console.log("Email already in use");
        return next(new AppError("Email already in use", 400));
      }
      fieldsToUpdate.email = email;
    }

    console.log("fieldsToUpdate:", fieldsToUpdate);

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!updatedUser) {
      console.log("User not found during update");
      return next(new AppError("User not found", 404));
    }

    console.log("Update successful");

    res.status(200).json({
      status: "success",
      data: { user: updatedUser },
    });
  } catch (err) {
    console.error("Error in updateDetails:", err);
    next(err);
  }
};

// Update password
export const updatePassword = async (req, res, next) => {
  try {
    console.log("updatePassword called");
    const { currentPassword, newPassword } = req.body;

    if (!req.user || !req.user._id) {
      console.log("User not found in request");
      return next(new AppError("User not authenticated", 401));
    }

    console.log("User ID from req:", req.user._id);

    if (!currentPassword || !newPassword) {
      return next(new AppError("Please provide current and new password", 400));
    }

    // Get user with password field
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      console.log("User not found in db");
      return next(new AppError("User not found", 404));
    }

    // Check if current password is correct
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    console.log("Password correct:", isPasswordCorrect);

    if (!isPasswordCorrect) {
      return next(new AppError("Your current password is incorrect", 401));
    }

    // Update password
    user.password = newPassword;
    await user.save();
    console.log("Password updated and saved");

    // Generate new tokens
    const accessToken = generateAccessToken(user);
    console.log("New token generated");

    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
      data: { accessToken },
    });
  } catch (err) {
    console.error("Error in updatePassword:", err);
    next(err);
  }
};
