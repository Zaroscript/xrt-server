// scripts/seedPlans.js
import 'dotenv/config';
import mongoose from 'mongoose';
import Plan from '../models/Plan.js';

const plans = [
  {
    name: "Start Plan — Get Online Fast",
    description: "Perfect for small businesses getting started with online ordering",
    price: 15,
    billingCycle: "monthly",
    features: [
      "Branded online ordering website (your domain)",
      "Secure payment integration (Stripe, PayPal, etc.)",
      "Menu management with unlimited items",
      "Real-time order notifications",
      "Mobile-friendly design",
      "Hosting & maintenance included",
      "Unlimited orders — no commissions",
      "Basic analytics dashboard",
      "24/7 technical support"
    ],
    maxRestaurants: 1,
    isActive: true,
    isFeatured: false,
    discount: {
      amount: 21,
      isActive: true,
      code: "START21",
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-12-31T23:59:59.999Z')
    },
    discountedPrice: 11.85 // 15 * 0.79 (21% off)
  },
  {
    name: "Grow Plan",
    description: "For growing businesses with multiple locations",
    price: 25,
    billingCycle: "monthly",
    features: [
      "All in Start Plan",
      "Multi-location support (up to 3)",
      "WhatsApp / SMS order alerts",
      "Discount codes, loyalty rewards & scheduled promotions",
      "Cloud backup & secure data storage",
      "POS & delivery app integrations",
      "Automated customer receipts & follow-ups",
      "Priority support"
    ],
    maxRestaurants: 3,
    isActive: true,
    isFeatured: true,
    discount: {
      amount: 21,
      isActive: true,
      code: "GROW21",
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-12-31T23:59:59.999Z')
    },
    discountedPrice: 19.75 // 25 * 0.79 (21% off)
  },
  {
    name: "Success Plan",
    description: "For established businesses with advanced needs",
    price: 35,
    billingCycle: "monthly",
    features: [
      "All in Grow Plan",
      "Unlimited branches & users",
      "Custom design & white-label branding",
      "API integrations (POS, ERP, delivery)",
      "Custom feature development",
      "Centralized admin dashboard",
      "Data insights & reporting portal",
      "Dedicated account manager",
      "Advanced automation tools",
      "24/7 premium support"
    ],
    maxRestaurants: 0,
    isActive: true,
    isFeatured: false,
    discount: {
      amount: 21,
      isActive: true,
      code: "SUCCESS21",
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2025-12-31T23:59:59.999Z')
    },
    discountedPrice: 27.65 // 35 * 0.79 (21% off)
  }
];

const seedPlans = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in your .env file');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected...');

    // Clear existing plans
    await Plan.deleteMany({});
    console.log('Cleared existing plans');

    // Insert new plans
    const createdPlans = await Plan.insertMany(plans);
    console.log(`Successfully seeded ${createdPlans.length} monthly plans`);

    // Create yearly versions of each plan with 10% discount (on top of any existing discount)
    const yearlyPlans = plans.map(plan => {
      const yearlyPrice = Math.round(plan.price * 12 * 0.9 * 100) / 100; // 10% off yearly
      return {
        ...plan,
        name: `${plan.name} (Yearly)`,
        price: yearlyPrice,
        billingCycle: 'yearly',
        discount: {
          ...plan.discount,
          code: `${plan.discount.code}YEARLY`
        },
        discountedPrice: Math.round(yearlyPrice * 0.79 * 100) / 100 // Apply 21% discount to yearly price
      };
    });

    const createdYearlyPlans = await Plan.insertMany(yearlyPlans);
    console.log(`Successfully created ${createdYearlyPlans.length} yearly plans`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding plans:', error);
    process.exit(1);
  }
};

seedPlans();