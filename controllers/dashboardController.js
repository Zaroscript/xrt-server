import User from '../models/User.js';
import Project from '../models/Project.js';
import Ticket from '../models/Ticket.js';
import Subscriber from '../models/Subscriber.js';
import Client from '../models/Client.js';
import { AppError } from '../utils/errors.js';

// Get dashboard statistics
export const getDashboardStats = async (req, res, next) => {
  try {
    // Get user count
    const totalUsers = await User.countDocuments();
    
    // Get active users (users created in the last 30 days or approved users)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [
      activeUsers,
      totalClients,
      totalTickets,
      subscribers,
      activeSubscribers,
      pendingTickets,
      portfolioProjects
    ] = await Promise.all([
      User.countDocuments({
        $or: [
          { createdAt: { $gte: thirtyDaysAgo } },
          { isApproved: true, isActive: true }
        ]
      }),
      Client.countDocuments(),
      Ticket.countDocuments(),
      Subscriber.find({ 'paymentHistory.status': 'completed' }).select('paymentHistory'),
      Subscriber.find({
        'subscription.status': 'active',
        isActive: true
      }).populate('subscription.plan', 'price billingCycle'),
      Ticket.countDocuments({ status: 'open' }),
      Project.countDocuments()
    ]);
    
    // Calculate total revenue
    let totalRevenue = 0;
    
    // From payment history
    subscribers.forEach(subscriber => {
      if (subscriber.paymentHistory?.length) {
        subscriber.paymentHistory.forEach(payment => {
          if (payment.status === 'completed' && payment.amount) {
            totalRevenue += payment.amount;
          }
        });
      }
    });
    
    // From active plans
    activeSubscribers.forEach(subscriber => {
      if (subscriber.plan?.price) {
        totalRevenue += subscriber.plan.billingCycle === 'yearly'
          ? subscriber.plan.price / 12
          : subscriber.plan.price;
      }
    });
    
    // Get active plans count
    const activePlans = activeSubscribers.length;
    
    res.status(200).json({
      status: 'success',
      data: {
        totalUsers,
        totalClients,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTickets,
        activeUsers,
        activePlans,
        pendingTickets,
        portfolioProjects
      }
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    next(new AppError('Failed to fetch dashboard statistics', 500));
  }
};

// Get recent activities
// Get tickets statistics
export const getTicketsStats = async (req, res, next) => {
  try {
    // Get tickets from the last 6 months, grouped by week
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const tickets = await Ticket.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            week: { $week: '$createdAt' }
          },
          open: {
            $sum: {
              $cond: [{ $eq: ['$status', 'open'] }, 1, 0]
            }
          },
          resolved: {
            $sum: {
              $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0]
            }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } }
    ]);

    // Format the data for the frontend
    const formattedData = tickets.map(item => ({
      week: `Week ${item._id.week}, ${item._id.year}`,
      open: item.open,
      resolved: item.resolved,
      total: item.total
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    next(new AppError('Error fetching ticket statistics', 500));
  }
};

// Get users growth data
export const getUsersGrowth = async (req, res, next) => {
  try {
    // Get users and clients data from the last 12 months, grouped by month
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const usersData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const clientsData = await Client.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format the data for the frontend
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const formattedData = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - 11 + i);
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = months[date.getMonth()];
      
      const users = usersData.find(d => d._id.year === year && d._id.month === month)?.count || 0;
      const clients = clientsData.find(d => d._id.year === year && d._id.month === month)?.count || 0;
      
      formattedData.push({
        month: `${monthName} ${year}`,
        users,
        clients
      });
    }

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching users growth data:', error);
    next(new AppError('Error fetching users growth data', 500));
  }
};

// Get revenue data
export const getRevenueData = async (req, res, next) => {
  try {
    // Get revenue data from the last 6 months, grouped by month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const revenueData = await Subscriber.aggregate([
      {
        $match: {
          'paymentHistory.status': 'completed',
          'paymentHistory.paidAt': { $gte: sixMonthsAgo }
        }
      },
      { $unwind: '$paymentHistory' },
      {
        $match: {
          'paymentHistory.status': 'completed',
          'paymentHistory.paidAt': { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentHistory.paidAt' },
            month: { $month: '$paymentHistory.paidAt' }
          },
          revenue: { $sum: '$paymentHistory.amount' },
          users: { $addToSet: '$user' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format the data for the frontend
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const formattedData = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - 5 + i);
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = months[date.getMonth()];
      
      const monthData = revenueData.find(d => d._id.year === year && d._id.month === month);
      
      formattedData.push({
        month: `${monthName} ${year}`,
        revenue: monthData?.revenue || 0,
        users: monthData?.users?.length || 0
      });
    }

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    next(new AppError('Error fetching revenue data', 500));
  }
};

export const getRecentActivities = async (req, res, next) => {
  try {
    // Get recent user signups
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('fName lName email createdAt');
    
    // Get recent tickets
    const recentTickets = await Ticket.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'fName lName email')
      .select('title status createdAt');
    
    // Get recent projects
    const recentProjects = await Project.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'fName lName email')
      .select('title status createdAt');
    
    // Get recent subscribers
    const recentSubscribers = await Subscriber.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('user', 'fName lName email')
      .select('subscription createdAt');
    
    // Format activities
    const activities = [];
    
    // Add user signups to activities
    recentUsers.forEach(user => {
      activities.push({
        id: user._id.toString(),
        type: 'user_signup',
        message: `New user registered: ${user.email}`,
        timestamp: user.createdAt.toISOString(),
        user: `${user.fName || ''} ${user.lName || ''}`.trim() || user.email
      });
    });
    
    // Add tickets to activities
    recentTickets.forEach(ticket => {
      activities.push({
        id: ticket._id.toString(),
        type: 'support_ticket',
        message: `New support ticket: ${ticket.title}`,
        timestamp: ticket.createdAt.toISOString(),
        user: ticket.user ? `${ticket.user.fName || ''} ${ticket.user.lName || ''}`.trim() || ticket.user.email : 'System'
      });
    });
    
    // Add projects to activities
    recentProjects.forEach(project => {
      activities.push({
        id: project._id.toString(),
        type: 'project_created',
        message: `New project created: ${project.title}`,
        timestamp: project.createdAt.toISOString(),
        user: project.user ? `${project.user.fName || ''} ${project.user.lName || ''}`.trim() || project.user.email : 'System'
      });
    });
    
    // Add subscribers to activities
    recentSubscribers.forEach(subscriber => {
      if (subscriber.user) {
        activities.push({
          id: subscriber._id.toString(),
          type: 'payment',
          message: `New subscription: ${subscriber.subscription?.plan || 'Plan'}`,
          timestamp: subscriber.createdAt.toISOString(),
          user: `${subscriber.user.fName || ''} ${subscriber.user.lName || ''}`.trim() || subscriber.user.email
        });
      }
    });
    
    // Sort activities by timestamp (newest first) and limit to 10
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
    
    res.status(200).json({
      status: 'success',
      data: sortedActivities
    });
    
  } catch (error) {
    console.error('Recent activities error:', error);
    next(new AppError('Failed to fetch recent activities', 500));
  }
};
