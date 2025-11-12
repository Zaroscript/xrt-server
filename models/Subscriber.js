import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
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
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending'
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  lastPaymentDate: Date,
  nextBillingDate: Date,
  paymentMethod: String,
  transactionId: String,
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  features: [{
    type: String
  }],
  customPrice: Number,
  notes: String
}, { timestamps: true });

const subscriberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  subscription: subscriptionSchema,
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  subscriptionHistory: [subscriptionSchema],
  paymentHistory: [{
    amount: Number,
    date: Date,
    transactionId: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: String,
    invoiceUrl: String
  }],
  billingInfo: {
    companyName: String,
    taxId: String,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    contactPerson: {
      name: String,
      email: String,
      phone: String
    }
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    invoiceEmails: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    }
  }
}, { timestamps: true });

// Indexes
subscriberSchema.index({ user: 1 });
subscriberSchema.index({ 'subscription.status': 1 });
subscriberSchema.index({ 'subscription.endDate': 1 });

// Virtual for checking if subscription is active
subscriberSchema.virtual('isSubscriptionActive').get(function() {
  return this.subscription && 
         this.subscription.status === 'active' && 
         new Date(this.subscription.endDate) > new Date();
});

// Method to update subscription status
subscriberSchema.methods.updateSubscriptionStatus = function() {
  if (this.subscription) {
    const now = new Date();
    if (new Date(this.subscription.endDate) < now) {
      this.subscription.status = 'expired';
    } else if (this.subscription.status === 'pending' && new Date(this.subscription.startDate) <= now) {
      this.subscription.status = 'active';
    }
  }
  return this.save();
};

// Method to renew subscription
subscriberSchema.methods.renewSubscription = async function(plan, paymentInfo = {}) {
  const subscription = {
    plan: plan._id,
    startDate: new Date(),
    endDate: plan.billingCycle === 'yearly' 
      ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      : new Date(new Date().setMonth(new Date().getMonth() + 1)),
    status: 'active',
    billingCycle: plan.billingCycle,
    price: plan.price,
    features: plan.features,
    ...paymentInfo
  };

  // Add current subscription to history if it exists
  if (this.subscription) {
    this.subscriptionHistory.push({
      ...this.subscription.toObject(),
      endDate: new Date()
    });
  }

  this.subscription = subscription;
  this.isActive = true;
  this.status = 'active';
  
  return this.save();
};

const Subscriber = mongoose.model('Subscriber', subscriberSchema);

export default Subscriber;
