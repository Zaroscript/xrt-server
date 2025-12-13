import express from "express";
import {
  register,
  login,
  logout,
  getMe,
  requestPasswordReset,
  resetPassword,
  refreshToken,
  updateDetails,
  updatePassword,
} from "../controllers/authController.js";
import {
  uploadMyAvatar,
  uploadUserAvatar,
  deleteMyAvatar,
} from "../controllers/avatarController.js";
import { protect, restrictTo } from "../middleware/auth.js";
import { uploadAvatar } from "../middleware/uploadMiddleware.js";

import {
  registerValidation,
  loginValidation,
  validate,
} from "../utils/validator.js";

const router = express.Router();

router.post("/register", registerValidation, validate, register);
router.post("/login", loginValidation, validate, login);
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.post("/forgot-password", requestPasswordReset);
router.patch("/reset-password/:token", resetPassword);
router.post("/refresh-token", refreshToken);

// Profile update routes
router.patch("/update-details", protect, updateDetails);
router.patch("/update-password", protect, updatePassword);

// Avatar routes
router.post(
  "/me/avatar",
  protect,
  (req, res, next) => {
    console.log(
      "Route /me/avatar hit. Body:",
      req.body,
      "Content-Type:",
      req.headers["content-type"]
    );
    next();
  },
  uploadAvatar.single("avatar"),
  uploadMyAvatar
);
router.delete("/me/avatar", protect, deleteMyAvatar);
router.post(
  "/users/:id/avatar",
  protect,
  restrictTo("super_admin", "moderator"),
  uploadAvatar.single("avatar"),
  uploadUserAvatar
);

export default router;
