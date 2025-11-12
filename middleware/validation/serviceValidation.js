import { body, param, validationResult } from 'express-validator';
import { AppError } from '../../utils/errors.js';

export const validateServiceId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid service ID format')
];

export const validateCreateService = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Service name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Service name must be between 3 and 100 characters'),
    
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
    
  body('category')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Category must be between 2 and 50 characters'),
    
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array of strings'),
    
  body('process')
    .optional()
    .isArray()
    .withMessage('Process must be an array of strings'),
    
  body('basePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base price must be a positive number'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
    
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array().map(err => err.msg).join('. ');
      return next(new AppError(message, 400));
    }
    next();
  }
];

export const validateUpdateService = [
  ...validateServiceId,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Service name must be between 3 and 100 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
    
  body('basePrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base price must be a positive number'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array().map(err => err.msg).join('. ');
      return next(new AppError(message, 400));
    }
    next();
  }
];

export const validateServiceRequest = [
  body('message')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters'),
    
  body('customRequirements')
    .optional()
    .isString()
    .withMessage('Custom requirements must be a string')
    .isLength({ max: 2000 })
    .withMessage('Custom requirements cannot exceed 2000 characters'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array().map(err => err.msg).join('. ');
      return next(new AppError(message, 400));
    }
    next();
  }
];
