import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    price: { type: Number, required: true },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    features: [String],
    maxRestaurants: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    discount: {
      amount: { type: Number, default: 0, min: 0, max: 100 }, // Percentage (0-100)
      isActive: { type: Boolean, default: false },
      startDate: { type: Date },
      endDate: { type: Date },
      code: { type: String, sparse: true, trim: true, uppercase: true },
    },
    discountedPrice: {
      type: Number,
      default: function () {
        if (this.discount?.isActive && this.discount.amount > 0) {
          return this.price * (1 - this.discount.amount / 100);
        }
        return this.price;
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add a pre-save hook to ensure discountedPrice is always up to date
planSchema.pre("save", function (next) {
  if (this.discount?.isActive && this.discount.amount > 0) {
    this.discountedPrice = this.price * (1 - this.discount.amount / 100);
  } else {
    this.discountedPrice = this.price;
  }
  next();
});

// Add a method to check if discount is currently active
planSchema.methods.isDiscountActive = function () {
  if (!this.discount?.isActive || this.discount.amount <= 0) {
    return false;
  }
  const now = new Date();
  return (
    (!this.discount.startDate || now >= this.discount.startDate) &&
    (!this.discount.endDate || now <= this.discount.endDate)
  );
};

// Add a virtual for the current price (considers active discount)
planSchema.virtual("currentPrice").get(function () {
  return this.isDiscountActive() ? this.discountedPrice : this.price;
});

export default mongoose.model("Plan", planSchema);
