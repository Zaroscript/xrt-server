import { body, param, validationResult } from 'express-validator';
import { AppError } from '../../utils/errors.js';

export const validatePlanId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid plan ID format')
];

export const validateCreatePlan = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Plan name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Plan name must be between 3 and 100 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
    
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
    
  body('billingCycle')
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle must be either monthly or yearly'),
    
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array of strings'),
    
  body('maxRestaurants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum restaurants must be a positive integer'),
    
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

export const validateUpdatePlan = [
  ...validatePlanId,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Plan name must be between 3 and 100 characters'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
    
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array().map(err => err.msg).join('. ');
      return next(new AppError(message, 400));
    }
    next();
  }
];
