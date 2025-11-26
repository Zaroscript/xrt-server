import Request from "../models/Request.js";
import Client from "../models/Client.js";
import Service from "../models/Service.js";
import Plan from "../models/Plan.js";
import Subscriber from "../models/Subscriber.js";
import { AppError } from "../utils/errors.js";

// @desc    Create a new request
// @route   POST /api/v1/requests
// @access  Private/Client
export const createRequest = async (req, res, next) => {
  try {
    const { type, requestedItemId, notes } = req.body;

    if (!type || !requestedItemId) {
      return next(new AppError("Type and requested item are required", 400));
    }

    // Get client
    const client = await Client.findOne({ user: req.user.id });
    if (!client) {
      return next(new AppError("Client profile not found", 404));
    }

    // Verify the requested item exists
    let requestedItem;
    if (type === "service") {
      requestedItem = await Service.findById(requestedItemId);
      if (!requestedItem) {
        return next(new AppError("Service not found", 404));
      }
    } else if (type === "plan_change") {
      requestedItem = await Plan.findById(requestedItemId);
      if (!requestedItem) {
        return next(new AppError("Plan not found", 404));
      }
    } else {
      return next(new AppError("Invalid request type", 400));
    }

    // Create request
    const request = await Request.create({
      client: client._id,
      user: req.user.id,
      type,
      requestedItem: requestedItemId,
      notes,
    });

    // Populate for response
    await request.populate([
      { path: "client", select: "companyName" },
      { path: "user", select: "email fName lName" },
      { path: "requestedItem" },
    ]);

    res.status(201).json({
      status: "success",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's own requests
// @route   GET /api/v1/requests/my-requests
// @access  Private/Client
export const getMyRequests = async (req, res, next) => {
  try {
    const requests = await Request.find({ user: req.user.id })
      .populate("requestedItem")
      .populate("processedBy", "fName lName email")
      .sort("-createdAt");

    res.status(200).json({
      status: "success",
      results: requests.length,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a pending request
// @route   PATCH /api/v1/requests/:id/cancel
// @access  Private/Client
export const cancelRequest = async (req, res, next) => {
  try {
    const request = await Request.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!request) {
      return next(new AppError("Request not found", 404));
    }

    if (!request.canBeCancelled()) {
      return next(new AppError("Only pending requests can be cancelled", 400));
    }

    request.status = "cancelled";
    await request.save();

    res.status(200).json({
      status: "success",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all requests (Admin)
// @route   GET /api/v1/requests
// @access  Private/Admin
export const getAllRequests = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (page - 1) * limit;

    const requests = await Request.find(filter)
      .populate({
        path: "client",
        select: "companyName user",
        populate: { path: "user", select: "email fName lName phone" },
      })
      .populate("user", "email fName lName phone")
      .populate("requestedItem")
      .populate("processedBy", "fName lName email")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Request.countDocuments(filter);

    res.status(200).json({
      status: "success",
      results: requests.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: {
        requests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single request (Admin)
// @route   GET /api/v1/requests/:id
// @access  Private/Admin
export const getRequest = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate("client")
      .populate("user", "email fName lName phone")
      .populate("requestedItem")
      .populate("processedBy", "fName lName email");

    if (!request) {
      return next(new AppError("Request not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve request (Admin)
// @route   PATCH /api/v1/requests/:id/approve
// @access  Private/Admin
export const approveRequest = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate("client")
      .populate("requestedItem");

    if (!request) {
      return next(new AppError("Request not found", 404));
    }

    if (!request.canBeProcessed()) {
      return next(new AppError("Only pending requests can be approved", 400));
    }

    // Execute the request based on type
    if (request.type === "service") {
      // Add service to client
      const clientId = request.client._id || request.client;
      const client = await Client.findById(clientId);

      if (!client) {
        return next(new AppError("Client not found", 404));
      }

      if (!client.services) {
        client.services = [];
      }

      // Check if service already exists
      const existingService = client.services.find(
        (s) =>
          s.service &&
          s.service.toString() === request.requestedItem._id.toString()
      );

      if (!existingService) {
        client.services.push({
          service: request.requestedItem._id,
          customPrice: request.requestedItem.basePrice || 0,
          startDate: new Date(),
          status: "active",
          assignedBy: req.user.id,
          assignedAt: new Date(),
        });
        await client.save();
      }
    } else if (request.type === "plan_change") {
      // Update client plan
      const clientId = request.client._id || request.client;
      const client = await Client.findById(clientId);
      
      if (!client) {
        return next(new AppError("Client not found", 404));
      }
      
      client.currentPlan = request.requestedItem._id;
      await client.save();

      // Create or update subscriber with proper plan details
      let subscriber = await Subscriber.findOne({ user: request.user });
      
      const planDetails = {
        plan: request.requestedItem._id,
        price: request.requestedItem.price,
        billingCycle: request.requestedItem.billingCycle || (request.requestedItem.duration === 12 ? 'annually' : 'monthly'),
        startDate: new Date(),
        status: 'active'
      };

      if (subscriber) {
        subscriber.plan = planDetails;
        subscriber.status = 'active';
        await subscriber.save();
      } else {
        subscriber = await Subscriber.create({
          user: request.user,
          plan: planDetails,
          status: 'active',
        });
      }
    }

    // Update request - handle both adminNote and adminNotes
    request.status = "approved";
    request.processedBy = req.user.id;
    request.processedAt = new Date();
    const adminNote = req.body.adminNote || req.body.adminNotes;
    if (adminNote) {
      request.adminNotes = adminNote;
    }
    await request.save();

    res.status(200).json({
      status: "success",
      message: "Request approved successfully",
      data: request,
    });
  } catch (error) {
    console.error("Error approving request:", error);
    next(error);
  }
};

// @desc    Reject request (Admin)
// @route   PATCH /api/v1/requests/:id/reject
// @access  Private/Admin
export const rejectRequest = async (req, res, next) => {
  try {
    const { adminNotes } = req.body;

    const request = await Request.findById(req.params.id);

    if (!request) {
      return next(new AppError("Request not found", 404));
    }

    if (!request.canBeProcessed()) {
      return next(new AppError("Only pending requests can be rejected", 400));
    }

    request.status = "rejected";
    request.processedBy = req.user.id;
    request.processedAt = new Date();
    request.adminNotes = adminNotes || "Request rejected";
    await request.save();

    res.status(200).json({
      status: "success",
      message: "Request rejected",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update request (Admin)
// @route   PATCH /api/v1/requests/:id
// @access  Private/Admin
export const updateRequest = async (req, res, next) => {
  try {
    const { notes, adminNotes } = req.body;

    const request = await Request.findById(req.params.id);

    if (!request) {
      return next(new AppError("Request not found", 404));
    }

    if (notes) request.notes = notes;
    if (adminNotes) request.adminNotes = adminNotes;

    await request.save();

    res.status(200).json({
      status: "success",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};
