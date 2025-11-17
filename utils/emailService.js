import nodemailer from 'nodemailer';
import { config } from 'dotenv';

// Load environment variables
config();

// Create a transporter object
const transporter = nodemailer.createTransport({
  service: 'gmail',  // Default to Gmail for simplicity
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || process.env.SMTP_USER,
    pass: process.env.EMAIL_PASS || process.env.SMTP_PASSWORD,
  },
});

/**
 * Send a generic email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - HTML body (optional)
 * @returns {Promise<Object>} - Result of the email sending operation
 */
const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'XRT-Tech'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('Message sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send a verification email
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @returns {Promise<Object>}
 */
const sendVerificationEmail = async (email, token) => {
  const url = `${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const subject = 'Verify Your XRT Tech Account';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Verify Your Email Address</h2>
      <p>Thank you for signing up with XRT-Tech! Please verify your email address by clicking the button below:</p>
      <a href="${url}" 
         style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
        Verify Email
      </a>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>Best regards,<br>The XRT-Tech Team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    text: `Please verify your email by visiting: ${url}`
  });
};

/**
 * Send a password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @returns {Promise<Object>}
 */
const sendPasswordResetEmail = async (email, token) => {
  const url = `${process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  const subject = 'Reset Your Password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password. Click the button below to set a new password:</p>
      <a href="${url}" 
         style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
        Reset Password
      </a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>The XRT-Tech Team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    text: `Reset your password by visiting: ${url}\n\nThis link will expire in 1 hour.`
  });
};

/**
 * Send an invoice email
 * @param {Object} options - Invoice email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.invoiceNumber - Invoice number
 * @param {string} options.amount - Invoice amount
 * @param {string} options.dueDate - Invoice due date
 * @param {string} options.clientName - Client's name
 * @returns {Promise<Object>} - Result of the email sending operation
 */
const sendInvoiceEmail = async ({ 
  to, 
  invoiceNumber, 
  amount, 
  dueDate, 
  clientName 
}) => {
  const subject = `Invoice #${invoiceNumber} from XRT-Tech`;
  const text = `
    Dear ${clientName},
    
    Please find attached your invoice #${invoiceNumber} for ${amount}.
    
    Due Date: ${new Date(dueDate).toLocaleDateString()}
    
    Thank you for your business!
    
    Best regards,
    The XRT-Tech Team
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Invoice #${invoiceNumber}</h2>
      <p>Dear ${clientName},</p>
      <p>Please find attached your invoice #${invoiceNumber} for <strong>${amount}</strong>.</p>
      <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
      <p>You can view and pay your invoice by clicking the button below:</p>
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/invoices/${invoiceNumber}" 
         style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
        View & Pay Invoice
      </a>
      <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
      <p>Thank you for your business!</p>
      <p>Best regards,<br>The XRT-Tech Team</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

/**
 * Send a test email
 * @returns {Promise<Object>}
 */
const sendTestEmail = async () => {
  const to = process.env.EMAIL_USER || process.env.SMTP_USER;
  if (!to) {
    throw new Error('No email recipient specified for test email');
  }

  return sendEmail({
    to,
    subject: 'Nodemailer Test',
    text: 'If you see this, email is working!',
    html: '<p>If you see this, email is working!</p>'
  });
};

const sendRejectionEmail = async (email, userName, reason = '') => {
  const subject = 'Your Account Application Status - Not Approved';
  const text = `Dear ${userName},\n\n` +
    'We regret to inform you that your account application has been reviewed and was not approved at this time.\n\n' +
    (reason ? `Reason: ${reason}\n\n` : '') +
    'If you believe this is a mistake or would like more information, please contact our support team.\n\n' +
    'Best regards,\n' +
    'The XRT Tech Team';

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d3748;">Account Application Status</h2>
      <p>Dear ${userName},</p>
      <p>We regret to inform you that your account application has been reviewed and was not approved at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>If you believe this is a mistake or would like more information, please contact our support team.</p>
      <p>Best regards,<br>The XRT Tech Team</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 12px; color: #718096;">
        This is an automated message, please do not reply directly to this email.
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html
  });
};

export {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInvoiceEmail,
  sendTestEmail,
  sendRejectionEmail
};

