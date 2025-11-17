import express from 'express';
import {
  subscribeToPlan,
  getMyPlan,
  updateMyPlan,
  cancelMyPlan,
  getUpcomingRenewals
} from '../controllers/subscriptionController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Client routes
router.post('/plans/subscribe', subscribeToPlan);
router.get('/plans/my-plan', getMyPlan);
router.patch('/plans/update', updateMyPlan);
router.patch('/plans/cancel', cancelMyPlan);

// Admin routes
router.get('/plans/upcoming-renewals', restrictTo('super_admin', 'moderator'), getUpcomingRenewals);

export default router;
