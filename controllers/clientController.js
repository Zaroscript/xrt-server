import mongoose from "mongoose";
import Client from "../models/Client.js";
import User from "../models/User.js";
import Service from "../models/Service.js";
import Plan from "../models/Plan.js";
import Subscriber from "../models/Subscriber.js";
import Invoice from "../models/Invoice.js";
import Request from "../models/Request.js";
import ActivityLog from "../models/ActivityLog.js";
import { AppError } from "../utils/errors.js";

// @desc    Get client statistics
// @route   GET /api/v1/clients/stats
// @access  Private/Admin
export const getClientStats = async (req, res, next) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Calculate revenue for this month from paid invoices
    const revenueStats = await Invoice.aggregate([
      {
        $match: {
          status: "paid",
          updatedAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
        },
      },
    ]);

    const revenueThisMonth =
      revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;

    // Get total clients count
    const totalClients = await Client.countDocuments();

    // Get active clients count
    const activeClients = await Client.countDocuments({ isActive: true });

    // Calculate average client value (lifetime)
    // This is a rough estimate based on total revenue / total clients
    // For a more accurate value, we'd need to sum all paid invoices ever
    const totalRevenueStats = await Invoice.aggregate([
      {
        $match: { status: "paid" },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
        },
      },
    ]);
    const totalLifetimeRevenue =
      totalRevenueStats.length > 0 ? totalRevenueStats[0].total : 0;
    const avgClientValue =
      totalClients > 0 ? totalLifetimeRevenue / totalClients : 0;

    // Calculate satisfaction (mock for now, or based on feedback if available)
    const satisfaction =
      totalClients > 0
        ? Math.min(100, Math.max(80, 100 - (totalClients % 20)))
        : 0;

    res.status(200).json({
      status: "success",
      data: {
        total: totalClients,
        active: activeClients,
        revenueThisMonth,
        avgClientValue,
        satisfaction: `${satisfaction}%`,
      },
    });
  } catch (error) {
    next(error);
  }
};

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
      services,
    } = req.body;

    let userId = user;

    // If email is provided but no user ID, create or find user
    if (email && !userId) {
      let existingUser = await User.findOne({ email: email.toLowerCase() });

      if (!existingUser) {
        // Create new user
        const tempPassword =
          password || `Temp${Date.now()}${Math.random().toString(36).slice(2)}`;
        existingUser = await User.create({
          email: email.toLowerCase(),
          password: tempPassword,
          fName: fName || "Client",
          lName: lName || "User",
          phone: phone,
          companyName: companyName || "Default Company", // Add required companyName
          role: "client",
          isApproved: true, // Auto-approve clients created by admin
          isActive: true,
          plainPassword: tempPassword, // Save plain password for admin view
        });
      }

      userId = existingUser._id;
    }

    if (!userId) {
      return next(new AppError("User ID or email is required", 400));
    }

    // Check if client already exists for this user
    const existingClient = await Client.findOne({ user: userId });
    if (existingClient) {
      return next(new AppError("Client already exists for this user", 400));
    }

    // Validate required fields
    if (!companyName) {
      return next(new AppError("Company name is required", 400));
    }

    const client = await Client.create({
      user: userId,
      companyName,
      businessLocation,
      oldWebsite,
      taxId,
      notes,
      services,
      isActive: true,
    });

    // Populate user data in response
    await client.populate("user", "email fName lName phone");

    res.status(201).json({
      status: "success",
      data: {
        client,
      },
    });
  } catch (error) {
    console.error("Create client error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      reqBody: req.body,
    });

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return next(new AppError(`Validation Error: ${errors.join(", ")}`, 400));
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return next(new AppError(`${field} already exists`, 400));
    }

    next(error);
  }
};

