export const sampleServices = [
  {
    name: 'Website Development',
    description: 'Custom website development tailored to your restaurant\'s needs, including responsive design and SEO optimization.',
    category: 'web',
    features: [
      'Responsive design',
      'SEO optimization',
      'Contact forms',
      'Google Maps integration',
      'Menu integration'
    ],
    process: [
      'Initial consultation',
      'Design mockups',
      'Development',
      'Content integration',
      'Testing',
      'Launch'
    ],
    basePrice: 999.99,
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Social Media Management',
    description: 'Professional management of your restaurant\'s social media presence to engage customers and promote your brand.',
    category: 'marketing',
    features: [
      'Content creation',
      'Post scheduling',
      'Engagement monitoring',
      'Analytics reports',
      'Hashtag strategy'
    ],
    process: [
      'Strategy development',
      'Content calendar',
      'Content creation',
      'Scheduling & posting',
      'Performance analysis'
    ],
    basePrice: 499.99,
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Menu Photography',
    description: 'Professional food photography to showcase your dishes in the best possible light.',
    category: 'photography',
    features: [
      'Professional food styling',
      'High-resolution images',
      'Image retouching',
      'Multiple angles',
      'Digital delivery'
    ],
    process: [
      'Menu consultation',
      'Styling & setup',
      'Photoshoot',
      'Image selection',
      'Editing & delivery'
    ],
    basePrice: 799.99,
    isActive: true,
    isFeatured: true
  },
  {
    name: 'Online Ordering System',
    description: 'Custom online ordering system integrated with your website and POS system.',
    category: 'web',
    features: [
      'Customizable menu',
      'Online payments',
      'Order tracking',
      'Customer accounts',
      'Integration with POS'
    ],
    process: [
      'Requirements gathering',
      'System design',
      'Development',
      'Testing',
      'Deployment',
      'Training'
    ],
    basePrice: 1499.99,
    isActive: true,
    isFeatured: false
  },
  {
    name: 'Branding & Identity',
    description: 'Complete branding package including logo design, color scheme, and brand guidelines.',
    category: 'design',
    features: [
      'Logo design',
      'Color palette',
      'Typography',
      'Brand guidelines',
      'Business cards',
      'Menu design'
    ],
    process: [
      'Brand discovery',
      'Mood boards',
      'Concept development',
      'Revisions',
      'Final delivery'
    ],
    basePrice: 1299.99,
    isActive: true,
    isFeatured: true
  }
];

export const getServicesByCategory = (services) => {
  return services.reduce((acc, service) => {
    const category = service.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {});
};
