import express from 'express';
import {
  createRequest,
  getMyRequests,
  cancelRequest,
  getAllRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  updateRequest
} from '../controllers/requestController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Client routes
router.post('/', restrictTo('client'), createRequest);
router.get('/my-requests', restrictTo('client'), getMyRequests);
router.patch('/:id/cancel', restrictTo('client'), cancelRequest);

// Admin routes
router.get('/', restrictTo('super_admin', 'moderator'), getAllRequests);
router.get('/:id', restrictTo('super_admin', 'moderator'), getRequest);
router.patch('/:id/approve', restrictTo('super_admin', 'moderator'), approveRequest);
router.patch('/:id/reject', restrictTo('super_admin', 'moderator'), rejectRequest);
router.patch('/:id', restrictTo('super_admin', 'moderator'), updateRequest);

export default router;
