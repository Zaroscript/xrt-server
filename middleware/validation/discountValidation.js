import { body } from 'express-validator';

export const validateDiscountData = [
  body('amount')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount amount must be between 0 and 100'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
    
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .custom((value, { req }) => {
      if (req.body.endDate && new Date(value) >= new Date(req.body.endDate)) {
        throw new Error('Start date must be before end date');
      }
      return true;
    }),
    
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
    
  body('code')
    .optional()
    .isString()
    .trim()
    .isUppercase()
    .withMessage('Discount code must be uppercase')
    .isLength({ min: 3, max: 20 })
    .withMessage('Discount code must be between 3 and 20 characters')
];
