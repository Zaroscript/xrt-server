import mongoose from 'mongoose';

const companySettingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    default: 'Your Company Name',
  },
  address: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: '',
  },
  zip: {
    type: String,
    default: '',
  },
  country: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    default: '',
  },
  phone: {
    type: String,
    default: '',
  },
  taxId: {
    type: String,
    default: '',
  },
  website: {
    type: String,
    default: '',
  },
  logo: {
    type: String,
    default: '',
  },
  timezone: {
    type: String,
    default: 'UTC',
  },
  dateFormat: {
    type: String,
    default: 'MM/DD/YYYY',
  },
  timeFormat: {
    type: String,
    enum: ['12h', '24h'],
    default: '12h',
  },
  currency: {
    type: String,
    default: 'USD',
  },
}, {
  timestamps: true,
});

// Ensure only one document exists
companySettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const CompanySettings = mongoose.model('CompanySettings', companySettingsSchema);

export default CompanySettings;

