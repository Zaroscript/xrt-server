import Client from "../models/Client.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import ActivityLog from "../models/ActivityLog.js";
import Subscription from "../models/Subscription.js";
import Subscriber from "../models/Subscriber.js";
import Invoice from "../models/Invoice.js";
import Service from "../models/Service.js";
import Plan from "../models/Plan.js";
import { AppError } from "../utils/errors.js";

/**
 * Get full client details with all related data
 * GET /api/admin/clients/:id/full-details
 */
export const getClientFullDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const client = await Client.findById(id)
      .populate(
        "user",
        "fName lName email phone role isApproved createdAt plainPassword status"
      )
      .populate("currentPlan")
      .populate("services.service")
      .populate("services.service")
      .populate("services.assignedBy", "fName lName email");

    if (client && client.user) {
      console.log("DEBUG: getClientFullDetails - User:", {
        id: client.user._id,
        email: client.user.email,
        hasPlainPassword: !!client.user.plainPassword,
        plainPassword: client.user.plainPassword, // TEMPORARY DEBUG
      });
    }

    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    // Get subscription details
    const subscription = await Subscription.findOne({ client: id })
      .populate("plan")
      .sort({ createdAt: -1 });

    // Get activity logs (last 20)
    const activityLogs = await ActivityLog.getUserLogs(client.user._id, {
      limit: 20,
    });

    // Get invoices
    const invoices = await Invoice.find({ client: id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      status: "success",
      data: {
        client,
        subscription,
        activityLogs,
        invoices,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get client activity logs with filters
 * GET /api/admin/clients/:id/activity-logs
 */
export const getClientActivityLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actionType, startDate, endDate, limit = 50, skip = 0 } = req.query;

    const client = await Client.findById(id).populate("user");
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    const logs = await ActivityLog.getUserLogs(client.user._id, {
      actionType,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });

    const total = await ActivityLog.countDocuments({ user: client.user._id });

    res.status(200).json({
      status: "success",
      data: {
        logs,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign subscription to client with custom pricing
 * POST /api/admin/clients/:id/subscription/assign
 */
export const assignSubscriptionToClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      planId,
      customPrice,
      discount = 0,
      billingCycle,
      startDate,
      generateInvoice = true,
    } = req.body;

    // Validate inputs
    if (!planId || !billingCycle) {
      return next(new AppError("Plan ID and billing cycle are required", 400));
    }

    const client = await Client.findById(id).populate("user");
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return next(new AppError("Plan not found", 404));
    }

    // Calculate pricing
    const basePrice = customPrice || plan.price;
    const discountAmount = (basePrice * discount) / 100;
    const finalPrice = basePrice - discountAmount;

    // Calculate dates
    const subStartDate = startDate ? new Date(startDate) : new Date();
    let endDate = new Date(subStartDate);

    switch (billingCycle) {
      case "monthly":
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case "quarterly":
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case "annually":
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    // Find or create subscriber
    // Get user ID - handle both populated and non-populated cases
    const userId = client.user?._id || client.user;

    if (!userId) {
      return next(
        new AppError(
          "Client has no associated user. Please ensure the client has a valid user account.",
          400
        )
      );
    }

    let subscriber = await Subscriber.findOne({ user: userId });

    if (subscriber) {
      // Update existing subscriber plan
      subscriber.plan = {
        plan: planId,
        status: "active",
        startDate: subStartDate,
        endDate: endDate,
        billingCycle,
        price: finalPrice,
        features: plan.features || [],
        customPrice: customPrice || null,
        discount: discount || 0,
      };
    } else {
      // Create new subscriber
      subscriber = new Subscriber({
        user: userId,
        plan: {
          plan: planId,
          status: "active",
          startDate: subStartDate,
          endDate: endDate,
          billingCycle,
          price: finalPrice,
          features: plan.features || [],
          customPrice: customPrice || null,
          discount: discount || 0,
        },
      });
    }

    await subscriber.save();

    // Update client's current plan
    client.currentPlan = planId;
    await client.save();

    // Generate invoice if requested
    let invoice = null;
    if (generateInvoice) {
      invoice = await Invoice.create({
        client: id,
        user: userId,
        subtotal: finalPrice,
        tax: 0,
        total: finalPrice,
        status: "draft",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        items: [
          {
            description: `${plan.name} - ${billingCycle} subscription`,
            quantity: 1,
            unitPrice: finalPrice,
            taxRate: 0,
          },
        ],
        notes: `Initial subscription assignment for ${plan.name}`,
      });
    }

    // Log activity
    await ActivityLog.createLog({
      user: userId,
      actionType: "subscription_created",
      description: `Subscription assigned: ${plan.name} (${billingCycle})`,
      performedBy: req.user._id,
      metadata: { planId, customPrice, discount, finalPrice, billingCycle },
      relatedModel: "Subscription",
      relatedId: subscriber._id,
    });

    res.status(201).json({
      status: "success",
      data: {
        subscription: await subscriber.populate("plan.plan"),
        invoice,
      },
    });
  } catch (error) {
    console.error("Error in assignSubscriptionToClient:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      clientId: req.params.id,
      requestBody: req.body,
    });
    next(error);
  }
};

/**
 * Renew client subscription
 * PATCH /api/admin/clients/:id/subscription/renew
 */
export const renewClientSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { months = 1 } = req.body; // Number of months to renew

    console.log("=== RENEW SUBSCRIPTION DEBUG ===");
    console.log("Client ID:", id);
    console.log("Months:", months);

    const client = await Client.findById(id).populate("user");
    if (!client) {
      console.log("Client not found");
      return next(new AppError("Client not found", 404));
    }
    console.log("Client found:", client._id);
    console.log("User ID:", client.user._id);

    // Find subscriber data
    const subscriber = await Subscriber.findOne({
      user: client.user._id,
    }).populate("plan.plan");

    console.log("Subscriber found:", subscriber ? "YES" : "NO");
    if (subscriber) {
      console.log("Subscriber ID:", subscriber._id);
      console.log("Has plan:", subscriber.plan ? "YES" : "NO");
      if (subscriber.plan) {
        console.log("Plan status:", subscriber.plan.status);
        console.log(
          "Plan.plan populated:",
          subscriber.plan.plan ? "YES" : "NO"
        );
      }
    }

    if (!subscriber || !subscriber.plan) {
      console.log("No active subscription found");
      return next(new AppError("No active subscription found", 404));
    }

    // Calculate new end date based on current end date or now
    const currentEndDate = new Date(subscriber.plan.endDate);
    const now = new Date();
    const baseDate = currentEndDate > now ? currentEndDate : now;

    const newEndDate = new Date(baseDate);
    newEndDate.setMonth(newEndDate.getMonth() + months);

    console.log("Current end date:", currentEndDate);
    console.log("New end date:", newEndDate);

    // Update subscriber plan
    subscriber.plan.endDate = newEndDate;
    subscriber.plan.status = "active";
    await subscriber.save();

    console.log("Subscriber updated successfully");

    // Calculate pricing for invoice
    const plan = subscriber.plan.plan;
    const basePrice = subscriber.plan.customPrice || plan.price;
    const discountAmount = (basePrice * (subscriber.plan.discount || 0)) / 100;
    const finalPrice = basePrice - discountAmount;
    const totalAmount = finalPrice * months;

    console.log("Pricing calculated - Total:", totalAmount);

    // Generate renewal invoice
    const invoice = await Invoice.create({
      client: id,
      user: client.user._id,
      subtotal: totalAmount,
      tax: 0,
      total: totalAmount,
      status: "draft",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      items: [
        {
          description: `${plan.name} - Renewal (${months} month${
            months > 1 ? "s" : ""
          })`,
          quantity: months,
          unitPrice: finalPrice,
          taxRate: 0,
        },
      ],
      notes: `Subscription renewal for ${months} month${months > 1 ? "s" : ""}`,
    });

    console.log("Invoice created:", invoice._id);

    // Log activity
    await ActivityLog.createLog({
      user: client.user._id,
      actionType: "subscription_renewed",
      description: `Subscription renewed for ${plan.name} (${months} month${
        months > 1 ? "s" : ""
      })`,
      performedBy: req.user._id,
      metadata: {
        newEndDate: subscriber.plan.endDate,
        months,
        totalAmount,
      },
      relatedModel: "Subscription",
      relatedId: subscriber._id,
    });

    console.log("Activity logged");

    // Build response subscription object
    const subscriptionData = {
      _id: subscriber._id,
      plan: {
        _id: plan._id,
        name: plan.name,
        price: plan.price,
        features: plan.features || [],
      },
      status: subscriber.plan.status,
      billingCycle: subscriber.plan.billingCycle,
      customPrice: subscriber.plan.customPrice,
      discount: subscriber.plan.discount || 0,
      startDate: subscriber.plan.startDate,
      endDate: subscriber.plan.endDate,
    };

    console.log("=== RENEW SUCCESS ===");

    res.status(200).json({
      status: "success",
      data: {
        subscription: subscriptionData,
        invoice,
      },
    });
  } catch (error) {
    console.error("=== RENEW ERROR ===");
    console.error("Error details:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    next(error);
  }
};

