import mongoose from 'mongoose';

const planRequestSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  message: { type: String }, // Customization message from client
  adminNote: { type: String },
  requestedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('PlanRequest', planRequestSchema);