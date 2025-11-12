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
      .populate('subscription.plan', 'name price billingCycle');
      
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
      .populate('subscription.plan', 'name price billingCycle features');
      
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
      .populate('subscription.plan', 'name price billingCycle');
      
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

// @desc    Create or update subscriber
// @route   POST /api/v1/subscribers
// @access  Private/Admin
export const createSubscriber = async (req, res, next) => {
  try {
    const { userId, planId, startDate, endDate, customPrice, features } = req.body;
    
    // Check if user exists and is not already a subscriber
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }
    
    if (user.role !== 'subscriber') {
      user.role = 'subscriber';
      await user.save({ validateBeforeSave: false });
    }
    
    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      return next(new AppError('No plan found with that ID', 404));
    }
    
    // Calculate end date if not provided
    const subscriptionEndDate = endDate || 
      (plan.billingCycle === 'yearly'
        ? new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1))
        : new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)));
    
    // Create or update subscriber
    let subscriber = await Subscriber.findOne({ user: userId });
    
    if (subscriber) {
      // Add current subscription to history
      if (subscriber.subscription) {
        subscriber.subscriptionHistory.push({
          ...subscriber.subscription.toObject(),
          endDate: new Date()
        });
      }
      
      // Update subscription
      subscriber.subscription = {
        plan: plan._id,
        startDate: new Date(startDate),
        endDate: subscriptionEndDate,
        status: 'active',
        billingCycle: plan.billingCycle,
        price: customPrice || plan.price,
        features: features || plan.features,
        customPrice: customPrice || undefined
      };
      
      subscriber.isActive = true;
      subscriber.status = 'active';
    } else {
      // Create new subscriber
      subscriber = new Subscriber({
        user: userId,
        subscription: {
          plan: plan._id,
          startDate: new Date(startDate),
          endDate: subscriptionEndDate,
          status: 'active',
          billingCycle: plan.billingCycle,
          price: customPrice || plan.price,
          features: features || plan.features,
          customPrice: customPrice || undefined
        },
        isActive: true,
        status: 'active'
      });
    }
    
    await subscriber.save();
    
    res.status(201).json({
      status: 'success',
      data: { subscriber }
    });
  } catch (error) {
    next(error);
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

// @desc    Get subscription history
// @route   GET /api/v1/subscribers/me/history
// @access  Private/Subscriber
export const getMySubscriptionHistory = async (req, res, next) => {
  try {
    const subscriber = await Subscriber.findOne({ user: req.user.id })
      .select('subscriptionHistory subscription')
      .populate('subscription.plan', 'name price billingCycle')
      .populate('subscriptionHistory.plan', 'name price billingCycle');
      
    if (!subscriber) {
      return next(new AppError('Subscriber profile not found', 404));
    }
    
    // Combine current subscription with history
    const history = [
      ...(subscriber.subscription ? [subscriber.subscription] : []),
      ...(subscriber.subscriptionHistory || [])
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
    
    const subscriber = await Subscriber.findOneAndUpdate(
      { user: req.user.id },
      { preferences },
      { new: true, runValidators: true }
    );
    
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
