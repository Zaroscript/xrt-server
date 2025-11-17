import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  paymentMethod: {
    type: String,
    required: true
  },
  paymentIntentId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'refunded', 'disputed'],
    default: 'pending'
  },
  description: String,
  billingPeriod: {
    start: Date,
    end: Date
  },
  metadata: {
    type: Map,
    of: String
  },
  receiptUrl: String,
  invoiceId: {
    type: String,
    unique: true,
    sparse: true
  },
  refundedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundReason: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
transactionSchema.index({ client: 1, status: 1 });
transactionSchema.index({ plan: 1 });
transactionSchema.index({ paymentIntentId: 1 }, { unique: true });
transactionSchema.index({ createdAt: -1 });

// Virtual for net amount after refunds
transactionSchema.virtual('netAmount').get(function() {
  return this.amount - (this.refundedAmount || 0);
});

// Virtual for transaction age in days
transactionSchema.virtual('ageInDays').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Pre-save hook to generate invoice ID if not provided
transactionSchema.pre('save', function(next) {
  if (this.isNew && !this.invoiceId) {
    // Generate a unique invoice ID (you might want to customize this)
    const prefix = 'INV';
    const random = Math.floor(10000 + Math.random() * 90000);
    const timestamp = Date.now().toString().slice(-6);
    this.invoiceId = `${prefix}${timestamp}${random}`;
  }
  next();
});

// Method to check if transaction is refundable
transactionSchema.methods.isRefundable = function() {
  return this.status === 'succeeded' && 
         (this.refundedAmount === undefined || this.refundedAmount < this.amount);
};

// Method to get the maximum refundable amount
transactionSchema.methods.getMaxRefundableAmount = function() {
  if (this.status !== 'succeeded') return 0;
  return this.amount - (this.refundedAmount || 0);
};

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
