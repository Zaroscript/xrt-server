import Client from '../models/Client.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Plan from '../models/Plan.js';
import { AppError } from '../utils/errors.js';

// @desc    Create a new client
// @route   POST /api/v1/clients
// @access  Private/Admin
export const createClient = async (req, res, next) => {
  try {
    const { 
      user, // Can be user ID or email
      email, // If provided, will create/find user by email
      fName, 
      lName, 
      phone,
      password, // Optional, will generate if not provided
      companyName, 
      address, 
      oldWebsite, 
      taxId, 
      notes, 
      services, 
      currentPlan 
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
      address,
      oldWebsite,
      taxId,
      notes,
      services,
      currentPlan,
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
    next(error);
  }
};

// @desc    Get all clients
// @route   GET /api/v1/clients
// @access  Private/Admin
export const getAllClients = async (req, res, next) => {
  try {
    console.log('Fetching all clients...');
    
    // Find all clients and populate related data
    // Use strictPopulate: false to handle missing references gracefully
    const clients = await Client.find({})
      .populate({
        path: 'user',
        select: 'email fName lName phone',
        strictPopulate: false
      })
      .populate({
        path: 'services',
        select: 'name',
        strictPopulate: false
      })
      .populate({
        path: 'currentPlan',
        select: 'name price',
        strictPopulate: false
      })
      .lean(); // Use lean() to get plain objects for better performance

    console.log(`Successfully fetched ${clients.length} clients`);

    res.status(200).json({
      status: 'success',
      results: clients.length,
      data: {
        clients
      }
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    // Return a more detailed error in development
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({
        status: 'error',
        message: error.message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
    }
    
    next(error);
  }
};

// @desc    Get single client
// @route   GET /api/v1/clients/:id
// @access  Private
export const getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('user', 'email fName lName phone')
      .populate('services', 'name description')
      .populate('currentPlan');

    if (!client) {
      return next(new AppError('No client found with that ID', 404));
    }

    // Check if the user has permission to access this client
    if (req.user.role !== 'admin' && client.user._id.toString() !== req.user.id) {
      return next(new AppError('Not authorized to access this client', 403));
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
    const { companyName, address, oldWebsite, taxId, notes, services, currentPlan, isActive } = req.body;
    
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
        isActive
      },
      {
        new: true,
        runValidators: true
      }
    );

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
// @route   GET /api/v1/clients/user/:userId
// @access  Private
export const getClientByUser = async (req, res, next) => {
  try {
    const client = await Client.findOne({ user: req.params.userId })
      .populate('user', 'email fName lName phone')
      .populate('services', 'name description')
      .populate('currentPlan');

    if (!client) {
      return next(new AppError('No client found for this user', 404));
    }

    // Check if the user has permission to access this client
    if (req.user.role !== 'admin' && client.user._id.toString() !== req.user.id) {
      return next(new AppError('Not authorized to access this client', 403));
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

    client.isActive = !client.isActive;
    await client.save();

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
