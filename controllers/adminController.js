import User from '../models/User.js';
import ServiceRequest from '../models/ServiceRequest.js';
import PlanRequest from '../models/PlanRequest.js';
import Service from '../models/Service.js';
import Plan from '../models/Plan.js';
import Client from '../models/Client.js';
import Subscriber from '../models/Subscriber.js';
import { AppError } from '../utils/errors.js';
import { sendRejectionEmail } from '../utils/emailService.js';
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
            createdAt: { $lte: end },
            $or: [
              { updatedAt: { $gte: start } },
              { updatedAt: null }
            ]
          }
        },
        {
          $lookup: {
            from: 'plans',
            localField: 'currentPlan',
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Update user's approval status
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        isApproved: true,
        role: 'client' // Ensure the role is set to client
      },
      { new: true, session }
    ).select('-password');
    
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('User not found', 404));
    }

    // 2. Create a client record for the approved user
    const clientData = {
      user: user._id,
      companyName: user.companyName || `${user.fName} ${user.lName}`,
      isActive: true,
      // Add any other default client fields here
    };

    // Check if client already exists (in case of re-approval)
    let client = await Client.findOne({ user: user._id }).session(session);
    
    if (!client) {
      // Create new client record if it doesn't exist
      client = await Client.create([clientData], { session });
      client = client[0]; // create returns an array
    } else {
      // Update existing client record
      client = await Client.findByIdAndUpdate(
        client._id,
        { ...clientData, isActive: true },
        { new: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ 
      status: 'success', 
      data: { 
        user,
        client 
      } 
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

export const rejectUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Find the user first to get their details before deleting
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError('User not found', 404));
    }

    // 2. Delete the user
    await User.findByIdAndDelete(req.params.id).session(session);

    // 3. Send rejection email
    try {
      await sendRejectionEmail(
        user.email, 
        `${user.fName} ${user.lName}`.trim(),
        req.body.reason // Optional reason from the request body
      );
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      // Don't fail the operation if email sending fails
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ 
      status: 'success', 
      message: 'User rejected and deleted successfully' 
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

// === Service Requests ===
export const getPendingServiceRequests = async (req, res, next) => {
  try {
    const requests = await ServiceRequest.find({ status: 'pending' })
      .populate('client', 'email fName lName fullName companyName phone')
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
      .populate('client', 'email fName lName fullName companyName phone')
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
export const getAllPlansForAdmin = async (req, res, next) => {
  try {
    console.log('getAllPlansForAdmin called');
    const { featured } = req.query;
    const query = {};
    
    if (featured) query.isFeatured = featured === 'true';
    
    console.log('Query:', query);
    const plans = await Plan.find(query).sort({ createdAt: -1 });
    console.log('Plans found:', plans.length);
    
    res.status(200).json({
      status: 'success',
      results: plans.length,
      data: { plans }
    });
  } catch (error) {
    console.error('Error in getAllPlansForAdmin:', error);
    next(error);
  }
};

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
    console.log('Backend updatePlan called with:', {
      id: req.params.id,
      body: req.body,
      validationErrors: req.validationErrors?.array()
    });
    
    // Handle discount removal explicitly
    const updateData = { ...req.body };
    if (req.body.discount === undefined || req.body.discount === null) {
      // Use $unset to remove the discount field completely
      delete updateData.discount;
      
      // Update the plan with all fields including price, then remove discount
      const plan = await Plan.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!plan) return next(new AppError('Plan not found', 404));
      
      // Now remove the discount field if needed
      if (req.body.discount === undefined || req.body.discount === null) {
        await Plan.findByIdAndUpdate(
          req.params.id,
          { $unset: { discount: 1 } },
          { new: true, runValidators: false }
        );
        // Get the final updated plan
        const finalPlan = await Plan.findById(req.params.id);
        console.log('Plan updated with discount removal:', finalPlan);
        return res.json({ status: 'success', data: { plan: finalPlan } });
      }
      
      console.log('Plan updated successfully:', plan);
      return res.json({ status: 'success', data: { plan } });
    }

    console.log('Update data before save:', updateData);
    const plan = await Plan.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true, // Re-enable with fixed validation
    });
    if (!plan) return next(new AppError('Plan not found', 404));
    console.log('Plan updated successfully:', plan);
    res.json({ status: 'success', data: { plan } });
  } catch (err) {
    console.error('Error updating plan:', err);
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

// @desc    Assign a plan to a user
// @route   POST /api/v1/admin/assign-plan
// @access  Private/Admin
export const assignPlan = async (req, res, next) => {
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

    // Update user role and current plan
    user.role = 'subscriber';
    user.isApproved = true;

    // Update client record if exists
    const client = await Client.findOneAndUpdate(
      { user: userId },
      { 
        $set: { 
          currentPlan: planId,
          status: 'active'
        } 
      },
      { new: true, upsert: true }
    );

    // Create or update subscriber record
    const subscriberData = {
      user: userId,
      plan: {
        plan: planId,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        status: 'active',
        approvalStatus: {
          approved: true,
          approvedBy: req.user.id,
          approvedAt: new Date()
        },
        price: customPrice || plan.price,
        features: features || plan.features,
        billingCycle: plan.billingCycle
      },
      isActive: true,
      status: 'active'
    };

    const subscriber = await Subscriber.findOneAndUpdate(
      { user: userId },
      { 
        $set: subscriberData,
        $push: { 
          planHistory: subscriberData.plan,
          paymentHistory: {
            amount: subscriberData.plan.price,
            date: new Date(),
            status: 'completed',
            paymentMethod: 'admin_assignment'
          }
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
          role: user.role
        },
        client,
        subscriber
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
      // Update role to subscriber if not already
      if (user.role === 'client') {
        user.role = 'subscriber';
      }
    }

    // Update client record if exists
    let client;
    if (updates.planId || updates.status) {
      client = await Client.findOneAndUpdate(
        { user: userId },
        { 
          $set: { 
            currentPlan: updates.planId,
            status: updates.status || 'active'
          } 
        },
        { new: true, upsert: true }
      );
    }

    // Update subscriber record if plan is being updated
    let subscriber;
    if (updates.planId) {
      const plan = await Plan.findById(updates.planId);
      if (!plan) {
        return next(new AppError('Plan not found', 404));
      }

      const subscriberData = {
        plan: {
          plan: updates.planId,
          startDate: updates.startDate ? new Date(updates.startDate) : new Date(),
          endDate: updates.endDate ? new Date(updates.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: updates.status || 'active',
          approvalStatus: {
            approved: true,
            approvedBy: req.user.id,
            approvedAt: new Date()
          },
          price: updates.customPrice || plan.price,
          features: updates.features || plan.features,
          billingCycle: plan.billingCycle
        },
        isActive: true,
        status: updates.status || 'active'
      };

      subscriber = await Subscriber.findOneAndUpdate(
        { user: userId },
        { 
          $set: subscriberData,
          $push: { 
            planHistory: subscriberData.plan,
            paymentHistory: {
              amount: subscriberData.plan.price,
              date: new Date(),
              status: 'completed',
              paymentMethod: 'admin_update'
            }
          }
        },
        { new: true, upsert: true }
      );
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      message: 'Plan updated successfully',
      data: {
        user,
        client,
        subscriber
      }
    });
  } catch (error) {
    next(error);
  }
};