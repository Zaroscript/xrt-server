import express from 'express';
import { protect } from '../middleware/auth.js';
import { 
  getDashboardStats, 
  getRecentActivities, 
  getTicketsStats, 
  getUsersGrowth, 
  getRevenueData 
} from '../controllers/dashboardController.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Dashboard routes
router.get('/stats', getDashboardStats);
router.get('/activities', getRecentActivities);
router.get('/tickets', getTicketsStats);
router.get('/users-growth', getUsersGrowth);
router.get('/revenue', getRevenueData);

export default router;
