import express from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
} from '../controllers/invoiceController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected and require authentication
router.route('/')
  .get(protect, getInvoices)
  .post(protect, createInvoice);

router.route('/:id')
  .get(protect, getInvoiceById)
  .put(protect, updateInvoice)
  .delete(protect, restrictTo('super_admin', 'moderator'), deleteInvoice);

// Send invoice email
router.post('/:id/send', protect, sendInvoice);

export default router;
