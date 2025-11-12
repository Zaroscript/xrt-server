import User from '../models/User.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { verifyToken } from '../utils/generateToken.js';

// Security headers for auth-related responses
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'"
};

// Helper function to clear JWT cookie
const clearJwtCookie = (res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    path: '/',
    ...(process.env.NODE_ENV === 'production' && {
      domain: '.xrt-tech.com'
    })
  });
};

export const protect = async (req, res, next) => {
  try {
    // Skip setting security headers for OPTIONS requests (preflight)
    if (req.method !== 'OPTIONS') {
      Object.entries(securityHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    // 1) Get token from header, query parameter, or cookie
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new UnauthorizedError('You are not logged in! Please log in to get access.'));
    }

    // 2) Verify token
    const decoded = verifyToken(token, process.env.JWT_SECRET);
    
    if (!decoded) {
      console.error('Token verification failed: Invalid token');
      clearJwtCookie(res);
      return next(new UnauthorizedError('Invalid or expired token. Please log in again.'));
    }
    
    console.log('Token verified successfully for user ID:', decoded.id);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id).select('+isActive +isApproved +passwordChangedAt');
    if (!currentUser) {
      console.log(`User with ID ${decoded.id} not found`);
      clearJwtCookie(res);
      return next(new UnauthorizedError('The user belonging to this token no longer exists.'));
    }

    // 4) Check if user is active
    if (!currentUser.isActive) {
      console.log(`User account ${currentUser._id} is not active`);
      clearJwtCookie(res);
      return next(new ForbiddenError('Your account has been deactivated. Please contact support.'));
    }

    // 5) Check if user is approved
    if (!currentUser.isApproved) {
      console.log(`User account ${currentUser._id} is not approved`);
      return next(new ForbiddenError('Your account is pending approval. Please contact support.'));
    }

    // 6) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      console.log(`User ${currentUser._id} changed password after token was issued`);
      clearJwtCookie(res);
      return next(new UnauthorizedError('User recently changed password! Please log in again.'));
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    res.locals.user = currentUser;
    
    // Log successful authentication
    console.log(`User ${currentUser._id} authenticated successfully`);
    
    // Set a custom header to indicate authentication status
    res.setHeader('X-Authenticated-User', currentUser._id);
    
    next();
  } catch (err) {
    console.error('Authentication error in protect middleware:', err);
    
    // Clear invalid token from cookies
    clearJwtCookie(res);
    
    // Handle specific JWT errors
    if (err.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid authentication token. Please log in again.'));
    }
    
    if (err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Your session has expired. Please log in again.'));
    }
    
    // For other errors, pass them to the global error handler
    next(err);
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError('You do not have permission to perform this action')
      );
    }
    next();
  };
};

// Only for rendered pages, no errors!
export const isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Verify token
      const decoded = await jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};