export const samplePlans = [
  {
    name: 'Starter',
    description: 'Perfect for small businesses just getting started',
    price: 29.99,
    billingCycle: 'monthly',
    features: [
      'Up to 2 restaurants',
      'Basic analytics',
      'Email support',
      '5GB storage',
      'Basic customization'
    ],
    maxRestaurants: 2,
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Professional',
    description: 'For growing businesses with multiple locations',
    price: 79.99,
    billingCycle: 'monthly',
    features: [
      'Up to 10 restaurants',
      'Advanced analytics',
      'Priority support',
      '50GB storage',
      'Advanced customization',
      'API access',
      'Custom domain'
    ],
    maxRestaurants: 10,
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Enterprise',
    description: 'For large businesses with custom requirements',
    price: 199.99,
    billingCycle: 'monthly',
    features: [
      'Unlimited restaurants',
      'Advanced analytics',
      '24/7 VIP support',
      'Unlimited storage',
      'Fully customized solution',
      'Dedicated account manager',
      'Custom integrations',
      'SLA 99.9% uptime'
    ],
    maxRestaurants: 0, // 0 means unlimited
    isActive: true,
    isFeatured: true
  }
];

export const yearlyPlans = (plans) => {
  return plans.map(plan => ({
    ...plan,
    price: Math.round(plan.price * 10 * 12 * 0.9) / 10, // 10% discount for yearly billing
    billingCycle: 'yearly',
    name: `${plan.name} (Yearly)`
  }));
};
