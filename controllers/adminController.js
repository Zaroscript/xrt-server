import User from '../models/User.js';
import ServiceRequest from '../models/ServiceRequest.js';
import PlanRequest from '../models/PlanRequest.js';
import Service from '../models/Service.js';
import Plan from '../models/Plan.js';
import Client from '../models/Client.js';
import { AppError } from '../utils/errors.js';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import mongoose from 'mongoose';

// === Dashboard Data ===

export const getMonthlyRevenue = async (req, res, next) => {
  try {
    // Get the last 6 months
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      months.push({
        month: format(date, 'MMM'),
        year: date.getFullYear(),
        start: startOfMonth(date),
        end: endOfMonth(date)
      });
    }

    // Calculate revenue for each month
    const revenueData = await Promise.all(months.map(async ({ month, year, start, end }) => {
      // This is a simplified example - adjust the query based on your payment/transaction model
      const result = await Client.aggregate([
        {
          $match: {
            subscriptionStart: { $lte: end },
            $or: [
              { subscriptionEnd: { $gte: start } },
              { subscriptionEnd: null }
            ]
          }
        },
        {
          $lookup: {
            from: 'plans',
            localField: 'subscription.plan',
            foreignField: '_id',
            as: 'plan'
          }
        },
        { $unwind: '$plan' },
        {
          $group: {
            _id: null,
            total: { $sum: '$plan.price' }
          }
        }
      ]);

      return {
        month: `${month} ${year}`,
        revenue: result[0]?.total || 0,
        // Add a random number of users for demo purposes
        users: Math.floor(Math.random() * 50) + 10
      };
    }));

    res.json({ status: 'success', data: revenueData });
  } catch (err) {
    next(err);
  }
};

export const getTicketsStats = async (req, res, next) => {
  try {
    // Get ticket statistics for the last 4 weeks
    const weeks = [];
    const now = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i + 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      weeks.push({
        week: `Week ${4 - i}`,
        start: weekStart,
        end: weekEnd
      });
    }

    const ticketsData = await Promise.all(weeks.map(async ({ week, start, end }) => {
      const openTickets = await mongoose.model('Ticket').countDocuments({
        status: 'open',
        createdAt: { $gte: start, $lte: end }
      });
      
      const resolvedTickets = await mongoose.model('Ticket').countDocuments({
        status: 'resolved',
        updatedAt: { $gte: start, $lte: end }
      });

      return {
        week,
        open: openTickets,
        resolved: resolvedTickets
      };
    }));

    res.json({ status: 'success', data: ticketsData });
  } catch (err) {
    next(err);
  }
};

export const getUsersGrowth = async (req, res, next) => {
  try {
    // Get the last 6 months
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      months.push({
        month: format(date, 'MMM yyyy'),
        start: startOfMonth(date),
        end: endOfMonth(date)
      });
    }

    const usersGrowthData = await Promise.all(months.map(async ({ month, start, end }) => {
      const usersCount = await User.countDocuments({
        role: 'user',
        createdAt: { $lte: end }
      });
      
      const clientsCount = await Client.countDocuments({
        createdAt: { $lte: end }
      });

      return {
        month,
        users: usersCount,
        clients: clientsCount
      };
    }));

    res.json({ status: 'success', data: usersGrowthData });
  } catch (err) {
    next(err);
  }
};

// === Users ===
export const getPendingUsers = async (req, res, next) => {
  try {
    const users = await User.find({ isApproved: false, role: { $in: ['client', 'subscriber'] } })
      .select('email fullName phone createdAt');
    res.json({ status: 'success', data: { users } });
  } catch (err) {
    next(err);
  }
};

export const approveUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    ).select('-password');
    if (!user) return next(new AppError('User not found', 404));

    res.json({ status: 'success', data: { user } });
  } catch (err) {
    next(err);
  }
};

