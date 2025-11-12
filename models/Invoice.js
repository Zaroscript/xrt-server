import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  items: [{
    description: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
  }],
  subtotal: {
    type: Number,
    required: true,
  },
  tax: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft',
  },
  notes: {
    type: String,
  },
  terms: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Generate invoice number before saving
invoiceSchema.pre('save', async function(next) {
  if (this.isNew) {
    const lastInvoice = await this.constructor.findOne({}, {}, { sort: { 'createdAt' : -1 } });
    const lastNumber = lastInvoice ? parseInt(lastInvoice.invoiceNumber.replace('INV-', '')) : 0;
    this.invoiceNumber = `INV-${(lastNumber + 1).toString().padStart(5, '0')}`;
  }
  next();
});

// Calculate totals before saving
invoiceSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
  
  this.tax = this.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice * (item.taxRate / 100));
  }, 0);
  
  this.total = this.subtotal + this.tax;
  next();
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
