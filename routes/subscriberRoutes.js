import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  getAllSubscribers,
  getSubscriber,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  toggleSubscriberStatus,
  getMySubscriberProfile,
  getMySubscriptionHistory,
  updateMyPreferences
} from '../controllers/subscriberController.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Subscriber routes
router.get('/me', getMySubscriberProfile);
router.get('/me/history', getMySubscriptionHistory);
router.patch('/me/preferences', updateMyPreferences);

// Admin routes
router.use(restrictTo('admin', 'super_admin'));

router
  .route('/')
  .get(getAllSubscribers)
  .post(createSubscriber);

router
  .route('/:id')
  .get(getSubscriber)
  .patch(updateSubscriber)
  .delete(deleteSubscriber);

router.patch('/:id/toggle-status', toggleSubscriberStatus);

export default router;