/**
 * Cancel client subscription
 * DELETE /api/admin/clients/:id/subscription/cancel
 */
export const cancelClientSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const client = await Client.findById(id).populate("user");
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    // Find subscriber data
    const subscriber = await Subscriber.findOne({
      user: client.user._id,
    }).populate("plan.plan");

    if (!subscriber || !subscriber.plan) {
      return next(new AppError("No active subscription found", 404));
    }

    // Store plan name for logging before cancelling
    const planName = subscriber.plan.plan.name;

    // Update subscriber plan status to cancelled
    subscriber.plan.status = "cancelled";
    subscriber.plan.cancellationReason = reason || "Cancelled by admin";
    subscriber.plan.cancellationDate = new Date();
    await subscriber.save();

    // Clear the client's current plan
    client.currentPlan = null;
    await client.save();

    // Log activity
    await ActivityLog.createLog({
      user: client.user._id,
      actionType: "subscription_cancelled",
      description: `Subscription cancelled for ${planName}. Reason: ${
        reason || "Not specified"
      }`,
      performedBy: req.user._id,
      metadata: {
        reason,
        planName,
        cancellationDate: new Date(),
      },
      relatedModel: "Subscription",
      relatedId: subscriber._id,
    });

    res.status(200).json({
      status: "success",
      message: "Subscription cancelled successfully",
      data: {
        subscriber,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign service to client with custom pricing
 * POST /api/admin/clients/:id/services/assign
 */
export const assignServiceToClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      serviceId,
      customPrice,
      discount = 0,
      isRecurring = false,
      startDate,
      endDate,
      notes = "",
      customFeatures = [],
    } = req.body;

    if (!serviceId || customPrice === undefined) {
      return next(
        new AppError("Service ID and custom price are required", 400)
      );
    }

    const client = await Client.findById(id);
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return next(new AppError("Service not found", 404));
    }

    // Check if service already assigned
    const existingService = client.services.find(
      (s) => s.service.toString() === serviceId
    );
    if (existingService) {
      return next(new AppError("Service already assigned to this client", 400));
    }

    // Add service to client
    client.services.push({
      service: serviceId,
      customPrice,
      discount,
      startDate: startDate || new Date(),
      endDate: endDate || null,
      notes,
      assignedBy: req.user._id,
      status: "active",
    });

    await client.save();

    // Generate invoice
    const discountAmount = (customPrice * discount) / 100;
    const finalPrice = customPrice - discountAmount;

    const invoice = await Invoice.create({
      client: id,
      amount: finalPrice,
      originalAmount: service.price || customPrice,
      discount: discountAmount,
      status: "pending",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: [
        {
          description: `${service.name} - Service Assignment`,
          amount: finalPrice,
        },
      ],
    });

    // Log activity
    await ActivityLog.createLog({
      user: client.user,
      actionType: "service_assigned",
      description: `Service assigned: ${service.name}`,
      performedBy: req.user._id,
      metadata: { serviceId, customPrice, discount, finalPrice },
      relatedModel: "Service",
      relatedId: serviceId,
    });

    res.status(201).json({
      status: "success",
      data: {
        client: await client.populate("services.service"),
        invoice,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update assigned service
 * PATCH /api/admin/clients/:id/services/:serviceId/update
 */
export const updateClientService = async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;
    const { customPrice, discount, notes, status } = req.body;

    const client = await Client.findById(id);
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    const serviceIndex = client.services.findIndex(
      (s) => s.service.toString() === serviceId
    );
    if (serviceIndex === -1) {
      return next(new AppError("Service not found for this client", 404));
    }

    // Update service details
    if (customPrice !== undefined)
      client.services[serviceIndex].customPrice = customPrice;
    if (discount !== undefined)
      client.services[serviceIndex].discount = discount;
    if (notes !== undefined) client.services[serviceIndex].notes = notes;
    if (status) client.services[serviceIndex].status = status;

    await client.save();

    // Log activity
    await ActivityLog.createLog({
      user: client.user,
      actionType: "service_updated",
      description: `Service updated`,
      performedBy: req.user._id,
      metadata: { serviceId, customPrice, discount, status },
      relatedModel: "Service",
      relatedId: serviceId,
    });

    res.status(200).json({
      status: "success",
      data: {
        client: await client.populate("services.service"),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove service from client
 * DELETE /api/admin/clients/:id/services/:serviceId/remove
 */
export const removeClientService = async (req, res, next) => {
  try {
    const { id, serviceId } = req.params;

    const client = await Client.findById(id);
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    const serviceIndex = client.services.findIndex(
      (s) => s.service.toString() === serviceId
    );
    if (serviceIndex === -1) {
      return next(new AppError("Service not found for this client", 404));
    }

    client.services.splice(serviceIndex, 1);
    await client.save();

    // Log activity
    await ActivityLog.createLog({
      user: client.user,
      actionType: "service_removed",
      description: `Service removed from client`,
      performedBy: req.user._id,
      metadata: { serviceId },
      relatedModel: "Service",
      relatedId: serviceId,
    });

    res.status(200).json({
      status: "success",
      message: "Service removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset client password (Admin only)
 * POST /api/admin/clients/:id/reset-password
 */
export const resetClientPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword, generateRandom } = req.body;

    const client = await Client.findById(id).populate("user");
    if (!client) {
      return next(new AppError("Client not found", 404));
    }

    if (!client.user) {
      return next(
        new AppError(
          "Client has no associated user account. Cannot reset password.",
          400
        )
      );
    }

    let passwordToSet = newPassword;
    let temporaryPassword = null;

    // Generate random password if requested
    if (generateRandom) {
      const charset =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      passwordToSet = Array.from(
        { length: 12 },
        () => charset[Math.floor(Math.random() * charset.length)]
      ).join("");
      temporaryPassword = passwordToSet;
    }

    if (!passwordToSet) {
      return next(new AppError("Password is required", 400));
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(passwordToSet, 12);

    // Update user password
    const userId =
      typeof client.user === "object" ? client.user._id : client.user;

    console.log(
      "DEBUG: resetClientPassword - Updating user:",
      userId,
      "with plainPassword:",
      passwordToSet
    );

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      plainPassword: passwordToSet, // Update plain password for admin view
    });

    // Log activity
    await ActivityLog.createLog({
      user: userId,
      actionType: "password_change",
      description: `Password ${
        generateRandom ? "generated and" : ""
      } reset by admin`,
      performedBy: req.user._id,
      metadata: { generatedRandom: !!generateRandom },
    });

    res.status(200).json({
      status: "success",
      message: "Password reset successfully",
      data: {
        temporaryPassword: temporaryPassword || undefined,
      },
    });
  } catch (error) {
    console.error("Error resetting client password:", error);
    next(error);
  }
};
