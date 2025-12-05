import CompanySettings from '../models/CompanySettings.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get company settings (public - for invoices)
// @route   GET /api/company-settings
// @access  Public
export const getPublicCompanySettings = async (req, res, next) => {
  try {
    const settings = await CompanySettings.getSettings();
    res.json({
      status: 'success',
      data: {
        settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company settings
// @route   GET /api/admin/company-settings
// @access  Private/Admin
export const getCompanySettings = async (req, res, next) => {
  try {
    const settings = await CompanySettings.getSettings();
    res.json({
      status: 'success',
      data: {
        settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update company settings
// @route   PUT /api/admin/company-settings
// @access  Private/Admin
export const updateCompanySettings = async (req, res, next) => {
  try {
    const {
      companyName,
      address,
      city,
      state,
      zip,
      country,
      email,
      phone,
      taxId,
      website,
      logo,
      timezone,
      dateFormat,
      timeFormat,
      currency,
    } = req.body;

    // Get or create settings
    let settings = await CompanySettings.findOne();
    
    if (!settings) {
      settings = await CompanySettings.create({
        companyName,
        address,
        city,
        state,
        zip,
        country,
        email,
        phone,
        taxId,
        website,
        logo,
        timezone,
        dateFormat,
        timeFormat,
        currency,
      });
    } else {
      // Update existing settings
      if (companyName !== undefined) settings.companyName = companyName;
      if (address !== undefined) settings.address = address;
      if (city !== undefined) settings.city = city;
      if (state !== undefined) settings.state = state;
      if (zip !== undefined) settings.zip = zip;
      if (country !== undefined) settings.country = country;
      if (email !== undefined) settings.email = email;
      if (phone !== undefined) settings.phone = phone;
      if (taxId !== undefined) settings.taxId = taxId;
      if (website !== undefined) settings.website = website;
      if (logo !== undefined) settings.logo = logo;
      if (timezone !== undefined) settings.timezone = timezone;
      if (dateFormat !== undefined) settings.dateFormat = dateFormat;
      if (timeFormat !== undefined) settings.timeFormat = timeFormat;
      if (currency !== undefined) settings.currency = currency;

      await settings.save();
    }

    res.json({
      status: 'success',
      data: {
        settings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload company logo
// @route   POST /api/admin/company-settings/logo
// @access  Private/Admin
export const uploadCompanyLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new BadRequestError('Please upload a file'));
    }

    // Generate logo URL path
    const logoPath = `/uploads/logos/${req.file.filename}`;

    // Get or create settings
    let settings = await CompanySettings.findOne();
    
    if (!settings) {
      settings = await CompanySettings.create({
        logo: logoPath,
      });
    } else {
      // Delete old logo if exists
      if (settings.logo) {
        const oldLogoPath = path.join(__dirname, '..', settings.logo);
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
        }
      }

      // Update logo
      settings.logo = logoPath;
      await settings.save();
    }

    res.status(200).json({
      status: 'success',
      data: {
        logo: logoPath,
      },
    });
  } catch (error) {
    // Clean up uploaded file if error occurs
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', 'logos', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    next(error);
  }
};

// @desc    Delete company logo
// @route   DELETE /api/admin/company-settings/logo
// @access  Private/Admin
export const deleteCompanyLogo = async (req, res, next) => {
  try {
    const settings = await CompanySettings.findOne();

    if (!settings || !settings.logo) {
      return next(new NotFoundError('No logo to delete'));
    }

    // Delete logo file
    const logoPath = path.join(__dirname, '..', settings.logo);
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }

    // Remove logo from settings
    settings.logo = null;
    await settings.save();

    res.status(200).json({
      status: 'success',
      message: 'Logo deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