// @desc    Get all clients with filtering
// @route   GET /api/v1/clients
// @access  Private/Admin
export const getAllClients = async (req, res, next) => {
  try {
    const {
      status,
      search,
      tier,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 100,
      pending = false,
    } = req.query;

    // Build query
    let query = {};

    // Filter by pending status (clients with unapproved users)
    if (pending === "true" || pending === true) {
      query = {
        ...query,
        $or: [{ isActive: false }, { "user.isApproved": false }],
      };
    }

    // Filter by status
    if (status && status !== "all") {
      if (status === "pending") {
        query = {
          ...query,
          $or: [{ isActive: false }, { "user.isApproved": false }],
        };
      } else if (status === "active") {
        query = {
          ...query,
          isActive: true,
        };
      } else if (status === "inactive") {
        query = {
          ...query,
          isActive: false,
        };
      }
    }

    // Build base query using find() for better compatibility
    let findQuery = {};

    // Filter by status
    if (status && status !== "all") {
      if (status === "pending") {
        // Pending clients: isActive false OR user not approved
        findQuery.isActive = { $in: [true, false] }; // Get all, filter after populate
      } else if (status === "active") {
        findQuery.isActive = true;
      } else if (status === "inactive") {
        findQuery.isActive = false;
      } else if (status === "suspended") {
        // Suspended clients: user status is "suspended"
        findQuery = { ...findQuery, "user.status": "suspended" };
      } else if (status === "blocked") {
        // Blocked clients: user status is "blocked"
        findQuery = { ...findQuery, "user.status": "blocked" };
      } else if (status === "rejected") {
        // Rejected clients: user status is "rejected"
        findQuery = { ...findQuery, "user.status": "rejected" };
      }
    }

    // Fetch clients with population
    let clients = await Client.find(findQuery)
      .populate("user", "email fName lName phone status isApproved")
      .populate("services.service", "name description basePrice")
      .populate("currentPlan", "name price features billingCycle")
      .lean();

    // Apply pending filter after population
    if (status === "pending" || pending === "true" || pending === true) {
      clients = clients.filter((client) => {
        const user = client.user;
        return !client.isActive || (user && user.isApproved === false);
      });
    }

    // Apply active filter more strictly if needed
    if (status === "active") {
      clients = clients.filter((client) => {
        const user = client.user;
        return client.isActive && (!user || user.isApproved !== false);
      });
    }

    // Apply suspended filter
    if (status === "suspended") {
      clients = clients.filter((client) => {
        const user = client.user;
        return user && user.status === "suspended";
      });
    }

    // Apply blocked filter
    if (status === "blocked") {
      clients = clients.filter((client) => {
        const user = client.user;
        return user && user.status === "blocked";
      });
    }

    // Apply rejected filter
    if (status === "rejected") {
      clients = clients.filter((client) => {
        const user = client.user;
        return user && user.status === "rejected";
      });
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter((client) => {
        const user = client.user;
        return (
          client.companyName?.toLowerCase().includes(searchLower) ||
          user?.email?.toLowerCase().includes(searchLower) ||
          user?.fName?.toLowerCase().includes(searchLower) ||
          user?.lName?.toLowerCase().includes(searchLower) ||
          client.businessLocation?.city?.toLowerCase().includes(searchLower) ||
          client.businessLocation?.state?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply sorting
    const sortField =
      sortBy === "name"
        ? "companyName"
        : sortBy === "revenue"
        ? "revenue"
        : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    clients.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === "createdAt") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortField === "companyName") {
        aValue = (aValue || "").toLowerCase();
        bValue = (bValue || "").toLowerCase();
      }

      if (aValue < bValue) return -1 * sortDirection;
      if (aValue > bValue) return 1 * sortDirection;
      return 0;
    });

    // Calculate total count for pagination
    const totalCount = clients.length;

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedClients = clients.slice(startIndex, endIndex);

    res.status(200).json({
      status: "success",
      results: paginatedClients.length,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      data: {
        clients: paginatedClients,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Get single client
// @route   GET /api/v1/clients/:id
// @access  Private/Admin
export const getClient = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate({
        path: "user",
        select: "email fName lName phone status +plainPassword",
      })
      .populate("services.service", "name description basePrice")
      .populate("currentPlan");

    if (!client) {
      return next(new AppError("No client found with that ID", 404));
    }

    // Fetch subscriber data to get subscription details
    // Get user ID - handle both populated and non-populated cases
    const userId = client.user?._id || client.user;

    let subscription = null;
    if (userId) {
      const subscriber = await Subscriber.findOne({ user: userId }).populate(
        "plan.plan",
        "name price features billingCycle"
      );

      // Build subscription object for frontend if subscriber exists
      if (subscriber && subscriber.plan && subscriber.plan.plan) {
        subscription = {
          _id: subscriber._id,
          plan: {
            _id: subscriber.plan.plan._id,
            name: subscriber.plan.plan.name,
            price: subscriber.plan.plan.price,
            features: subscriber.plan.plan.features || [],
          },
          status: subscriber.plan.status,
          billingCycle: subscriber.plan.billingCycle,
          customPrice: subscriber.plan.customPrice,
          discount: subscriber.plan.discount || 0,
          startDate: subscriber.plan.startDate,
          endDate: subscriber.plan.endDate,
        };
      }
    }

    // Merge subscription data into client object
    const clientData = client.toObject();
    clientData.subscription = subscription;

    res.status(200).json({
      status: "success",
      data: {
        client: clientData,
      },
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
    const {
      companyName,
      address,
      oldWebsite,
      taxId,
      notes,
      services,
      currentPlan,
      isActive,
      subscription,
    } = req.body;

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
        lastActivity: new Date().toISOString(),
      },
      { new: true, runValidators: true }
    )
      .populate("user", "email fName lName phone")
      .populate("services", "name description")
      .populate("currentPlan");

    if (!client) {
      return next(new AppError("No client found with that ID", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        client,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete client
// @route   DELETE /api/v1/clients/:id
// @access  Private/Admin
export const deleteClient = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const client = await Client.findById(req.params.id).session(session);

    if (!client) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError("No client found with that ID", 404));
    }

    // Store the user ID before deleting the client
    const userId = client.user;

    // Delete the client
    await Client.findByIdAndDelete(req.params.id).session(session);

    // Delete the associated user
    if (userId) {
      await User.findByIdAndDelete(userId).session(session);
    }

    await session.commitTransaction();
    session.endSession();

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// @desc    Get client by user ID
// @route   GET /api/v1/clients/user/me (for client) OR /api/v1/clients/user/:userId (for admin)
// @access  Private
export const getClientByUser = async (req, res, next) => {
  try {
    // If userId param is present (admin route), use it. Otherwise use req.user.id (client/me route)
    const targetUserId = req.params.userId || req.user.id;

    const client = await Client.findOne({ user: targetUserId })
      .populate("user", "email fName lName phone")
      .populate("services", "name description")
      .populate("currentPlan");

    if (!client) {
      return next(new AppError("No client found for that user", 404));
    }

    // Fetch subscriber data to get subscription details
    const userId = client.user._id || client.user;
    let subscription = null;

    if (userId) {
      const subscriber = await Subscriber.findOne({ user: userId }).populate(
        "plan.plan",
        "name price features billingCycle"
      );

      if (subscriber) {
        // Auto-update status if expired
        await subscriber.updatePlanStatus();

        // Re-populate to ensure updated status is loaded
        await subscriber.populate("plan.plan");

        // Build subscription object for frontend
        if (subscriber.plan && subscriber.plan.plan) {
          subscription = {
            _id: subscriber._id,
            plan: {
              _id: subscriber.plan.plan._id,
              name: subscriber.plan.plan.name,
              price: subscriber.plan.plan.price,
              features: subscriber.plan.plan.features || [],
            },
            status: subscriber.plan.status,
            billingCycle: subscriber.plan.billingCycle,
            customPrice: subscriber.plan.customPrice,
            discount: subscriber.plan.discount || 0,
            startDate: subscriber.plan.startDate,
            endDate: subscriber.plan.endDate,
          };
        }
      }
    }

    // Merge subscription data into client object
    const clientData = client.toObject();
    clientData.subscription = subscription;

    res.status(200).json({
      status: "success",
      data: {
        client: clientData,
      },
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
      return next(new AppError("No client found with that ID", 404));
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
      status: "success",
      data: {
        client,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve client
// @route   PATCH /api/v1/clients/:id/approve
// @access  Private/Admin
export const approveClient = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const client = await Client.findById(req.params.id)
      .populate("user", "email fName lName phone isApproved status")
      .session(session);

    if (!client) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError("No client found with that ID", 404));
    }

    // Approve the client (set isActive to true)
    client.isActive = true;
    await client.save({ session });

    // Also approve the associated user if exists
    if (client.user) {
      const userId = client.user._id || client.user;
      await User.findByIdAndUpdate(
        userId,
        {
          isApproved: true,
          status: "active",
          isActive: true,
        },
        { new: true, session }
      );
    }

    // Log the activity
    const userId = client.user?._id || client.user;
    if (userId) {
      await ActivityLog.create(
        [
          {
            user: userId, // The client user
            actionType: "admin_action",
            description: `Client ${client.companyName} approved by admin`,
            performedBy: req.user.id, // The admin who performed the action
            relatedModel: "Client",
            relatedId: client._id,
            metadata: {
              clientName: client.companyName,
              approvedBy: req.user.id,
              action: "approve_client",
            },
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Re-populate for response
    await client.populate("user", "email fName lName phone status isApproved");

    res.status(200).json({
      status: "success",
      message: "Client approved successfully",
      data: {
        client,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// @desc    Reject client
// @route   PATCH /api/v1/clients/:id/reject
// @access  Private/Admin
export const rejectClient = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;

    const client = await Client.findById(req.params.id)
      .populate("user", "email fName lName phone isApproved status")
      .session(session);

    if (!client) {
      await session.abortTransaction();
      session.endSession();
      return next(new AppError("No client found with that ID", 404));
    }

    // Reject the client (set isActive to false)
    client.isActive = false;
    await client.save({ session });

    // Also reject the associated user if exists
    if (client.user) {
      const userId = client.user._id || client.user;
      await User.findByIdAndUpdate(
        userId,
        {
          isApproved: false,
          status: "inactive",
          isActive: false,
        },
        { new: true, session }
      );
    }

    // Log the activity
    const userId = client.user?._id || client.user;
    if (userId) {
      await ActivityLog.create(
        [
          {
            user: userId, // The client user
            actionType: "admin_action",
            description: `Client ${client.companyName} rejected by admin${
              reason ? `: ${reason}` : ""
            }`,
            performedBy: req.user.id, // The admin who performed the action
            relatedModel: "Client",
            relatedId: client._id,
            metadata: {
              clientName: client.companyName,
              rejectedBy: req.user.id,
              reason: reason || "No reason provided",
              action: "reject_client",
            },
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Re-populate for response
    await client.populate("user", "email fName lName phone status isApproved");

    res.status(200).json({
      status: "success",
      message: "Client rejected successfully",
      data: {
        client,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// @desc    Get client activities
// @route   GET /api/v1/clients/:id/activities
// @access  Private
// @desc    Assign a service to a client with custom price
// @route   POST /api/v1/clients/:id/services
// @access  Private/Admin
export const assignServiceToClient = async (req, res, next) => {
  try {
    const { serviceId, customPrice, startDate, endDate, notes } = req.body;
    const { id } = req.params;

    // Validate input
    if (!serviceId) {
      return next(new AppError("Service ID is required", 400));
    }

    // Find client and service
    const client = await Client.findById(id);
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return next(new AppError("Service not found", 404));
    }

    // Create service assignment object
    const serviceAssignment = {
      service: serviceId,
      customPrice: customPrice || service.basePrice,
      startDate: startDate || new Date(),
      endDate: endDate || null,
      notes: notes || "",
      assignedBy: req.user.id,
      assignedAt: new Date(),
    };

    // Add service to client if not already assigned
    if (!client.services) {
      client.services = [];
    }

    // Check if service is already assigned
    const existingServiceIndex = client.services.findIndex(
      (s) => s.service && s.service.toString() === serviceId
    );

    if (existingServiceIndex >= 0) {
      // Update existing service assignment
      client.services[existingServiceIndex] = {
        ...client.services[existingServiceIndex].toObject(),
        ...serviceAssignment,
      };
    } else {
      // Add new service assignment
      client.services.push(serviceAssignment);
    }

    await client.save({ validateBeforeSave: false });

    // Populate service details in response
    await client.populate("services.service", "name description basePrice");

    // Auto-generate invoice for the service assignment
    const price = customPrice || service.basePrice;

    const invoice = await Invoice.create({
      client: id,
      user: client.user || req.user.id,
      subtotal: price,
      tax: 0,
      total: price,
      status: "draft",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days due
      items: [
        {
          description: `Service Assignment: ${service.name}`,
          durationType: "one-time",
          unitPrice: price,
          taxRate: 0,
        },
      ],
      notes:
        notes ||
        `Auto-generated invoice for service assignment: ${service.name}`,
    });

    res.status(200).json({
      status: "success",
      data: {
        client,
        invoice,
      },
    });
  } catch (error) {
    console.error("Assign service error:", error);
    next(error);
  }
};

// @desc    Remove a service from a client
// @route   DELETE /api/v1/clients/:id/services/:serviceId
// @access  Private/Admin
export const removeServiceFromClient = async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;

    const client = await Client.findById(id);
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    // Remove service from client
    client.services = client.services.filter(
      (s) => s.service && s.service.toString() !== serviceId
    );

    await client.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      data: {
        client,
      },
    });
  } catch (error) {
    console.error("Remove service error:", error);
    next(error);
  }
};

export const getClientActivities = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id).populate(
      "user",
      "email fName lName"
    );

    if (!client) {
      return next(new AppError("No client found with that ID", 404));
    }

    // Fetch real activities from database
    const activities = await ActivityLog.find({
      $or: [
        { user: client.user._id }, // Activities by/for the user
        { relatedId: client._id }, // Activities related to the client profile
        { relatedId: client.user._id }, // Activities related to the user
      ],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("performedBy", "fName lName email");

    // Transform to match frontend expected format
    const formattedActivities = activities.map((activity) => ({
      id: activity._id,
      type: activity.actionType,
      title: formatActivityTitle(activity.actionType),
      description: activity.description,
      timestamp: activity.createdAt,
      status: "success", // Activity logs are usually successful actions
      performedBy: activity.performedBy,
    }));

    res.status(200).json({
      status: "success",
      data: {
        activities: formattedActivities,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get client's own profile
// @route   GET /api/v1/clients/me
// @access  Private/Client or Admin
export const getMyClientProfile = async (req, res, next) => {
  try {
    const client = await Client.findOne({ user: req.user.id })
      .populate("services.service", "name description basePrice")
      .populate("currentPlan", "name price billingCycle features description");

    // If no client found, return null instead of error (for admins)
    // Admins can access this endpoint but won't have client records
    if (!client) {
      return res.status(200).json({
        status: "success",
        data: null,
      });
    }

    // Fetch subscriber data to get subscription details
    const userId = req.user.id;
    let subscription = null;

    const subscriber = await Subscriber.findOne({ user: userId }).populate(
      "plan.plan",
      "name price features billingCycle"
    );

    if (subscriber) {
      // Auto-update status if expired
      await subscriber.updatePlanStatus();

      // Re-populate to ensure updated status is loaded
      await subscriber.populate("plan.plan");

      // Build subscription object for frontend
      if (subscriber.plan && subscriber.plan.plan) {
        subscription = {
          _id: subscriber._id,
          plan: {
            _id: subscriber.plan.plan._id,
            name: subscriber.plan.plan.name,
            price: subscriber.plan.plan.price,
            features: subscriber.plan.plan.features || [],
          },
          status: subscriber.plan.status,
          billingCycle: subscriber.plan.billingCycle,
          customPrice: subscriber.plan.customPrice,
          discount: subscriber.plan.discount || 0,
          startDate: subscriber.plan.startDate,
          endDate: subscriber.plan.endDate,
        };
      }
    }

    // Merge subscription data into client object
    const clientData = client.toObject();
    clientData.subscription = subscription;

    res.status(200).json({
      status: "success",
      data: clientData,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update client's own profile
// @route   PATCH /api/v1/clients/me
// @access  Private/Client
export const updateMyClientProfile = async (req, res, next) => {
  try {
    const { companyName, businessLocation, oldWebsite, taxId } = req.body;

    // Only allow clients to update specific fields
    const allowedUpdates = {
      companyName,
      businessLocation,
      oldWebsite,
      taxId,
    };

    // Remove undefined values
    Object.keys(allowedUpdates).forEach(
      (key) => allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    const client = await Client.findOneAndUpdate(
      { user: req.user.id },
      allowedUpdates,
      { new: true, runValidators: true }
    )
      .populate("services.service", "name description basePrice")
      .populate("currentPlan", "name price billingCycle features description");

    if (!client) {
      return next(new AppError("Client profile not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: client,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request subscription/plan change
// @route   POST /api/v1/clients/subscription-change-request
// @access  Private/Client
export const requestSubscriptionChange = async (req, res, next) => {
  try {
    const { planId, reason } = req.body;

    if (!planId) {
      return next(new AppError("Plan ID is required", 400));
    }

    // Verify plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return next(new AppError("Plan not found", 404));
    }

    // Get client
    const client = await Client.findOne({ user: req.user.id });
    if (!client) {
      return next(new AppError("Client profile not found", 404));
    }

    // Create a proper Request object
    const request = await Request.create({
      client: client._id,
      user: req.user.id,
      type: "plan_change",
      requestedItem: planId,
      itemModel: "Plan",
      notes: reason,
    });

    // Populate for response
    await request.populate([
      { path: "client", select: "companyName" },
      { path: "user", select: "email fName lName" },
      { path: "requestedItem" },
    ]);

    res.status(200).json({
      status: "success",
      message: "Subscription change request submitted successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request new service
// @route   POST /api/v1/clients/service-request
// @access  Private/Client
export const requestNewService = async (req, res, next) => {
  try {
    const { serviceId, notes } = req.body;

    if (!serviceId) {
      return next(new AppError("Service ID is required", 400));
    }

    // Verify service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return next(new AppError("Service not found", 404));
    }

    // Get client
    const client = await Client.findOne({ user: req.user.id });
    if (!client) {
      return next(new AppError("Client profile not found", 404));
    }

    // Create a proper Request object
    const request = await Request.create({
      client: client._id,
      user: req.user.id,
      type: "service",
      requestedItem: serviceId,
      itemModel: "Service",
      notes,
    });

    // Populate for response
    await request.populate([
      { path: "client", select: "companyName" },
      { path: "user", select: "email fName lName" },
      { path: "requestedItem" },
    ]);

    res.status(200).json({
      status: "success",
      message: "Service request submitted successfully",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to format activity titles
const formatActivityTitle = (actionType) => {
  return actionType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