export const rejectUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return next(new AppError('User not found', 404));

    // Optionally, you might want to send a notification email here
    
    res.json({ status: 'success', message: 'User rejected and deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// === Service Requests ===
export const getPendingServiceRequests = async (req, res, next) => {
  try {
    const requests = await ServiceRequest.find({ status: 'pending' })
      .populate('client', 'email fullName')
      .populate('service', 'name');
    res.json({ status: 'success', data: { requests } });
  } catch (err) {
    next(err);
  }
};

export const respondToServiceRequest = async (req, res, next) => {
  const { id } = req.params;
  const { status, customPrice, adminNote } = req.body;

  try {
    const request = await ServiceRequest.findById(id);
    if (!request) return next(new AppError('Request not found', 404));

    request.status = status;
    if (customPrice) request.customPrice = customPrice;
    if (adminNote) request.adminNote = adminNote;
    request.respondedAt = Date.now();

    await request.save();

    res.json({ status: 'success', data: { request } });
  } catch (err) {
    next(err);
  }
};

// === Plan Requests ===
export const getPendingPlanRequests = async (req, res, next) => {
  try {
    const requests = await PlanRequest.find({ status: 'pending' })
      .populate('client', 'email fullName')
      .populate('plan', 'name price');
    res.json({ status: 'success', data: { requests } });
  } catch (err) {
    next(err);
  }
};

export const respondToPlanRequest = async (req, res, next) => {
  const { id } = req.params;
  const { status, adminNote } = req.body;

  try {
    const request = await PlanRequest.findById(id);
    if (!request) return next(new AppError('Request not found', 404));

    request.status = status;
    if (adminNote) request.adminNote = adminNote;
    request.respondedAt = Date.now();

    if (status === 'approved') {
      const user = await User.findById(request.client);
      const plan = await Plan.findById(request.plan);

      user.role = 'subscriber';
      user.activePlan = plan._id;
      user.planStartDate = new Date();
      user.planExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await user.save();
    }

    await request.save();
    res.json({ status: 'success', data: { request } });
  } catch (err) {
    next(err);
  }
};

// === Services CRUD ===

// @desc    Create new service
// @route   POST /api/v1/services
// @access  Private/Admin
export const createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    
    res.status(201).json({
      status: 'success',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update service
// @route   PATCH /api/v1/services/:id
// @access  Private/Admin
export const updateService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
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

// @desc    Delete service
// @route   DELETE /api/v1/services/:id
// @access  Private/Admin
export const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    
    if (!service) {
      return next(new AppError('No service found with that ID', 404));
    }
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle service status (active/inactive)
// @route   PATCH /api/v1/admin/services/:id/toggle-status
// @access  Private/Admin
export const toggleServiceStatus = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return next(new AppError('No service found with that ID', 404));
    }
    
    service.isActive = !service.isActive;
    await service.save({ validateBeforeSave: false });
    
    res.status(200).json({
      status: 'success',
      data: { service }
    });
  } catch (error) {
    next(error);
  }
};

// === Plans CRUD ===
export const createPlan = async (req, res, next) => {
  try {
    const plan = await Plan.create(req.body);
    res.status(201).json({ status: 'success', data: { plan } });
  } catch (err) {
    next(err);
  }
};

export const updatePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!plan) return next(new AppError('Plan not found', 404));
    res.json({ status: 'success', data: { plan } });
  } catch (err) {
    next(err);
  }
};

export const deletePlan = async (req, res, next) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return next(new AppError('Plan not found', 404));
    res.json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle plan status (active/inactive)
// @route   PATCH /api/v1/admin/plans/:id/toggle-status
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

// @desc    Convert client to subscriber with plan
// @route   POST /api/v1/admin/convert-to-subscriber
// @access  Private/Admin
export const convertToSubscriber = async (req, res, next) => {
  try {
    const { userId, planId, startDate, endDate, customPrice, features } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Verify the plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return next(new AppError('Plan not found', 404));
    }

    // Create subscription data
    const subscription = {
      plan: planId,
      startDate: startDate || new Date(),
      endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'active',
      price: customPrice || plan.price,
      features: features || plan.features
    };

    // Update user role and subscription
    user.role = 'subscriber';
    user.subscription = subscription;
    user.isApproved = true;

    // Update client record if exists
    await Client.findOneAndUpdate(
      { user: userId },
      { 
        $set: { 
          currentPlan: planId,
          status: 'active',
          subscriptionDetails: subscription
        } 
      },
      { new: true, upsert: true }
    );

    // Save the updated user
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          subscription: user.subscription
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user subscription
// @route   PATCH /api/v1/admin/subscription/:userId
// @access  Private/Admin
export const updateSubscription = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const user = await User.findById(userId);
    if (!user || !['client', 'subscriber'].includes(user.role)) {
      return next(new AppError('User not found or invalid role', 404));
    }

    // If updating plan
    if (updates.planId) {
      const plan = await Plan.findById(updates.planId);
      if (!plan) {
        return next(new AppError('Plan not found', 404));
      }
      user.subscription = user.subscription || {};
      user.subscription.plan = updates.planId;
      
      // Update role to subscriber if not already
      if (user.role === 'client') {
        user.role = 'subscriber';
      }
    }

    // Update subscription fields
    const allowedUpdates = ['startDate', 'endDate', 'status', 'price', 'features'];
    allowedUpdates.forEach(update => {
      if (updates[update] !== undefined) {
        user.subscription = user.subscription || {};
        user.subscription[update] = updates[update];
      }
    });

    // Update client record if exists
    if (updates.planId || updates.status) {
      await Client.findOneAndUpdate(
        { user: userId },
        { 
          $set: { 
            currentPlan: updates.planId || user.subscription?.plan,
            status: updates.status || 'active',
            subscriptionDetails: user.subscription
          } 
        },
        { new: true, upsert: true }
      );
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        subscription: user.subscription
      }
    });
  } catch (error) {
    next(error);
  }
};