import Invoice from '../models/Invoice.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { sendInvoiceEmail } from '../utils/emailService.js';

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res, next) => {
  try {
    const { status, client, startDate, endDate } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (client) {
      query.client = client;
    }
    
    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }
    
    const invoices = await Invoice.find(query)
      .populate('client', 'companyName email')
      .populate('user', 'fName lName email')
      .sort('-createdAt');
      
    res.json(invoices);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'companyName email phone address')
      .populate('user', 'fName lName email phone');
      
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }
    
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
const createInvoice = async (req, res, next) => {
  try {
    const { client, items, dueDate, notes, terms } = req.body;
    
    if (!client || !items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Client and at least one invoice item are required');
    }
    
    const invoice = new Invoice({
      ...req.body,
      user: req.user.id,
    });
    
    await invoice.save();
    
    // Populate the client and user data before sending the response
    await invoice.populate('client', 'companyName email');
    await invoice.populate('user', 'fName lName email');
    
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
};

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private
const updateInvoice = async (req, res, next) => {
  try {
    const { status, paid, ...updateData } = req.body;
    
    // If updating status to paid, set paidAt
    if (status === 'paid') {
      updateData.paidAt = Date.now();
    }
    
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { ...updateData, status },
      { new: true, runValidators: true }
    )
      .populate('client', 'companyName email')
      .populate('user', 'fName lName email');
      
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }
    
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private/Admin
const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }
    
    res.json({ message: 'Invoice removed' });
  } catch (error) {
    next(error);
  }
};

// @desc    Send invoice via email
// @route   POST /api/invoices/:id/send
// @access  Private
const sendInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'email companyName')
      .populate('user', 'email fName lName');

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Check if user is authorized to send this invoice
    if (req.user.role !== 'admin' && invoice.user._id.toString() !== req.user.id) {
      throw new ForbiddenError('Not authorized to send this invoice');
    }

    // Update invoice status and sent date
    invoice.status = 'sent';
    invoice.sentAt = new Date();
    await invoice.save();

    // Generate invoice URL (adjust this to your frontend URL)
    const invoiceUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invoices/${invoice._id}`;
    
    try {
      // Send email to client
      await sendInvoiceEmail({
        to: invoice.client.email,
        subject: `Invoice #${invoice.invoiceNumber} from ${invoice.user.companyName || 'Your Company'}`,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client.companyName || 'Valued Client',
        amount: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: invoice.currency || 'USD',
        }).format(invoice.total || 0),
        dueDate: invoice.dueDate,
        invoiceUrl,
      });

      // Send success response
      res.status(200).json({
        success: true,
        message: 'Invoice sent successfully',
        data: invoice
      });
    } catch (emailError) {
      console.error('Error sending invoice email:', emailError);
      // Still return success since the invoice was updated, but log the email error
      res.status(200).json({
        success: true,
        message: 'Invoice marked as sent, but there was an error sending the email',
        data: invoice,
        warning: 'Email sending failed'
      });
    }
  } catch (error) {
    next(error);
  }
};

export {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
};
