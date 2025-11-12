import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import { 
  getAllServices,
  getService,
  getServicesByCategory,
  requestService
} from '../controllers/serviceController.js';
import { validateServiceRequest } from '../middleware/validation/serviceValidation.js';

const router = express.Router();

// Public routes
router.get('/', getAllServices);
router.get('/category/:category', getServicesByCategory);
router.get('/:id', getService);

// Protected routes (require authentication)
router.use(protect);

// Client routes
router.post(
  '/request/:serviceId', 
  restrictTo('client'), 
  validateServiceRequest, 
  requestService
);

export default router;