import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true 
  },
  companyName: { 
    type: String, 
    required: true 
  },
  businessLocation: {
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String, default: 'USA' }
  },
  oldWebsite: {
    type: String,
    match: [/^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/, 'Please use a valid URL with HTTP or HTTPS']
  },
  taxId: String,
  notes: String,
  isActive: { 
    type: Boolean, 
    default: true 
  },
  // Reference to the services they've purchased with additional details
  services: [{
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    customPrice: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      default: ''
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active'
    }
  }],
  // Reference to their current plan
  currentPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan'
  },
 
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
clientSchema.index({ companyName: 'text' });

// Virtual for client's full address
clientSchema.virtual('fullAddress').get(function() {
  return `${this.address?.street || ''}, ${this.address?.city || ''}, ${this.address?.state || ''} ${this.address?.postalCode || ''}, ${this.address?.country || ''}`.trim();
});

// Static method to find active clients
clientSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Instance method to get client summary
clientSchema.methods.getSummary = function() {
  return {
    id: this._id,
    companyName: this.companyName,
    email: this.user?.email,
    status: this.isActive ? 'Active' : 'Inactive',
    servicesCount: this.services?.length || 0
  };
};

const Client = mongoose.model('Client', clientSchema);

export default Client;
