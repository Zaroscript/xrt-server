import Service from '../models/Service.js';
import ServiceRequest from '../models/ServiceRequest.js';
import { AppError } from '../utils/errors.js';

// @desc    Get all services
// @route   GET /api/v1/services
// @access  Public
export const getAllServices = async (req, res, next) => {
  try {
    const { active, category } = req.query;
    const query = { isActive: true };
    
    if (active) query.isActive = active === 'true';
    if (category) query.category = category;
    
    const services = await Service.find(query).sort({ name: 1 });
    
    res.status(200).json({
      status: 'success',
      results: services.length,
      data: { services }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single service
// @route   GET /api/v1/services/:id
// @access  Public
export const getService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return next(new AppError('No service found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
};





// @desc    Get services by category
// @route   GET /api/v1/services/category/:category
// @access  Public
export const getServicesByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const services = await Service.find({ 
      category: category.toLowerCase(),
      isActive: true 
    }).sort({ name: 1 });
    
    res.status(200).json({
      status: 'success',
      results: services.length,
      data: { services }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request a service
// @route   POST /api/v1/services/:serviceId/request
// @access  Private
export const requestService = async (req, res, next) => {
  const { serviceId } = req.params;
  const clientId = req.user._id;
  const { message, customRequirements } = req.body;

  try {
    const service = await Service.findById(serviceId);
    if (!service) return next(new AppError('Service not found', 404));

    const request = await ServiceRequest.create({
      client: clientId,
      service: serviceId,
      message,
      customRequirements
    });

    res.status(201).json({ status: 'success', data: { request } });
  } catch (err) {
    next(err);
  }
};