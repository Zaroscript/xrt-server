import express from 'express';
import {
  createClient,
  getAllClients,
  getClient,
  updateClient,
  deleteClient,
  getClientByUser,
  toggleClientStatus,
  approveClient
} from '../controllers/clientController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Admin only routes - allow super_admin and moderator
router.use(restrictTo('super_admin', 'moderator'));
router
  .route('/')
  .get(getAllClients)
  .post(createClient);

router
  .route('/:id')
  .get(getClient)
  .patch(updateClient)
  .delete(deleteClient);

router
  .route('/:id/toggle-status')
  .patch(toggleClientStatus);

router
  .route('/:id/approve')
  .patch(approveClient);

// Client access to their own data
router.get('/user/me', getClientByUser);

export default router;
