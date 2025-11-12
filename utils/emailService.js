import nodemailer from 'nodemailer';

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Verify connection configuration
transporter.verify((error) => {
  if (error) {
    console.error('Error with email configuration:', error);
  } else {
    console.log('Server is ready to take our messages');
  }
});

/**
 * Send an invoice email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.invoiceNumber - Invoice number
 * @param {string} options.clientName - Client's name
 * @param {string} options.amount - Invoice amount
 * @param {string} options.dueDate - Invoice due date
 * @param {string} options.invoiceUrl - URL to view the invoice
 * @returns {Promise} - Promise that resolves when email is sent
 */
const sendInvoiceEmail = async ({
  to,
  subject = 'Your Invoice is Ready',
  invoiceNumber,
  clientName,
  amount,
  dueDate,
  invoiceUrl,
}) => {
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Invoice #${invoiceNumber}</h2>
        <p>Hello ${clientName},</p>
        <p>Your invoice is ready for payment. Here are the details:</p>
        
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
          <p><strong>Amount Due:</strong> ${amount}</p>
          <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
        </div>
        
        <p>You can view and pay your invoice by clicking the button below:</p>
        
        <a href="${invoiceUrl}" 
           style="display: inline-block; padding: 10px 20px; background: #4CAF50; color: white; 
                  text-decoration: none; border-radius: 5px; margin: 20px 0;">
          View & Pay Invoice
        </a>
        
        <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
        
        <p>Best regards,<br>${process.env.COMPANY_NAME || 'Your Company'}</p>
      </div>
    `;

    const text = `
      Invoice #${invoiceNumber}
      
      Hello ${clientName},
      
      Your invoice is ready for payment. Here are the details:
      
      Invoice #: ${invoiceNumber}
      Amount Due: ${amount}
      Due Date: ${new Date(dueDate).toLocaleDateString()}
      
      You can view and pay your invoice at: ${invoiceUrl}
      
      If you have any questions about this invoice, please don't hesitate to contact us.
      
      Best regards,
      ${process.env.COMPANY_NAME || 'Your Company'}
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Invoice System'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export { sendInvoiceEmail };
