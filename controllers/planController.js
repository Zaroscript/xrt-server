import Plan from '../models/Plan.js';
import PlanRequest from '../models/PlanRequest.js';
import { AppError } from '../utils/errors.js';
import { validationResult } from 'express-validator';

// @desc    Get all plans
// @route   GET /api/v1/plans
// @access  Public
export const getAllPlans = async (req, res, next) => {
  try {
    const { active, featured } = req.query;
    const query = { isActive: true };
    
    if (active) query.isActive = active === 'true';
    if (featured) query.isFeatured = featured === 'true';
    
    const plans = await Plan.find(query).sort({ price: 1 });

    // Include virtual fields in the response
    const plansWithVirtuals = plans.map(plan => ({
      ...plan.toObject(),
      discountedPrice: plan.discountedPrice,
      discountedMonthlyPrice: plan.discountedMonthlyPrice,
      discountedYearlyPrice: plan.discountedYearlyPrice,
      isDiscountActive: plan.isDiscountActive()
    }));

    res.status(200).json({
      status: 'success',
      results: plansWithVirtuals.length,
      data: { plans: plansWithVirtuals }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single plan
// @route   GET /api/v1/plans/:id
// @access  Public
export const getPlan = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return next(new AppError('No plan found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: { plan }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new plan
// @route   POST /api/v1/plans
// @access  Private/Admin
export const createPlan = async (req, res, next) => {
  try {
    const plan = await Plan.create(req.body);
    
    res.status(201).json({
      status: 'success',
      data: { plan }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update plan
// @route   PATCH /api/v1/plans/:id
// @access  Private/Admin
export const updatePlan = async (req, res, next) => {
  try {
    // Handle discount removal explicitly
    const updateData = { ...req.body };
    if (req.body.discount === undefined || req.body.discount === null) {
      // Use $unset to remove the discount field completely
      delete updateData.discount;
      await Plan.findByIdAndUpdate(
        req.params.id,
        { $unset: { discount: 1 } },
        { new: true, runValidators: false }
      );
      // Get the updated plan
      const plan = await Plan.findById(req.params.id);
      if (!plan) {
        return next(new AppError('No plan found with that ID', 404));
      }
      return res.status(200).json({
        status: 'success',
        data: {
          plan
        }
      });
    }

    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!plan) {
      return next(new AppError('No plan found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        plan
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete plan
// @route   DELETE /api/v1/plans/:id
// @access  Private/Admin
export const deletePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    
    if (!plan) {
      return next(new AppError('No plan found with that ID', 404));
    }
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle plan status
// @route   PATCH /api/v1/plans/:id/toggle-status
// @access  Private/Admin
export const togglePlanStatus = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return next(new AppError('No plan found with that ID', 404));
    }
    
    plan.isActive = !plan.isActive;
    await plan.save({ validateBeforeSave: false });
    
    res.status(200).json({
      status: 'success',
      data: { plan }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured plans
// @route   GET /api/v1/plans/featured
// @access  Public
export const getFeaturedPlans = async (req, res, next) => {
  try {
    const plans = await Plan.find({ isFeatured: true, isActive: true })
      .sort({ price: 1 })
      .limit(3);
    
    res.status(200).json({
      status: 'success',
      results: plans.length,
      data: { plans }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request a plan
// @route   POST /api/v1/plans/:planId/request
// @access  Private
export const requestPlan = async (req, res, next) => {
  const { planId } = req.params;
  const { message } = req.body; // Get customization message from request body
  const clientId = req.user._id;

  try {
    const plan = await Plan.findById(planId);
    if (!plan) return next(new AppError('Plan not found', 404));

    const requestData = {
      client: clientId,
      plan: planId,
    };

    // Only add message if it exists
    if (message) {
      requestData.message = message;
    }

    const request = await PlanRequest.create(requestData);

    res.status(201).json({ status: 'success', data: { request } });
  } catch (err) {
    next(err);
  }
};

// @desc    Add or update discount for a plan
// @route   POST /api/v1/plans/:id/discounts
// @access  Private/Admin
export const addOrUpdateDiscount = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, isActive, startDate, endDate, code } = req.body;
    
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return next(new AppError('No plan found with that ID', 404));
    }

    // Check if discount code is already in use
    if (code) {
      const existingPlan = await Plan.findOne({
        _id: { $ne: plan._id },
        'discount.code': code
      });
      
      if (existingPlan) {
        return next(new AppError('Discount code is already in use', 400));
      }
    }

    // Update discount
    plan.discount = {
      amount,
      isActive: isActive !== undefined ? isActive : true,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      code: code || null
    };

    await plan.save();

    res.status(200).json({
      status: 'success',
      data: {
        plan
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove discount from a plan
// @route   DELETE /api/v1/plans/:id/discounts
// @access  Private/Admin
export const removeDiscount = async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return next(new AppError('No plan found with that ID', 404));
    }

    // Reset discount
    plan.discount = {
      amount: 0,
      isActive: false,
      startDate: null,
      endDate: null,
      code: null
    };

    await plan.save();

    res.status(200).json({
      status: 'success',
      data: {
        plan
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active discounts
// @route   GET /api/v1/plans/discounts/active
// @access  Public
export const getActiveDiscounts = async (req, res, next) => {
  try {
    const now = new Date();
    
    const plans = await Plan.find({
      'discount.isActive': true,
      'discount.amount': { $gt: 0 },
      $or: [
        { 'discount.startDate': { $lte: now } },
        { 'discount.startDate': { $exists: false } }
      ],
      $or: [
        { 'discount.endDate': { $gte: now } },
        { 'discount.endDate': { $exists: false } }
      ]
    }).select('name price discount');

    res.status(200).json({
      status: 'success',
      results: plans.length,
      data: {
        plans
      }
    });
  } catch (error) {
    next(error);
  }
};