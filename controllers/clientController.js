import Client from '../models/Client.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Plan from '../models/Plan.js';
import Subscriber from '../models/Subscriber.js';
import { AppError } from '../utils/errors.js';

// @desc    Create a new client
// @route   POST /api/v1/clients
// @access  Private/Admin
export const createClient = async (req, res, next) => {
  try {
    const { 
      user, 
      email, 
      fName, 
      lName, 
      phone,
      password, 
      companyName, 
      businessLocation, 
      oldWebsite, 
      taxId, 
      notes, 
      services 
    } = req.body;

    let userId = user;

    // If email is provided but no user ID, create or find user
    if (email && !userId) {
      let existingUser = await User.findOne({ email: email.toLowerCase() });
      
      if (!existingUser) {
        // Create new user
        const tempPassword = password || `Temp${Date.now()}${Math.random().toString(36).slice(2)}`;
        existingUser = await User.create({
          email: email.toLowerCase(),
          password: tempPassword,
          fName: fName || 'Client',
          lName: lName || 'User',
          phone: phone,
          companyName: companyName || 'Default Company', // Add required companyName
          role: 'client',
          isApproved: true, // Auto-approve clients created by admin
          isActive: true
        });
      }
      
      userId = existingUser._id;
    }

    if (!userId) {
      return next(new AppError('User ID or email is required', 400));
    }

    // Check if client already exists for this user
    const existingClient = await Client.findOne({ user: userId });
    if (existingClient) {
      return next(new AppError('Client already exists for this user', 400));
    }

    // Validate required fields
    if (!companyName) {
      return next(new AppError('Company name is required', 400));
    }

    const client = await Client.create({
      user: userId,
      companyName,
      businessLocation,
      oldWebsite,
      taxId,
      notes,
      services,
      isActive: true
    });

    // Populate user data in response
    await client.populate('user', 'email fName lName phone');

    res.status(201).json({
      status: 'success',
      data: {
        client
      }
    });
  } catch (error) {
    console.error('Create client error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      reqBody: req.body
    });
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return next(new AppError(`Validation Error: ${errors.join(', ')}`, 400));
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return next(new AppError(`${field} already exists`, 400));
    }

    next(error);
  }
};

// @desc    Get all clients
// @route   GET /api/v1/clients
// @access  Private/Admin
export const getAllClients = async (req, res, next) => {
  try {
    const clients = await Client.find()
      .populate('user', 'email fName lName phone')
      .populate('services', 'name description')
      .populate('currentPlan');

    res.status(200).json({
      status: 'success',
      results: clients.length,
      data: {
        clients
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single client
// @route   GET /api/v1/clients/:id
// @access  Private/Admin
export const getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('user', 'email fName lName phone')
      .populate('services', 'name description')
      .populate('currentPlan');

    if (!client) {
      return next(new AppError('No client found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        client
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update client
// @route   PATCH /api/v1/clients/:id
// @access  Private/Admin
export const updateClient = async (req, res, next) => {
  try {
    const { companyName, address, oldWebsite, taxId, notes, services, currentPlan, isActive, subscription } = req.body;
    
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      {
        companyName,
        address,
        oldWebsite,
        taxId,
        notes,
        services,
        currentPlan,
        isActive,
        subscription,
        lastActivity: new Date().toISOString()
      },
      { new: true, runValidators: true }
    ).populate('user', 'email fName lName phone')
     .populate('services', 'name description')
     .populate('currentPlan');

    if (!client) {
      return next(new AppError('No client found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        client
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete client
// @route   DELETE /api/v1/clients/:id
// @access  Private/Admin
export const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);

    if (!client) {
      return next(new AppError('No client found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get client by user ID
// @route   GET /api/v1/clients/user/me
// @access  Private
export const getClientByUser = async (req, res, next) => {
  try {
    const client = await Client.findOne({ user: req.user.id })
      .populate('user', 'email fName lName phone')
      .populate('services', 'name description')
      .populate('currentPlan');

    if (!client) {
      return next(new AppError('No client found for that user', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        client
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle client active status
// @route   PATCH /api/v1/clients/:id/toggle-status
// @access  Private/Admin
export const toggleClientStatus = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return next(new AppError('No client found with that ID', 404));
    }

    // Toggle the isActive status
    client.isActive = !client.isActive;
    await client.save();

    // Also toggle the associated user if exists
    if (client.user) {
      await User.findByIdAndUpdate(
        client.user._id,
        { isActive: client.isActive },
        { new: true }
      );
    }

    res.status(200).json({
      status: 'success',
      data: {
        client
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve client
// @route   PATCH /api/v1/clients/:id/approve
// @access  Private/Admin
export const approveClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('user', 'email fName lName phone');
    
    if (!client) {
      return next(new AppError('No client found with that ID', 404));
    }

    // Approve the client (set isActive to true)
    client.isActive = true;
    await client.save();

    // Also approve the associated user if exists
    if (client.user && client.user.isApproved === false) {
      await User.findByIdAndUpdate(
        client.user._id,
        { isApproved: true },
        { new: true }
      );
    }

    res.status(200).json({
      status: 'success',
      data: {
        client
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get client activities
// @route   GET /api/v1/clients/:id/activities
// @access  Private
export const getClientActivities = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('user', 'email fName lName');
    
    if (!client) {
      return next(new AppError('No client found with that ID', 404));
    }

    // Generate sample activities based on client data
    // In a real implementation, these would come from a database collection
    const activities = [
      {
        id: '1',
        type: 'login',
        title: 'User Login',
        description: `${client.user?.fName} ${client.user?.lName} logged into the system`,
        timestamp: client.lastActivity || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'success'
      },
      {
        id: '2',
        type: 'profile_update',
        title: 'Profile Updated',
        description: 'Client profile information was updated',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'success'
      },
      {
        id: '3',
        type: 'payment',
        title: 'Payment Processed',
        description: `Payment of $${client.currentPlan?.price || 0} processed successfully`,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'success'
      },
      {
        id: '4',
        type: 'subscription_change',
        title: 'Subscription Changed',
        description: `Changed to ${client.currentPlan?.name || 'Basic'} plan`,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'success'
      },
      {
        id: '5',
        type: 'support_ticket',
        title: 'Support Ticket Created',
        description: 'New support ticket submitted',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      }
    ];

    res.status(200).json({
      status: 'success',
      data: {
        activities
      }
    });
  } catch (error) {
    next(error);
  }
};
