import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  customPrice: {
    type: Number,
    required: false
  },
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    required: false
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'suspended', 'expired', 'pending'],
    default: 'pending',
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  nextBillingDate: {
    type: Date,
    required: true
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'annually'],
    required: true
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'bank_transfer', 'paypal', 'other'],
    required: true
  },
  lastPayment: {
    amount: Number,
    date: Date,
    transactionId: String
  },
  paymentHistory: [{
    amount: Number,
    date: {
      type: Date,
      default: Date.now
    },
    transactionId: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    }
  }],
  suspensionReason: String,
  cancellationReason: String,
  metadata: {}
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
subscriptionSchema.index({ client: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });

// Static method to find active subscriptions
subscriptionSchema.statics.findActive = function() {
  return this.find({ 
    status: 'active',
    endDate: { $gt: new Date() }
  });
};

// Instance method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && this.endDate > new Date();
};

// Instance method to cancel subscription
subscriptionSchema.methods.cancel = function(reason) {
  this.status = 'canceled';
  this.cancellationReason = reason;
  this.autoRenew = false;
  return this.save();
};

// Instance method to suspend subscription
subscriptionSchema.methods.suspend = function(reason) {
  this.status = 'suspended';
  this.suspensionReason = reason;
  return this.save();
};

// Instance method to renew subscription
subscriptionSchema.methods.renew = function(period) {
  const now = new Date();
  const renewalPeriod = period || this.billingCycle;
  
  // Calculate new end date based on billing cycle
  const newEndDate = new Date(this.endDate);
  
  switch(renewalPeriod) {
    case 'monthly':
      newEndDate.setMonth(newEndDate.getMonth() + 1);
      break;
    case 'quarterly':
      newEndDate.setMonth(newEndDate.getMonth() + 3);
      break;
    case 'annually':
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
      break;
  }
  
  this.endDate = newEndDate;
  this.status = 'active';
  this.nextBillingDate = newEndDate;
  
  return this.save();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
