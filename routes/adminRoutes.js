import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  approveUser,
  rejectUser,
  getPendingUsers,
  getPendingServiceRequests,
  respondToServiceRequest,
  getPendingPlanRequests,
  respondToPlanRequest,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  convertToSubscriber,
  updateSubscription,
  getMonthlyRevenue,
  getTicketsStats,
  getUsersGrowth,
} from '../controllers/adminController.js';
import {
  validateCreatePlan,
  validateUpdatePlan,
  validatePlanId
} from '../middleware/validation/planValidation.js';

const router = express.Router();

// Admin Routes
router.use(protect);
router.use(restrictTo('super_admin', 'moderator'));

// Dashboard Data
router.get('/dashboard/monthly-revenue', getMonthlyRevenue);
router.get('/dashboard/tickets-stats', getTicketsStats);
router.get('/dashboard/users-growth', getUsersGrowth);

// Users
router.get('/users/pending', getPendingUsers);
router.patch('/users/approve/:id', approveUser);
router.delete('/users/reject/:id', rejectUser);

// Service Requests
router.get('/requests/services/pending', getPendingServiceRequests);
router.patch('/requests/services/:id', respondToServiceRequest);

// Plan Requests
router.get('/requests/plans/pending', getPendingPlanRequests);
router.patch('/requests/plans/:id', respondToPlanRequest);

// Services CRUD
import {
  validateCreateService,
  validateUpdateService,
  validateServiceId
} from '../middleware/validation/serviceValidation.js';

router.post('/services', validateCreateService, createService);
router
  .route('/services/:id')
  .patch(validateServiceId, validateUpdateService, updateService)
  .delete(validateServiceId, deleteService);
router.patch('/services/:id/toggle-status', validateServiceId, toggleServiceStatus);

// Plans CRUD
router.post('/plans', validateCreatePlan, createPlan);
router
  .route('/plans/:id')
  .patch(validatePlanId, validateUpdatePlan, updatePlan)
  .delete(validatePlanId, deletePlan);
router.patch('/plans/:id/toggle-status', validatePlanId, togglePlanStatus);

// Subscription Management
router.post('/convert-to-subscriber', convertToSubscriber);
router.patch('/subscription/:userId', updateSubscription);

export default router;