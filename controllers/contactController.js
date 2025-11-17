import { sendEmail } from '../utils/emailService.js';
import { validationResult, body } from 'express-validator';

/**
 * Handle contact form submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const submitContactForm = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { 
      name, 
      email, 
      phone, 
      businessName, 
      website, 
      message, 
      service 
    } = req.body;

    // Send email
    const emailResult = await sendEmail({
      to: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER,
      subject: `New Contact Form Submission from ${name}`,
      text: `
        New Contact Form Submission
        --------------------------
        Name: ${name}
        Email: ${email}
        Phone: ${phone || 'Not provided'}
        Business Name: ${businessName || 'Not provided'}
        Website: ${website || 'Not provided'}
        Service: ${service || 'Not specified'}
        
        Message:
        ${message || 'No message provided'}
      `,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Business Name:</strong> ${businessName || 'Not provided'}</p>
        <p><strong>Website:</strong> ${website || 'Not provided'}</p>
        <p><strong>Service:</strong> ${service || 'Not specified'}</p>
        <p><strong>Message:</strong></p>
        <p>${message || 'No message provided'}</p>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
      emailId: emailResult.messageId
    });

  } catch (error) {
    console.error('Error in submitContactForm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.',
      error: error.message
    });
  }
};

// Validation rules for contact form
export const validateContactForm = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number'),
  body('message').trim().notEmpty().withMessage('Message is required')
];
