import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/mailer.js';
import {AppError} from '../utils/errors.js';
import jwt from 'jsonwebtoken';

// Register
export const register = async (req, res, next) => {
  const { 
    email, 
    password, 
    fname, 
    lname, 
    fName, 
    lName, 
    phone, 
    businessAddress,
    businessCity,
    businessState,
    businessZipCode,
    businessCountry,
    oldWebsite 
  } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return next(new AppError('User already exists', 400));

    // Support both fname/lname and fName/lName for backward compatibility
    const firstName = fName || fname || '';
    const lastName = lName || lname || '';

    if (!firstName || !lastName) {
      return next(new AppError('First name and last name are required', 400));
    }

    const user = await User.create({
      email,
      password,
      fName: firstName,
      lName: lastName,
      phone,
      businessLocation: {
        address: businessAddress || '',
        city: businessCity || '',
        state: businessState || '',
        zipCode: businessZipCode || '',
        country: businessCountry || 'USA'
      },
      oldWebsite: oldWebsite || '',
      role: 'client',
      isApproved: false,
    });

    // Optional: send verification email
    // const token = generateRefreshToken(user);
    // await sendVerificationEmail(email, token);

    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Awaiting admin approval.',
    });
  } catch (err) {
    next(err);
  }
};

// Get current user
export const getMe = async (req, res, next) => {
  try {
    // Get user from database (exclude sensitive data)
    const user = await User.findById(req.user.id).select('-password -refreshTokens -__v');
    
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }

    // Check if user is approved
    if (!user.isApproved) {
      return next(new AppError('Your account is pending approval', 403));
    }

    // Generate new access token (extend session)
    const accessToken = generateAccessToken(user);
    
    // Set new access token in response header
    res.setHeader('Authorization', `Bearer ${accessToken}`);

    res.status(200).json({
      status: 'success',
      data: {
        user,
        tokens: {
          accessToken
        }
      }
    });
  } catch (err) {
    console.error('Error in getMe:', err);
    next(new AppError('Error fetching user data', 500));
  }
};



// Login
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // 1) Check if email and password exist
    if (!email || !password) {
      console.log('Login attempt with missing email or password');
      return next(new AppError('Please provide both email and password!', 400));
    }

    // 2) Check if user exists
    const user = await User.findOne({ email }).select('+password +isApproved');
    
    if (!user) {
      console.log(`Login failed: No user found with email ${email}`);
      return next(new AppError('Incorrect email or password', 401));
    }

    // 3) Check if password is correct
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      console.log(`Login failed: Incorrect password for user ${email}`);
      return next(new AppError('Incorrect email or password', 401));
    }

    // 4) Check if user is approved
    if (!user.isApproved) {
      console.log(`Login failed: Account not approved for user ${email}`);
      return next(new AppError('Your account is pending approval. Please contact support.', 403));
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
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
    };

    // For development, allow cross-site cookies
    if (!isProduction) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.cookie('jwt', refreshToken, cookieOptions);

    // 9) Send response with tokens
    res.status(200).json({
      status: 'success',
      data: {
        user: userData,
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
    
    console.log(`User ${user.email} logged in successfully`);
  } catch (err) {
    console.error('Login error:', err);
    return next(new AppError('An error occurred during login', 500));
  }
};

// Refresh Token
export const refresh = async (req, res, next) => {
  try {
    // Try to get refresh token from multiple sources
    let refreshToken = req.cookies.jwt || 
                     req.body.refreshToken ||
                     (req.headers.authorization && req.headers.authorization.split(' ')[1]);

    if (!refreshToken) {
      console.log('No refresh token found in request');
      return next(new AppError('No refresh token provided. Please log in again.', 401));
    }

    console.log('Attempting to refresh token...');
    
    // Verify the refresh token
    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (!decoded || !decoded.id) {
      console.error('Invalid refresh token');
      // Clear invalid token from cookies
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        path: '/',
      });
      return next(new AppError('Invalid refresh token. Please log in again.', 401));
    }
    
    // Find the user and check if the refresh token is still valid
    const user = await User.findOne({ _id: decoded.id }).select('+refreshTokens');
    
    if (!user) {
      console.log(`No user found with ID: ${decoded.id}`);
      return next(new AppError('No user found with this token', 404));
    }

    // Check if the refresh token exists in the user's refreshTokens array
    const tokenIndex = user.refreshTokens.findIndex(token => token.token === refreshToken);
    if (tokenIndex === -1) {
      console.log('Refresh token not found in user\'s tokens');
      // Clear the invalid refresh token cookie
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        path: '/',
      });
      return next(new AppError('Invalid refresh token. Please log in again.', 401));
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    
    // Replace the old refresh token with the new one (token rotation)
    user.refreshTokens[tokenIndex] = { token: newRefreshToken };
    await user.save({ validateBeforeSave: false });

    // Set cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      path: '/',
      ...(process.env.NODE_ENV === 'production' && { domain: '.xrt-tech.com' })
    };
    
    // Set the refresh token in HTTP-only cookie
    res.cookie('jwt', newRefreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Set the access token in a separate cookie (non-httpOnly for client-side access)
    res.cookie('access_token', newAccessToken, {
      ...cookieOptions,
      httpOnly: false, // Allow client-side access
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Return the user data and tokens in the response
    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          _id: user._id,
          email: user.email,
          fname: user.fname,
          lname: user.lname,
          role: user.role,
          isApproved: user.isApproved
        }
      }
    });
    
  } catch (err) {
    console.error('Token refresh error:', err);
    
    // Clear the invalid refresh token cookie
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      path: '/',
      ...(process.env.NODE_ENV === 'production' && {
        domain: '.xrt-tech.com'
      })
    });
    
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired! Please log in again.', 401));
    }
    return next(new AppError('Error refreshing token. Please log in again.', 500));
  }
};

// Logout (single session)
export const logout = async (req, res, next) => {
  try {
    // Get refresh token from body or cookie
    const refreshToken = req.body.refreshToken || req.cookies.jwt;
    
    if (!refreshToken) {
      console.log('No refresh token provided for logout');
      return next(new AppError('No refresh token provided', 400));
    }
    
    // Get user from request (added by protect middleware)
    const user = req.user;
    
    if (user) {
      // Remove the refresh token from the user's tokens array
      const initialLength = user.refreshTokens.length;
      user.refreshTokens = user.refreshTokens.filter(token => token.token !== refreshToken);
      
      // Only save if tokens were actually removed
      if (user.refreshTokens.length < initialLength) {
        await user.save({ validateBeforeSave: false });
        console.log(`User ${user._id} logged out successfully`);
      }
    }

    // Clear the JWT cookie with proper options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      path: '/',
      ...(process.env.NODE_ENV === 'production' && {
        domain: '.xrt-tech.com'
      })
    };
    
    res.clearCookie('jwt', cookieOptions);

    res.status(200).json({
      status: 'success',
      message: 'Successfully logged out',
    });
    
  } catch (err) {
    console.error('Logout error:', err);
    next(new AppError('Error during logout', 500));
  }
};

// Forgot Password
export const requestPasswordReset = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return next(new AppError('No user with that email', 404));

    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await sendPasswordResetEmail(email, resetToken);

    res.json({ status: 'success', message: 'Password reset email sent' });
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
    if (!user) return next(new AppError('Invalid token', 400));

    user.password = password;
    await user.save();

    res.json({ status: 'success', message: 'Password reset successful' });
  } catch (err) {
    next(new AppError('Invalid or expired token', 400));
  }
};