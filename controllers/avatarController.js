import User from '../models/User.js';
import path from 'path';
import fs from 'fs';
import { AppError } from '../utils/errors.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Upload avatar for current user
// @route   POST /api/v1/users/me/avatar
//@access  Private
export const uploadMyAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please upload a file', 400));
    }

    // Generate avatar URL path
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    //Delete old avatar if exists
    const user = await User.findById(req.user.id);
    if (user.avatar) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Update user avatar
    user.avatar = avatarPath;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        avatar: avatarPath
      }
    });
  } catch (error) {
    // Clean up uploaded file if error occurs
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', 'avatars', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    next(error);
  }
};

// @desc    Upload avatar for any user (admin only)
// @route   POST /api/v1/users/:id/avatar
// @access  Private/Admin
export const uploadUserAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please upload a file', 400));
    }

    const userId = req.params.id;
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    // Delete old avatar if exists
    const user = await User.findById(userId);
    if (!user) {
      // Clean up uploaded file
      const filePath = path.join(__dirname, '..', 'uploads', 'avatars', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return next(new AppError('User not found', 404));
    }

    if (user.avatar) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Update user avatar
    user.avatar = avatarPath;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        avatar: avatarPath
      }
    });
  } catch (error) {
    // Clean up uploaded file if error occurs
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', 'avatars', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    next(error);
  }
};

// @desc    Delete avatar
// @route   DELETE /api/v1/users/me/avatar
// @access  Private
export const deleteMyAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.avatar) {
      return next(new AppError('No avatar to delete', 404));
    }

    // Delete avatar file
    const avatarPath = path.join(__dirname, '..', user.avatar);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
    }

    // Remove avatar from user
    user.avatar = null;
    await user.save({ validateBeforeSave: false });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};
