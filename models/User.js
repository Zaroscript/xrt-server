import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  passwordChangedAt: { type: Date, select: false },
  fName: { type: String, required: true },
  lName: { type: String, required: true },
  phone: { type: String },
  businessLocation: {
    address: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String, default: 'USA' }
  },
  oldWebsite: { type: String, default: '' },
  role: {
    type: String,
    enum: ['super_admin', 'moderator', 'client', 'subscriber'],
    default: 'client',
  },
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  // Only for subscribers
  activePlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  planStartDate: { type: Date },
  planExpiryDate: { type: Date },

  refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }],
}, { timestamps: true });

// Hash password
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();
  
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  
  // Set passwordChangedAt to current time
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000; // 1 second in the past to ensure token is created after
  }
  
  next();
});

userSchema.methods.comparePassword = async function (pass) {
  return bcrypt.compare(pass, this.password);
};

// Check if password was changed after a certain timestamp
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  // False means NOT changed
  return false;
};

export default mongoose.model('User', userSchema);