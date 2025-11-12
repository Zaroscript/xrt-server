import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { 
  getAllPlans,
  getPlan,
  getFeaturedPlans,
  requestPlan,
  addOrUpdateDiscount,
  removeDiscount,
  getActiveDiscounts
} from '../controllers/planController.js';
import { validateDiscountData } from '../middleware/validation/discountValidation.js';

const router = express.Router();

// Public routes
router.get('/', getAllPlans);
router.get('/featured', getFeaturedPlans);
router.get('/:id', getPlan);
router.get('/discounts/active', getActiveDiscounts);

// Protected routes (require authentication)
router.use(protect);

// Client routes
router.post('/request/:planId', restrictTo('client'), requestPlan);

// Admin routes
router.use(restrictTo('admin', 'superadmin'));

// Discount management
router.post(
  '/:id/discounts',
  validateDiscountData,
  addOrUpdateDiscount
);

router.delete(
  '/:id/discounts',
  removeDiscount
);

export default router;