import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required"],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    type: {
      type: String,
      enum: ["service", "plan_change"],
      required: [true, "Request type is required"],
      index: true,
    },
    requestedItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Requested item is required"],
      refPath: "itemModel",
    },
    itemModel: {
      type: String,
      required: true,
      enum: ["Service", "Plan"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ client: 1, status: 1 });
requestSchema.index({ type: 1, status: 1 });

// Pre-save middleware to set itemModel based on type
requestSchema.pre("save", function (next) {
  if (this.type === "service") {
    this.itemModel = "Service";
  } else if (this.type === "plan_change") {
    this.itemModel = "Plan";
  }
  next();
});

// Method to check if request can be cancelled
requestSchema.methods.canBeCancelled = function () {
  return this.status === "pending";
};

// Method to check if request can be processed
requestSchema.methods.canBeProcessed = function () {
  return this.status === "pending";
};

// Virtual field for plan (maps to requestedItem when type is 'plan_change')
requestSchema.virtual("plan").get(function () {
  if (this.type === "plan_change") {
    return this.requestedItem;
  }
  return undefined;
});

// Virtual field for service (maps to requestedItem when type is 'service')
requestSchema.virtual("service").get(function () {
  if (this.type === "service") {
    return this.requestedItem;
  }
  return undefined;
});

const Request = mongoose.model("Request", requestSchema);

export default Request;
