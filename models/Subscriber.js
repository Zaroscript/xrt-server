import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending_approval", "active", "expired", "cancelled", "rejected"],
      default: "pending_approval",
    },
    approvalStatus: {
      approved: { type: Boolean, default: false },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approvedAt: Date,
      notes: String,
    },
    invoice: {
      invoiceNumber: String,
      amount: Number,
      issueDate: Date,
      dueDate: Date,
      status: {
        type: String,
        enum: ["pending", "paid", "overdue", "cancelled"],
        default: "pending",
      },
      paymentDetails: {
        paymentDate: Date,
        paymentMethod: String,
        transactionId: String,
        notes: String,
      },
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "annually"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    features: [
      {
        type: String,
      },
    ],
    customPrice: Number,
    notes: String,
  },
  { timestamps: true }
);

const subscriberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    plan: planSchema,
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    planHistory: [planSchema],
    paymentHistory: [
      {
        amount: Number,
        date: Date,
        transactionId: String,
        status: {
          type: String,
          enum: ["pending", "completed", "failed", "refunded"],
          default: "pending",
        },
        paymentMethod: String,
        invoiceUrl: String,
      },
    ],
    billingInfo: {
      companyName: String,
      taxId: String,
      address: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String,
      },
      contactPerson: {
        name: String,
        email: String,
        phone: String,
      },
    },
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      invoiceEmails: {
        type: Boolean,
        default: true,
      },
      marketingEmails: {
        type: Boolean,
        default: false,
      },
    },
    notes: String,
  },
  { timestamps: true }
);

// Indexes
subscriberSchema.index({ user: 1 });
subscriberSchema.index({ "plan.status": 1 });
subscriberSchema.index({ "plan.endDate": 1 });

// Virtual for checking if plan is active
subscriberSchema.virtual("isPlanActive").get(function () {
  return (
    this.plan &&
    this.plan.status === "active" &&
    new Date(this.plan.endDate) > new Date()
  );
});

// Method to update plan status
subscriberSchema.methods.updatePlanStatus = function () {
  if (this.plan) {
    const now = new Date();
    if (new Date(this.plan.endDate) < now) {
      this.plan.status = "expired";
    } else if (
      this.plan.status === "pending" &&
      new Date(this.plan.startDate) <= now
    ) {
      this.plan.status = "active";
    }
  }
  return this.save();
};

// Method to renew plan
subscriberSchema.methods.renewPlan = async function (plan, paymentInfo = {}) {
  const newPlan = {
    plan: plan._id,
    startDate: new Date(),
    endDate:
      plan.billingCycle === "yearly"
        ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        : new Date(new Date().setMonth(new Date().getMonth() + 1)),
    status: "active",
    billingCycle: plan.billingCycle,
    price: plan.price,
    features: plan.features,
    ...paymentInfo,
  };

  // Add current plan to history if it exists
  if (this.plan) {
    this.planHistory.push({
      ...this.plan.toObject(),
      endDate: new Date(),
    });
  }

  this.plan = newPlan;
  this.isActive = true;
  this.status = "active";

  return this.save();
};

const Subscriber = mongoose.model("Subscriber", subscriberSchema);

export default Subscriber;
