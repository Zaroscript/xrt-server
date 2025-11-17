import express from 'express';
import { submitContactForm, validateContactForm } from '../controllers/contactController.js';

const router = express.Router();

/**
 * @route   POST /api/contact
 * @desc    Submit contact form
 * @access  Public
 */
router.post('/', validateContactForm, submitContactForm);

export default router;
