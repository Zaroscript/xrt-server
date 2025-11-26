import express from "express";
import {
  createClient,
  getAllClients,
  getClient,
  updateClient,
  deleteClient,
  getClientByUser,
  toggleClientStatus,
  approveClient,
  getClientActivities,
  assignServiceToClient,
  removeServiceFromClient,
  getMyClientProfile,
  updateMyClientProfile,
  requestSubscriptionChange,
  requestNewService,
} from "../controllers/clientController.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Client self-service routes (before admin middleware)
router.get("/me", getMyClientProfile);
router.patch("/me", restrictTo("client", "subscriber"), updateMyClientProfile);
router.post(
  "/subscription-change-request",
  restrictTo("client", "subscriber"),
  requestSubscriptionChange
);
router.post(
  "/service-request",
  restrictTo("client", "subscriber"),
  requestNewService
);

// Regular authenticated user routes (no admin restriction)
router.route("/:id").get(getClient);

// Admin only routes - allow super_admin and moderator
router.use(restrictTo("super_admin", "moderator"));
router.route("/").get(getAllClients).post(createClient);

router.route("/:id").patch(updateClient).delete(deleteClient);

router.route("/:id/toggle-status").patch(toggleClientStatus);

router.route("/:id/approve").patch(approveClient);

// Client access to their own data
router.get("/user/me", getClientByUser);

// Admin access to client by user ID
router.get(
  "/user/:userId",
  restrictTo("super_admin", "moderator"),
  getClientByUser
);

// Get client activities
router.get("/:id/activities", getClientActivities);

// Service assignment routes
router.route("/:id/services").post(assignServiceToClient);

router.route("/:id/services/:serviceId").delete(removeServiceFromClient);

export default router;
