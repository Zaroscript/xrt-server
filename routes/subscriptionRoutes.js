import express from 'express';
import {
  subscribeToPlan,
  getMyPlan,
  updateMyPlan,
  cancelMyPlan,
  getUpcomingRenewals,
  suspendSubscription,
  adminSubscribeClient,
  updateSubscription
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
router.patch('/subscriptions/:id/suspend', restrictTo('admin', 'super_admin'), suspendSubscription);
router.post('/subscriptions/admin/subscribe', restrictTo('admin', 'super_admin'), adminSubscribeClient);
router.patch('/subscriptions/:id', restrictTo('admin', 'super_admin'), updateSubscription);

export default router;
