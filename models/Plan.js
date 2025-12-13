import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    monthlyPrice: {
      type: Number,
      default: null,
      min: [0, "Monthly price cannot be negative"],
    },
    yearlyPrice: {
      type: Number,
      default: null,
      min: [0, "Yearly price cannot be negative"],
    },
    duration: {
      type: Number,
      required: [true, "Duration is required"],
      enum: {
        values: [1, 12],
        message: "Duration must be 1 (monthly) or 12 (yearly)",
      },
      default: 1,
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isCustom: {
      type: Boolean,
      default: false,
    },
    badge: {
      text: {
        type: String,
        trim: true,
        default: null,
      },
      variant: {
        type: String,
        enum: [
          "default",
          "secondary",
          "destructive",
          "outline",
          "success",
          "warning",
          "info",
          "premium",
          "new",
          "limited",
        ],
        default: "default",
      },
    },
    discount: {
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        default: "percentage",
      },
      value: {
        type: Number,
        default: 0,
        min: [0, "Discount cannot be negative"],
        max: [100, "Discount cannot exceed 100%"],
      },
      isActive: {
        type: Boolean,
        default: false,
      },
      startDate: {
        type: Date,
        validate: {
          validator: function (value) {
            if (!this.discount?.isActive) return true;
            if (!value) return true;
            return value <= new Date();
          },
          message: "Start date cannot be in the future",
        },
      },
      endDate: {
        type: Date,
        validate: {
          validator: function (value) {
            if (!this.discount?.isActive) return true;
            if (!value) return true;
            return value >= new Date();
          },
          message: "End date cannot be in the past",
        },
      },
      code: {
        type: String,
        sparse: true,
        trim: true,
        uppercase: true,
        validate: {
          validator: function (value) {
            if (!this.discount?.isActive) return true;
            return /^[A-Z0-9]+$/.test(value);
          },
          message:
            "Discount code can only contain uppercase letters and numbers",
        },
      },
    },
    // Virtual for getting the calculated monthly price
    calculatedMonthlyPrice: {
      type: Number,
      get: function () {
        // If manual monthly price is set, use it
        if (this.monthlyPrice !== null && this.monthlyPrice !== undefined) {
          return this.monthlyPrice;
        }
        // Otherwise calculate from yearly price or base price
        return this.duration === 12 ? this.price / 12 : this.price;
      },
    },
    // Virtual for getting the calculated yearly price
    calculatedYearlyPrice: {
      type: Number,
      get: function () {
        // If manual yearly price is set, use it
        if (this.yearlyPrice !== null && this.yearlyPrice !== undefined) {
          return this.yearlyPrice;
        }
        // If manual monthly price is set, calculate yearly from it
        if (this.monthlyPrice !== null && this.monthlyPrice !== undefined) {
          return this.monthlyPrice * 12;
        }
        // Otherwise calculate from base price
        return this.duration === 1 ? this.price * 12 : this.price;
      },
    },
    // Virtual for billing cycle string
    billingCycle: {
      type: String,
      get: function () {
        return this.duration === 12 ? "yearly" : "monthly";
      },
    },
    // Virtual for discounted price (applies discount to base price)
    discountedPrice: {
      type: Number,
      get: function () {
        if (!this.discount?.isActive || !this.discount?.value) {
          return this.price;
        }

        if (this.discount.type === "fixed") {
          return Math.max(0, this.price - this.discount.value);
        } else {
          return Math.max(0, this.price * (1 - this.discount.value / 100));
        }
      },
    },
    // Virtual for discounted monthly price
    discountedMonthlyPrice: {
      type: Number,
      get: function () {
        if (!this.discount?.isActive || !this.discount?.value) {
          return this.calculatedMonthlyPrice;
        }

        const monthlyPrice = this.calculatedMonthlyPrice;
        if (this.discount.type === "fixed") {
          return Math.max(0, monthlyPrice - this.discount.value / 12);
        } else {
          return Math.max(0, monthlyPrice * (1 - this.discount.value / 100));
        }
      },
    },
    // Virtual for discounted yearly price
    discountedYearlyPrice: {
      type: Number,
      get: function () {
        if (!this.discount?.isActive || !this.discount?.value) {
          return this.calculatedYearlyPrice;
        }

        const yearlyPrice = this.calculatedYearlyPrice;
        if (this.discount.type === "fixed") {
          return Math.max(0, yearlyPrice - this.discount.value);
        } else {
          return Math.max(0, yearlyPrice * (1 - this.discount.value / 100));
        }
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add a pre-save hook to ensure data consistency
planSchema.pre("save", function (next) {
  // Update virtuals
  this.markModified("price");
  this.markModified("duration");

  next();
});

// Add a method to check if discount is currently active
planSchema.methods.isDiscountActive = function () {
  if (!this.discount?.isActive || this.discount.value <= 0) {
    return false;
  }

  const now = new Date();
  const isWithinDateRange =
    (!this.discount.startDate || now >= this.discount.startDate) &&
    (!this.discount.endDate || now <= this.discount.endDate);

  return isWithinDateRange;
};

// Add a method to get the price for a specific duration
planSchema.methods.getPrice = function (duration = this.duration) {
  const basePrice = duration === 12 ? this.price : this.price;
  return this.isDiscountActive()
    ? basePrice * (1 - this.discount.value / 100)
    : basePrice;
};

// Add a virtual for the savings percentage when choosing yearly billing
planSchema.virtual("yearlySavings").get(function () {
  if (this.duration === 1) return 0; // Already monthly
  const monthlyEquivalent = this.price / 12;
  const yearlyMonthlyPrice = this.price;
  if (yearlyMonthlyPrice >= monthlyEquivalent) return 0;
  return Math.round((1 - yearlyMonthlyPrice / monthlyEquivalent) * 100);
});

export default mongoose.model("Plan", planSchema);
