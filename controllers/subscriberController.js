import Subscriber from '../models/Subscriber.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import { AppError } from '../utils/errors.js';

// @desc    Get all subscribers
// @route   GET /api/v1/admin/subscribers
// @access  Private/Admin
export const getAllSubscribers = async (req, res, next) => {
  try {
    const subscribers = await Subscriber.find({})
      .populate('user', 'email fullName')
      .populate('plan.plan', 'name price billingCycle');
      
    res.status(200).json({
      status: 'success',
      results: subscribers.length,
      data: { subscribers }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscriber profile
// @route   GET /api/v1/subscribers/me
// @access  Private/Subscriber
export const getMySubscriberProfile = async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findOne({ user: req.user.id })
      .populate('plan.plan', 'name price billingCycle features');
      
    if (!subscriber) {
      return next(new AppError('Subscriber profile not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: { subscriber }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscriber by ID
// @route   GET /api/v1/admin/subscribers/:id
// @access  Private/Admin
export const getSubscriber = async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id)
      .populate('user', 'email fullName')
      .populate('plan.plan', 'name price billingCycle');
      
    if (!subscriber) {
      return next(new AppError('No subscriber found with that ID', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: { subscriber }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Auto-sync clients with current plans to subscriber model (for scheduled jobs)
// @access  Private/System (no auth required for scheduled jobs)
export const autoSyncClientsToSubscribers = async () => {
  try {
    console.log('Starting automatic sync of clients with current plans to subscribers...');
    
    // Find all clients that have a currentPlan
    const clientsWithPlans = await Client.find({ 
      currentPlan: { $exists: true, $ne: null } 
    }).populate('user currentPlan');
    
    console.log(`Found ${clientsWithPlans.length} clients with current plans`);
    
    let syncedCount = 0;
    let skippedCount = 0;
    let errors = [];
    
    for (const client of clientsWithPlans) {
      try {
        // Check if subscriber already exists for this user
        const existingSubscriber = await Subscriber.findOne({ user: client.user._id });
        
        if (existingSubscriber) {
          // Update existing subscriber if plan changed
          if (!existingSubscriber.plan || existingSubscriber.plan.plan.toString() !== client.currentPlan._id.toString()) {
            existingSubscriber.plan = {
              plan: client.currentPlan._id,
              startDate: new Date(),
              endDate: client.currentPlan.billingCycle === 'yearly' 
                ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                : new Date(new Date().setMonth(new Date().getMonth() + 1)),
              status: 'active',
              billingCycle: client.currentPlan.billingCycle,
              price: client.currentPlan.price,
              autoRenew: true,
              invoice: {
                invoiceNumber: `INV-${Date.now()}-${syncedCount + 1}`,
                dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                amount: client.currentPlan.price,
                status: 'pending'
              }
            };
            existingSubscriber.isActive = true;
            existingSubscriber.status = 'active';
            await existingSubscriber.save();
            console.log(`Updated subscriber for user ${client.user.email} with new plan ${client.currentPlan.name}`);
            syncedCount++;
          } else {
            console.log(`Subscriber already exists for user ${client.user.email} with same plan, skipping...`);
            skippedCount++;
          }
          continue;
        }
        
        // Update user role to subscriber
        if (client.user.role !== 'subscriber') {
          client.user.role = 'subscriber';
          await client.user.save({ validateBeforeSave: false });
          console.log(`Updated user role to subscriber for ${client.user.email}`);
        }
        
        // Create new subscriber record
        const subscriberData = {
          user: client.user._id,
          plan: {
            plan: client.currentPlan._id,
            startDate: new Date(),
            endDate: client.currentPlan.billingCycle === 'yearly' 
              ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
              : new Date(new Date().setMonth(new Date().getMonth() + 1)),
            status: 'active',
            billingCycle: client.currentPlan.billingCycle,
            price: client.currentPlan.price,
            autoRenew: true,
            invoice: {
              invoiceNumber: `INV-${Date.now()}-${syncedCount + 1}`,
              dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
              amount: client.currentPlan.price,
              status: 'pending'
            }
          },
          isActive: true,
          status: 'active'
        };
        
        const subscriber = await Subscriber.create(subscriberData);
        console.log(`Created subscriber for user ${client.user.email} with plan ${client.currentPlan.name}`);
        syncedCount++;
        
      } catch (error) {
        console.error(`Error processing client ${client.companyName} (user: ${client.user.email}):`, error);
        errors.push({
          client: client.companyName,
          user: client.user.email,
          error: error.message
        });
      }
    }
    
    console.log(`Auto-sync completed: ${syncedCount} created/updated, ${skippedCount} skipped, ${errors.length} errors`);
    
    return {
      totalClientsProcessed: clientsWithPlans.length,
      subscribersCreated: syncedCount,
      subscribersSkipped: skippedCount,
      errors: errors,
      processedAt: new Date()
    };
    
  } catch (error) {
    console.error('Auto-sync clients to subscribers error:', error);
    throw error;
  }
};

// @desc    Sync clients with current plans to subscriber model
// @route   POST /api/v1/subscribers/sync
// @access  Private/Admin
export const syncClientsToSubscribers = async (req, res, next) => {
  try {
    console.log('Starting sync of clients with current plans to subscribers...');
    
    // Find all clients that have a currentPlan
    const clientsWithPlans = await Client.find({ 
      currentPlan: { $exists: true, $ne: null } 
    }).populate('user currentPlan');
    
    console.log(`Found ${clientsWithPlans.length} clients with current plans`);
    
    let syncedCount = 0;
    let skippedCount = 0;
    let errors = [];
    
    for (const client of clientsWithPlans) {
      try {
        // Check if subscriber already exists for this user
        const existingSubscriber = await Subscriber.findOne({ user: client.user._id });
        
        if (existingSubscriber) {
          console.log(`Subscriber already exists for user ${client.user.email}, skipping...`);
          skippedCount++;
          continue;
        }
        
        // Update user role to subscriber
        if (client.user.role !== 'subscriber') {
          client.user.role = 'subscriber';
          await client.user.save({ validateBeforeSave: false });
          console.log(`Updated user role to subscriber for ${client.user.email}`);
        }
        
        // Create new subscriber record
        const subscriberData = {
          user: client.user._id,
          plan: {
            plan: client.currentPlan._id,
            startDate: new Date(),
            endDate: client.currentPlan.billingCycle === 'yearly' 
              ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
              : new Date(new Date().setMonth(new Date().getMonth() + 1)),
            status: 'active',
            billingCycle: client.currentPlan.billingCycle,
            price: client.currentPlan.price,
            autoRenew: true,
            invoice: {
              invoiceNumber: `INV-${Date.now()}-${syncedCount + 1}`,
              dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
              amount: client.currentPlan.price,
              status: 'pending'
            }
          },
          isActive: true,
          status: 'active'
        };
        
        const subscriber = await Subscriber.create(subscriberData);
        console.log(`Created subscriber for user ${client.user.email} with plan ${client.currentPlan.name}`);
        syncedCount++;
        
      } catch (error) {
        console.error(`Error processing client ${client.companyName} (user: ${client.user.email}):`, error);
        errors.push({
          client: client.companyName,
          user: client.user.email,
          error: error.message
        });
      }
    }
    
    console.log(`Sync completed: ${syncedCount} created, ${skippedCount} skipped, ${errors.length} errors`);
    
    res.status(200).json({
      status: 'success',
      message: 'Client to subscriber sync completed',
      data: {
        totalClientsProcessed: clientsWithPlans.length,
        subscribersCreated: syncedCount,
        subscribersSkipped: skippedCount,
        errors: errors,
        processedAt: new Date()
      }
    });
    
  } catch (error) {
    console.error('Sync clients to subscribers error:', error);
    next(error);
  }
};

// @desc    Create or update subscriber
// @route   POST /api/v1/subscribers
// @access  Private/Admin
export const createSubscriber = async (req, res, next) => {
  const { userId, planId, notes } = req.body;

  try {
    // Validate user
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }
    
    // Update user role to subscriber if not already
    if (user.role !== 'subscriber') {
      user.role = 'subscriber';
      await user.save({ validateBeforeSave: false });
    }
    
    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      return next(new AppError('No plan found with that ID', 404));
    }
    
    // Create or update subscriber with pending approval status
    let subscriber = await Subscriber.findOne({ user: userId });
    
    const subscriptionData = {
      plan: plan._id,
      status: 'pending_approval',
      billingCycle: plan.billingCycle,
      price: plan.price,
      features: plan.features,
      notes,
      // Dates will be set after approval
      startDate: null,
      endDate: null,
      approvalStatus: {
        approved: false,
        notes: 'Awaiting admin approval'
      },
      invoice: {
        status: 'pending',
        amount: plan.price,
        issueDate: null,
        dueDate: null
      }
    };
    
    if (subscriber) {
      // Archive current subscription if exists
      if (subscriber.subscription) {
        subscriber.subscriptionHistory.push({
          ...subscriber.subscription.toObject(),
          endDate: new Date()
        });
      }
      
      // Set new subscription with pending status
      subscriber.subscription = subscriptionData;
      subscriber.status = 'pending_approval';
    } else {
      // Create new subscriber with pending status
      subscriber = await Subscriber.create({
        user: userId,
        subscription: subscriptionData,
        status: 'pending_approval',
        isActive: false
      });
    }

    await subscriber.save();

    // TODO: Send notification to admin about new subscription request
    // TODO: Send confirmation email to user

    res.status(201).json({
      status: 'success',
      message: 'Subscription request submitted. Waiting for admin approval.',
      data: {
        subscriber
      }
    });
  } catch (err) {
    next(err);
  }
};

// Approve subscription
export const approveSubscription = async (req, res, next) => {
  try {
    const { subscriberId } = req.params;
    const { startDate, endDate, invoiceNumber, dueDate, notes } = req.body;
    
    const subscriber = await Subscriber.findById(subscriberId);
    if (!subscriber) {
      return next(new AppError('No subscriber found with that ID', 404));
    }
    
    if (subscriber.subscription.status !== 'pending_approval') {
      return next(new AppError('Subscription is not pending approval', 400));
    }
    
    // Update subscription with approval details
    subscriber.subscription.status = 'active';
    subscriber.subscription.startDate = new Date(startDate) || new Date();
    subscriber.subscription.endDate = new Date(endDate) || 
      (subscriber.subscription.billingCycle === 'yearly'
        ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        : new Date(new Date().setMonth(new Date().getMonth() + 1)));
    
    subscriber.subscription.approvalStatus = {
      approved: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      notes: notes || 'Subscription approved by admin'
    };
    
    // Set up invoice
    subscriber.subscription.invoice = {
      ...subscriber.subscription.invoice,
      invoiceNumber,
      issueDate: new Date(),
      dueDate: new Date(dueDate) || new Date(new Date().setDate(new Date().getDate() + 30)),
      status: 'pending'
    };
    
    subscriber.status = 'active';
    subscriber.isActive = true;
    
    await subscriber.save();
    
    // TODO: Send notification to user about approval
    // TODO: Send invoice to user
    
    res.status(200).json({
      status: 'success',
      message: 'Subscription approved successfully',
      data: {
        subscriber
      }
    });
    
  } catch (err) {
    next(err);
  }
};

// Reject subscription
export const rejectSubscription = async (req, res, next) => {
  try {
    const { subscriberId } = req.params;
    const { reason } = req.body;
    
    const subscriber = await Subscriber.findById(subscriberId);
    if (!subscriber) {
      return next(new AppError('No subscriber found with that ID', 404));
    }
    
    subscriber.subscription.status = 'rejected';
    subscriber.status = 'inactive';
    subscriber.isActive = false;
    
    subscriber.subscription.approvalStatus = {
      approved: false,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      notes: reason || 'Subscription rejected by admin'
    };
    
    await subscriber.save();
    
    // TODO: Send rejection notification to user
    
    res.status(200).json({
      status: 'success',
      message: 'Subscription rejected',
      data: {
        subscriber
      }
    });
    
  } catch (err) {
    next(err);
  }
};

// Record payment
export const recordPayment = async (req, res, next) => {
  try {
    const { subscriberId } = req.params;
    const { amount, paymentDate, paymentMethod, transactionId, notes } = req.body;
    
    const subscriber = await Subscriber.findById(subscriberId);
    if (!subscriber) {
      return next(new AppError('No subscriber found with that ID', 404));
    }
    
    if (subscriber.subscription.status !== 'active') {
      return next(new AppError('Subscription is not active', 400));
    }
    
    // Record payment
    subscriber.subscription.invoice.paymentDetails = {
      paymentDate: new Date(paymentDate) || new Date(),
      paymentMethod,
      transactionId,
      notes
    };
    
    // Update invoice status
    subscriber.subscription.invoice.status = 'paid';
    
    // If subscription was pending payment, activate it
    if (subscriber.status === 'pending_payment') {
      subscriber.status = 'active';
      subscriber.isActive = true;
      subscriber.subscription.startDate = subscriber.subscription.startDate || new Date();
      
      // Set end date if not already set
      if (!subscriber.subscription.endDate) {
        subscriber.subscription.endDate = 
          subscriber.subscription.billingCycle === 'yearly'
            ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            : new Date(new Date().setMonth(new Date().getMonth() + 1));
      }
    }
    
    await subscriber.save();
    
    // TODO: Send payment confirmation to user
    
    res.status(200).json({
      status: 'success',
      message: 'Payment recorded successfully',
      data: {
        subscriber
      }
    });
    
  } catch (err) {
    next(err);
  }
};

// @desc    Update subscriber
// @route   PATCH /api/v1/subscribers/:id
// @access  Private/Admin
export const updateSubscriber = async (req, res, next) => {
  try {
    const { subscription, billingInfo, preferences } = req.body;
    
    const subscriber = await Subscriber.findById(req.params.id);
    if (!subscriber) {
      return next(new AppError('No subscriber found with that ID', 404));
    }
    
    // Update subscription if provided
    if (subscription) {
      // Add current subscription to history if it exists and is being updated
      if (subscriber.subscription && 
          (subscription.plan || subscription.status || subscription.endDate)) {
        subscriber.subscriptionHistory.push({
          ...subscriber.subscription.toObject(),
          endDate: new Date()
        });
      }
      
      // Update subscription fields
      Object.keys(subscription).forEach(key => {
        subscriber.subscription[key] = subscription[key];
      });
    }
    
    // Update billing info if provided
    if (billingInfo) {
      subscriber.billingInfo = {
        ...subscriber.billingInfo,
        ...billingInfo
      };
    }
    
    // Update preferences if provided
    if (preferences) {
      subscriber.preferences = {
        ...subscriber.preferences,
        ...preferences
      };
    }
    
    await subscriber.save();
    
    res.status(200).json({
      status: 'success',
      data: { subscriber }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete subscriber
// @route   DELETE /api/v1/subscribers/:id
// @access  Private/Admin
export const deleteSubscriber = async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findByIdAndDelete(req.params.id);
    
    if (!subscriber) {
      return next(new AppError('No subscriber found with that ID', 404));
    }
    
    // Optionally, you might want to downgrade the user role
    await User.findByIdAndUpdate(subscriber.user, { role: 'user' });
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle subscriber status
// @route   PATCH /api/v1/subscribers/:id/toggle-status
// @access  Private/Admin
export const toggleSubscriberStatus = async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id);
    
    if (!subscriber) {
      return next(new AppError('No subscriber found with that ID', 404));
    }
    
    subscriber.isActive = !subscriber.isActive;
    subscriber.status = subscriber.isActive ? 'active' : 'inactive';
    
    if (subscriber.subscription) {
      subscriber.subscription.status = subscriber.isActive ? 'active' : 'suspended';
    }
    
    await subscriber.save();
    
    res.status(200).json({
      status: 'success',
      data: { subscriber }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get plan history
// @route   GET /api/v1/subscribers/me/history
// @access  Private/Subscriber
export const getMyPlanHistory = async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findOne({ user: req.user.id })
      .select('planHistory plan')
      .populate('plan.plan', 'name price billingCycle')
      .populate('planHistory.plan', 'name price billingCycle');
      
    if (!subscriber) {
      return next(new AppError('Subscriber profile not found', 404));
    }
    
    // Combine current plan with history
    const history = [
      ...(subscriber.plan ? [subscriber.plan] : []),
      ...(subscriber.planHistory || [])
    ].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    
    res.status(200).json({
      status: 'success',
      results: history.length,
      data: { history }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update subscription preferences
// @route   PATCH /api/v1/subscribers/me/preferences
// @access  Private/Subscriber
export const updateMyPreferences = async (req, res, next) => {
  try {
    const { preferences } = req.body;
    
    const subscriber = await Subscriber.findOne({ user: req.user.id });
    
    if (!subscriber) {
      return next(new AppError('Subscriber profile not found', 404));
    }
    
    subscriber.preferences = {
      ...subscriber.preferences,
      ...preferences
    };
    
    await subscriber.save();
    
    res.status(200).json({
      status: 'success',
      data: { subscriber }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscriber statistics
// @route   GET /api/v1/subscribers/stats
// @access  Private/Admin
export const getSubscriberStats = async (req, res, next) => {
  try {
    const totalSubscribers = await Subscriber.countDocuments();
    const activeSubscribers = await Subscriber.countDocuments({ status: 'active' });
    const inactiveSubscribers = await Subscriber.countDocuments({ status: 'inactive' });
    const pendingApproval = await Subscriber.countDocuments({ status: 'pending_approval' });
    
    // Calculate churn rate (inactive / total)
    const churnRate = totalSubscribers > 0 ? ((inactiveSubscribers / totalSubscribers) * 100).toFixed(1) : 0;
    
    // Calculate Monthly Recurring Revenue (MRR)
    const activeSubscriptions = await Subscriber.find({ status: 'active' }).populate('subscription.plan');
    const monthlyRecurringRevenue = activeSubscriptions.reduce((total, sub) => {
      if (sub.subscription && sub.subscription.plan) {
        const price = sub.subscription.plan.price || 0;
        // Convert yearly to monthly
        const monthlyPrice = sub.subscription.billingCycle === 'yearly' ? price / 12 : price;
        return total + monthlyPrice;
      }
      return total;
    }, 0);
    
    // Calculate Average Revenue Per Subscriber
    const averageRevenuePerSubscriber = activeSubscribers > 0 ? monthlyRecurringRevenue / activeSubscribers : 0;
    
    res.status(200).json({
      status: 'success',
      data: {
        totalSubscribers,
        activeSubscribers,
        inactiveSubscribers,
        pendingApproval,
        churnRate: parseFloat(churnRate),
        monthlyRecurringRevenue: parseFloat(monthlyRecurringRevenue.toFixed(2)),
        averageRevenuePerSubscriber: parseFloat(averageRevenuePerSubscriber.toFixed(2))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscriber growth data
// @route   GET /api/v1/subscribers/growth
// @access  Private/Admin
export const getSubscriberGrowth = async (req, res, next) => {
  try {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const growthData = [];
    
    // Get subscriber growth for the last 7 months
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = months[date.getMonth()];
      const year = date.getFullYear();
      
      // Count subscribers created in this month
      const startDate = new Date(year, date.getMonth(), 1);
      const endDate = new Date(year, date.getMonth() + 1, 0, 23, 59, 59);
      
      const subscribersInMonth = await Subscriber.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });
      
      // Calculate revenue from active subscribers in this month
      const activeSubscriptionsInMonth = await Subscriber.find({
        status: 'active',
        'subscription.startDate': { $lte: endDate },
        $or: [
          { 'subscription.endDate': { $gte: startDate } },
          { 'subscription.endDate': null }
        ]
      }).populate('subscription.plan');
      
      const revenueInMonth = activeSubscriptionsInMonth.reduce((total, sub) => {
        if (sub.subscription && sub.subscription.plan) {
          const price = sub.subscription.plan.price || 0;
          // Convert yearly to monthly
          const monthlyPrice = sub.subscription.billingCycle === 'yearly' ? price / 12 : price;
          return total + monthlyPrice;
        }
        return total;
      }, 0);
      
      growthData.push({
        name: monthName,
        subscribers: subscribersInMonth,
        revenue: parseFloat(revenueInMonth.toFixed(2))
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: growthData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get plan distribution
// @route   GET /api/v1/subscribers/plan-distribution
// @access  Private/Admin
export const getPlanDistribution = async (req, res, next) => {
  try {
    // Aggregate subscribers by plan
    const planDistribution = await Subscriber.aggregate([
      { $match: { status: 'active' } },
      { $lookup: { from: 'plans', localField: 'subscription.plan', foreignField: '_id', as: 'planInfo' } },
      { $unwind: '$planInfo' },
      { 
        $group: {
          _id: '$planInfo.name',
          count: { $sum: 1 },
          avgPrice: { $avg: '$planInfo.price' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Format data for charts
    const formattedData = planDistribution.map(item => ({
      name: item._id,
      value: item.count,
      count: item.count
    }));
    
    res.status(200).json({
      status: 'success',
      data: formattedData
    });
  } catch (error) {
    next(error);
  }
};
