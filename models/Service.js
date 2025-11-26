import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  features: [String],
  process: [String],
  basePrice: { type: Number },
  isActive: { type: Boolean, default: true },
  discount: {
    amount: { type: Number, default: 0, min: 0, max: 100 }, // Percentage (0-100)
    isActive: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    code: { type: String, sparse: true, trim: true, uppercase: true }
  },
  discountedPrice: { 
    type: Number,
    default: function() {
      if (this.discount?.isActive && this.discount.amount > 0) {
        return this.basePrice * (1 - this.discount.amount / 100);
      }
      return this.basePrice;
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add a pre-save hook to ensure discountedPrice is always up to date
serviceSchema.pre('save', function(next) {
  if (this.discount?.isActive && this.discount.amount > 0) {
    this.discountedPrice = this.basePrice * (1 - this.discount.amount / 100);
  } else {
    this.discountedPrice = this.basePrice;
  }
  next();
});

// Add a method to check if discount is currently active
serviceSchema.methods.isDiscountActive = function() {
  if (!this.discount?.isActive || this.discount.amount <= 0) {
    return false;
  }
  const now = new Date();
  return (!this.discount.startDate || now >= this.discount.startDate) &&
         (!this.discount.endDate || now <= this.discount.endDate);
};

// Add a virtual for the current price (considers active discount)
serviceSchema.virtual('currentPrice').get(function() {
  return this.isDiscountActive() ? this.discountedPrice : this.basePrice;
});

export default mongoose.model('Service', serviceSchema);