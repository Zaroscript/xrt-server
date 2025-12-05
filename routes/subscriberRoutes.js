import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import {
  getAllSubscribers,
  getSubscriber,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  toggleSubscriberStatus,
  getMySubscriberProfile,
  getMyPlanHistory,
  updateMyPreferences,
  approveSubscription,
  rejectSubscription,
  recordPayment,
  syncClientsToSubscribers,
  getSubscriberStats,
  getSubscriberGrowth,
  getPlanDistribution,
  clearPlanHistory,
} from "../controllers/subscriberController.js";

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Subscriber routes
router.get("/me", getMySubscriberProfile);
router.get("/me/history", getMyPlanHistory);
router.patch("/me/preferences", updateMyPreferences);

// Admin routes
router.use(restrictTo("super_admin", "moderator"));

// Sync clients with current plans to subscribers
router.post("/sync", syncClientsToSubscribers);

// Subscriber statistics and analytics
router.get("/stats", getSubscriberStats);
router.get("/growth", getSubscriberGrowth);
router.get("/plan-distribution", getPlanDistribution);

// Subscription management routes - Only super admins can approve/reject
router.post(
  "/:subscriberId/approve",
  restrictTo("super_admin"),
  approveSubscription
);
router.post(
  "/:subscriberId/reject",
  restrictTo("super_admin"),
  rejectSubscription
);
router.post("/:subscriberId/payments", recordPayment);
router.delete("/:id/history", clearPlanHistory);

router.route("/").get(getAllSubscribers).post(createSubscriber);

router
  .route("/:id")
  .get(getSubscriber)
  .patch(updateSubscriber)
  .delete(deleteSubscriber);

router.patch("/:id/toggle-status", toggleSubscriberStatus);

export default router;
