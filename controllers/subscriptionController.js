import Plan from '../models/Plan.js';
import Transaction from '../models/Transaction.js';
import Client from '../models/Client.js';
import Service from '../models/Service.js';
import { AppError } from '../utils/errors.js';

// @desc    Create a new plan subscription
// @route   POST /api/v1/plans/subscribe
// @access  Private
/**
 * @swagger
 * /api/v1/plans/subscribe:
 *   post:
 *     summary: Subscribe to a plan
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - planId
 *               - billingCycle
 *               - paymentMethod
 *             properties:
 *               serviceId:
 *                 type: string
 *                 description: ID of the service to subscribe to
 *               planId:
 *                 type: string
 *                 description: ID of the plan to subscribe to
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, quarterly, annually]
 *                 description: Billing cycle for the subscription
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method ID from the payment processor
 *     responses:
 *       201:
 *         description: Plan subscription created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const subscribeToPlan = async (req, res, next) => {
  try {
    const { serviceId, planId, billingCycle, paymentMethod } = req.body;
    const clientId = req.user.clientId || req.user._id;

    // Validate input
    if (!serviceId || !planId || !billingCycle || !paymentMethod) {
      return next(new AppError('Missing required fields', 400));
    }

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    // Check if service exists and is active
    const service = await Service.findOne({ _id: serviceId, isActive: true });
    if (!service) {
      return next(new AppError('Service not found or inactive', 404));
    }

    // Check if plan exists and is active
    const plan = await Plan.findOne({ _id: planId, isActive: true });
    if (!plan) {
      return next(new AppError('Plan not found or inactive', 404));
    }

    // Calculate subscription end date based on billing cycle
    const startDate = new Date();
    const endDate = new Date();
    
    switch (billingCycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'annually':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        return next(new AppError('Invalid billing cycle', 400));
    }

    // Update client's current plan
    client.currentPlan = planId;
    client.services.push(serviceId);
    await client.save();

    // Create initial transaction
    const transaction = await Transaction.create({
      plan: planId,
      client: clientId,
      amount: plan.price,
      paymentMethod,
      paymentIntentId: `pi_${Date.now()}`,
      status: 'succeeded',
      description: `Initial payment for ${service.name} - ${plan.name} (${billingCycle})`,
      billingPeriod: {
        start: startDate,
        end: endDate
      }
    });

    res.status(201).json({
      status: 'success',
      data: {
        plan,
        transaction,
        client
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current plan for the current client
// @route   GET /api/v1/plans/my-plan
// @access  Private
/**
 * @swagger
 * /api/v1/plans/my-plan:
 *   get:
 *     summary: Get current plan for the current client
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client's current plan
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export const getMyPlan = async (req, res, next) => {
  try {
    const clientId = req.user.clientId || req.user._id;
    
    const client = await Client.findById(clientId)
      .populate('currentPlan')
      .populate('services');

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        plan: client.currentPlan,
        services: client.services
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscription by ID
// @route   GET /api/v1/subscriptions/:id
// @access  Private
export const getSubscription = async (req, res, next) => {
  try {
    const clientId = req.user.clientId || req.user._id;
    
    const client = await Client.findById(clientId)
      .populate('currentPlan')
      .populate('services');

    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        plan: client.currentPlan,
        services: client.services
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update client's plan
// @route   PATCH /api/v1/plans/update
// @access  Private
export const updateMyPlan = async (req, res, next) => {
  try {
    const { planId, paymentMethod } = req.body;
    const clientId = req.user.clientId || req.user._id;

    if (!planId || !paymentMethod) {
      return next(new AppError('Plan ID and payment method are required', 400));
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return next(new AppError('Plan not found or inactive', 404));
    }

    // Update client's current plan
    client.currentPlan = planId;
    await client.save();

    // Create transaction for plan change
    const transaction = await Transaction.create({
      plan: planId,
      client: clientId,
      amount: plan.price,
      paymentMethod,
      paymentIntentId: `pi_${Date.now()}`,
      status: 'succeeded',
      description: `Plan updated to ${plan.name}`
    });

    res.status(200).json({
      status: 'success',
      message: 'Plan updated successfully',
      data: {
        plan,
        transaction
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel current plan
// @route   PATCH /api/v1/plans/cancel
// @access  Private
export const cancelMyPlan = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const clientId = req.user.clientId || req.user._id;

    const client = await Client.findById(clientId);
    if (!client) {
      return next(new AppError('Client not found', 404));
    }

    // Clear current plan
    client.currentPlan = null;
    await client.save();

    res.status(200).json({
      status: 'success',
      message: 'Plan cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingRenewals = async (req, res, next) => {
  try {
    if (!['super_admin', 'moderator'].includes(req.user.role)) {
      return next(new AppError('Only admins can access this resource', 403));
    }

    const days = parseInt(req.query.days) || 7;
    const date = new Date();
    date.setDate(date.getDate() + days);

    // Get clients with active plans that need renewal
    const renewals = await Client.find({
      currentPlan: { $exists: true },
      status: 'active'
    })
    .populate('currentPlan', 'name price')
    .populate('userAccount', 'email')
    .sort({ createdAt: 1 });

    res.status(200).json({
      status: 'success',
      results: renewals.length,
      data: {
        renewals
      }
    });
  } catch (error) {
    next(error);
  }
};
