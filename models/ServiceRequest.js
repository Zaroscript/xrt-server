import mongoose from 'mongoose';

const serviceRequestSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  customPrice: { type: Number }, // السعر اللي حدده الأدمن
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'modified'],
    default: 'pending',
  },
  adminNote: { type: String },
  requestedAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
}, { timestamps: true });

export default mongoose.model('ServiceRequest', serviceRequestSchema);