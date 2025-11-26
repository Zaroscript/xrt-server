import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  actionType: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'profile_update',
      'password_change',
      'subscription_created',
      'subscription_renewed',
      'subscription_cancelled',
      'subscription_updated',
      'service_assigned',
      'service_updated',
      'service_removed',
      'invoice_generated',
      'payment_made',
      'plan_changed',
      'profile_viewed',
      'data_exported',
      'admin_action',
      'other'
    ],
    index: true
  },
  description: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin who performed the action (if applicable)
  },
  relatedModel: {
    type: String,
    enum: ['Client', 'Subscription', 'Service', 'Invoice', 'Plan', 'User', null]
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

// Indexes for better query performance
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ actionType: 1, createdAt: -1 });
activityLogSchema.index({ performedBy: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

// Static method to create a log entry
activityLogSchema.statics.createLog = async function({
  user,
  actionType,
  description,
  ipAddress = null,
  userAgent = null,
  metadata = {},
  performedBy = null,
  relatedModel = null,
  relatedId = null
}) {
  return this.create({
    user,
    actionType,
    description,
    ipAddress,
    userAgent,
    metadata,
    performedBy,
    relatedModel,
    relatedId
  });
};

// Static method to get user activity logs with filters
activityLogSchema.statics.getUserLogs = function(userId, options = {}) {
  const {
    actionType = null,
    startDate = null,
    endDate = null,
    limit = 50,
    skip = 0
  } = options;

  const query = { user: userId };
  
  if (actionType) {
    query.actionType = actionType;
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('performedBy', 'fName lName email role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
