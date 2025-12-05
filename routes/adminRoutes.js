import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import {
  approveUser,
  rejectUser,
  getPendingUsers,
  getRemovedUsers,
  updateUserStatus,
  softDeleteUser,
  deleteUserPermanently,
  getPendingServiceRequests,
  respondToServiceRequest,
  getPendingPlanRequests,
  respondToPlanRequest,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  getAllPlansForAdmin,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  assignPlan,
  updatePlan as updateUserPlan,
  getMonthlyRevenue,
  getTicketsStats,
  getUsersGrowth,
  getModerators,
  createModerator,
  updateModerator,
  deleteModerator,
} from "../controllers/adminController.js";
import {
  getClientFullDetails,
  getClientActivityLogs,
  assignSubscriptionToClient,
  renewClientSubscription,
  cancelClientSubscription,
  assignServiceToClient,
  updateClientService,
  removeClientService,
  resetClientPassword,
} from "../controllers/clientManagementController.js";
import {
  validateCreatePlan,
  validateUpdatePlan,
  validatePlanId,
} from "../middleware/validation/planValidation.js";
import {
  getCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo,
  deleteCompanyLogo,
} from "../controllers/companySettingsController.js";
import { uploadLogo } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Admin Routes
router.use(protect);
router.use(restrictTo("super_admin", "moderator"));

// Dashboard Data (Read-only for both)
router.get("/dashboard/monthly-revenue", getMonthlyRevenue);
router.get("/dashboard/tickets-stats", getTicketsStats);
router.get("/dashboard/users-growth", getUsersGrowth);

// Users
router.get("/users/pending", getPendingUsers);
router.get("/users/removed", getRemovedUsers);
router.patch("/users/approve/:id", restrictTo("super_admin"), approveUser);
router.delete("/users/reject/:id", restrictTo("super_admin"), rejectUser);
router.patch("/users/status/:id", restrictTo("super_admin"), updateUserStatus);
router.patch(
  "/users/soft-delete/:id",
  restrictTo("super_admin"),
  softDeleteUser
);
router.delete(
  "/users/permanent/:id",
  restrictTo("super_admin"),
  deleteUserPermanently
);

// Moderators
router.get("/users/moderators", getModerators);
router.post("/users/moderator", restrictTo("super_admin"), createModerator);
router.patch(
  "/users/moderator/:id",
  restrictTo("super_admin"),
  updateModerator
);
router.delete(
  "/users/moderator/:id",
  restrictTo("super_admin"),
  deleteModerator
);

// Service Requests
router.get("/requests/services/pending", getPendingServiceRequests);
router.patch(
  "/requests/services/:id",
  restrictTo("super_admin"),
  respondToServiceRequest
);

// Plan Requests
router.get("/requests/plans/pending", getPendingPlanRequests);
router.patch(
  "/requests/plans/:id",
  restrictTo("super_admin"),
  respondToPlanRequest
);

// Services CRUD
import {
  validateCreateService,
  validateUpdateService,
  validateServiceId,
} from "../middleware/validation/serviceValidation.js";

router.post(
  "/services",
  restrictTo("super_admin"),
  validateCreateService,
  createService
);
router
  .route("/services/:id")
  .patch(
    restrictTo("super_admin"),
    validateServiceId,
    validateUpdateService,
    updateService
  )
  .delete(restrictTo("super_admin"), validateServiceId, deleteService);
router.patch(
  "/services/:id/toggle-status",
  restrictTo("super_admin"),
  validateServiceId,
  toggleServiceStatus
);

// Plans CRUD
router.get("/plans", getAllPlansForAdmin);
router.post(
  "/plans",
  restrictTo("super_admin"),
  validateCreatePlan,
  createPlan
);
router
  .route("/plans/:id")
  .patch(
    restrictTo("super_admin"),
    validatePlanId,
    validateUpdatePlan,
    updatePlan
  )
  .delete(restrictTo("super_admin"), validatePlanId, deletePlan);
router.patch(
  "/plans/:id/toggle-status",
  restrictTo("super_admin"),
  validatePlanId,
  togglePlanStatus
);

// Plan Management
router.post("/assign-plan", restrictTo("super_admin"), assignPlan);
router.patch("/plan/:userId", restrictTo("super_admin"), updateUserPlan);

// Client Management
router.get("/clients/:id/full-details", getClientFullDetails);
router.get("/clients/:id/activity-logs", getClientActivityLogs);

// Subscription Management
router.post(
  "/clients/:id/subscription/assign",
  restrictTo("super_admin"),
  assignSubscriptionToClient
);
router.patch(
  "/clients/:id/subscription/renew",
  restrictTo("super_admin"),
  renewClientSubscription
);
router.delete(
  "/clients/:id/subscription/cancel",
  restrictTo("super_admin"),
  cancelClientSubscription
);

// Service Assignment
router.post(
  "/clients/:id/services/assign",
  restrictTo("super_admin"),
  assignServiceToClient
);
router.patch(
  "/clients/:id/services/:serviceId/update",
  restrictTo("super_admin"),
  updateClientService
);
router.delete(
  "/clients/:id/services/:serviceId/remove",
  restrictTo("super_admin"),
  removeClientService
);

// Password Management
router.post(
  "/clients/:id/reset-password",
  restrictTo("super_admin", "moderator"),
  resetClientPassword
);

// Company Settings
router
  .route("/company-settings")
  .get(getCompanySettings)
  .put(restrictTo("super_admin"), updateCompanySettings);

// Company Logo
router
  .route("/company-settings/logo")
  .post(restrictTo("super_admin"), uploadLogo.single("logo"), uploadCompanyLogo)
  .delete(restrictTo("super_admin"), deleteCompanyLogo);

export default router;
