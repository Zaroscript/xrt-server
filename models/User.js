import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  passwordChangedAt: { type: Date, select: false },
  fName: { type: String, required: true },
  lName: { type: String, required: true },
  companyName: { 
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    minlength: [2, 'Company name must be at least 2 characters long'],
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  phone: { 
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v) {
        // Validates US phone numbers with or without country code
        // Matches:
        // (123) 456-7890
        // 123-456-7890
        // 123.456.7890
        // 1234567890
        // +1 (123) 456-7890
        // +1 123-456-7890
        // +1.123.456.7890
        // +11234567890
        return /^(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/.test(v);
      },
      message: props => `${props.value} is not a valid US phone number! Please use format: (123) 456-7890`
    },
    set: function(v) {
      // Format the phone number to a standard format: (123) 456-7890
      if (!v) return v;
      const cleaned = ('' + v).replace(/\D/g, '');
      const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        const intlCode = match[1] ? '+1 ' : '';
        return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('');
      }
      return v;
    }
  },
  oldWebsite: { type: String, default: '' },
  role: {
    type: String,
    enum: ['super_admin', 'moderator', 'client', 'subscriber'],
    default: 'client',
  },
  isApproved: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }],
}, { timestamps: true });

// Virtual field for full name
userSchema.virtual('fullName').get(function() {
  return `${this.fName} ${this.lName}`;
});

// Ensure virtual fields are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

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