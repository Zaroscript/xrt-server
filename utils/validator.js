import { body, validationResult } from 'express-validator';
import { ValidationError } from './errors.js';

// Custom sanitizers
const sanitizeEmail = (value) => {
  if (!value) return value;
  return value.toString().toLowerCase().trim();
};

const sanitizeString = (value) => {
  if (!value) return value;
  return value.toString().trim();
};

// Custom validators
const isStrongPassword = (value) => {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!strongPasswordRegex.test(value)) {
    throw new Error('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
  }
  return true;
};

const noHtmlTags = (value) => {
  if (!value) return true;
  const htmlRegex = /<[a-z][\s\S]*>/i;
  if (htmlRegex.test(value)) {
    throw new Error('HTML tags are not allowed');
  }
  return true;
};

// Main validation middleware
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().reduce((acc, error) => {
      if (!acc[error.param]) {
        acc[error.param] = [];
      }
      acc[error.param].push(error.msg);
      return acc;
    }, {});
    
    return next(new ValidationError(errorMessages));
  }
  
  next();
};

// Validation Chains
export const registerValidation = [
  // Email validation
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .customSanitizer(sanitizeEmail)
    .isLength({ max: 100 }).withMessage('Email must be less than 100 characters')
    .normalizeEmail(),
    
  // Password validation
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .custom(isStrongPassword)
    .custom(noHtmlTags),
    
  // First name validation (support both fName and fname for backward compatibility)
  body(['fName', 'fname'])
    .optional()
    .isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters')
    .customSanitizer(sanitizeString)
    .custom(noHtmlTags),
    
  // Last name validation (support both lName and lname for backward compatibility)
  body(['lName', 'lname'])
    .optional()
    .isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters')
    .customSanitizer(sanitizeString)
    .custom(noHtmlTags),
    
  // Phone validation
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .matches(/^(\+?1[\s.-]?)?(\([0-9]{3}\)[\s.-]?|[0-9]{3}[\s.-]?)[0-9]{3}[\s.-]?[0-9]{4}$/)
    .withMessage('Please provide a valid US phone number')
    .customSanitizer(sanitizeString),
    
  // Business location validation (all fields optional)
  body('businessAddress')
    .optional()
    .isLength({ max: 200 }).withMessage('Address must be less than 200 characters')
    .customSanitizer(sanitizeString)
    .custom(noHtmlTags),
    
  body('businessCity')
    .optional()
    .isLength({ max: 100 }).withMessage('City must be less than 100 characters')
    .customSanitizer(sanitizeString)
    .custom(noHtmlTags),
    
  body('businessState')
    .optional()
    .isLength({ min: 2, max: 2 }).withMessage('State must be a 2-letter code')
    .isUppercase().withMessage('State must be in uppercase')
    .customSanitizer(sanitizeString)
    .custom(noHtmlTags),
    
  body('businessZipCode')
    .optional()
    .matches(/^\d{5}(-\d{4})?$/).withMessage('Please provide a valid ZIP code')
    .customSanitizer(sanitizeString),
    
  // Optional fields
  body('businessCountry')
    .optional()
    .isLength({ max: 100 }).withMessage('Country must be less than 100 characters')
    .customSanitizer(sanitizeString)
    .custom(noHtmlTags),
    
  body('oldWebsite')
    .optional()
    .isURL().withMessage('Please provide a valid URL')
    .customSanitizer(sanitizeString)
];

export const loginValidation = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .customSanitizer(sanitizeEmail),
    
  body('password')
    .notEmpty().withMessage('Password is required')
];

// Additional validation chains
export const updatePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
    
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .custom(isStrongPassword)
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

export const resetPasswordValidation = [
  body('password')
    .notEmpty().withMessage('Password is required')
    .custom(isStrongPassword),
    
  body('passwordConfirm')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// Sanitization middleware
export const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};