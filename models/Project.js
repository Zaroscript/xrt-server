import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  category: {
    type: String,
    trim: true,
  },
  images: [{
    type: String,
  }],
  technologies: [{
    type: String,
  }],
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
projectSchema.index({ user: 1, createdAt: -1 });
projectSchema.index({ status: 1 });
projectSchema.index({ isActive: 1, isFeatured: 1 });

export const Project = mongoose.model('Project', projectSchema);
export default Project;

