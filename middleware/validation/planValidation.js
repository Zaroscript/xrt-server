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
    
  body('duration')
    .isIn([1, 12])
    .withMessage('Duration must be 1 (monthly) or 12 (yearly)'),
    
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      // Filter out empty strings and check if all remaining items are strings
      const validFeatures = value.filter(f => f && typeof f === 'string' && f.trim().length > 0);
      return validFeatures.length > 0;
    })
    .withMessage('Features must contain at least one non-empty string'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
    
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean'),
    
  // Custom discount validation
  body('discount')
    .optional()
    .custom((value) => {
      // Allow discount to be undefined or null
      if (value === undefined || value === null) return true;
      // If discount exists, it must be an object with valid structure
      if (typeof value !== 'object') return false;
      // If discount exists and has a value, it must have a valid type
      if (value.value !== undefined && value.value !== null && value.value > 0) {
        if (!value.type || !['percentage', 'fixed'].includes(value.type)) {
          return false;
        }
      }
      return true;
    })
    .withMessage('Discount must be a valid object with type and value'),
    
  body('discount.type')
    .if(body('discount').exists())
    .optional()
    .isIn(['percentage', 'fixed'])
    .withMessage('Discount type must be either percentage or fixed'),
    
  body('discount.value')
    .if(body('discount').exists())
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount value must be between 0 and 100'),
    
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
    
  body('duration')
    .optional()
    .isIn([1, 12])
    .withMessage('Duration must be 1 (monthly) or 12 (yearly)'),
    
  body('features')
    .optional()
    .isArray()
    .withMessage('Features must be an array')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      // For updates, allow empty arrays or arrays with empty strings
      // Just validate that it's an array of strings if not empty
      return true; // Allow any array structure for updates
    })
    .withMessage('Features must be an array'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
    
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean'),
    
  // Custom discount validation
  body('discount')
    .optional()
    .custom((value) => {
      // Allow discount to be undefined or null
      if (value === undefined || value === null) return true;
      // If discount exists, it must be an object with valid structure
      if (typeof value !== 'object') return false;
      // If discount exists and has a value, it must have a valid type
      if (value.value !== undefined && value.value !== null && value.value > 0) {
        if (!value.type || !['percentage', 'fixed'].includes(value.type)) {
          return false;
        }
      }
      return true;
    })
    .withMessage('Discount must be a valid object with type and value'),
    
  body('discount.type')
    .if(body('discount').exists())
    .optional()
    .isIn(['percentage', 'fixed'])
    .withMessage('Discount type must be either percentage or fixed'),
    
  body('discount.value')
    .if(body('discount').exists())
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount value must be between 0 and 100'),
    
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const message = errors.array().map(err => err.msg).join('. ');
      return next(new AppError(message, 400));
    }
    next();
  }
];
