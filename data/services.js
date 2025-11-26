// server/data/seedServices.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Service from '../models/Service.js';

// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(process.cwd(), '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath, override: true });

// Verify MongoDB URI is loaded
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ Error: MONGO_URI is not defined in your .env file');
  console.log('Current environment variables:', Object.keys(process.env).join(', '));
  process.exit(1);
}

const sampleServices = [
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

const seedSampleServices = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    console.log('🧹 Clearing existing services...');
    const deleteResult = await Service.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} services`);

    console.log('🌱 Seeding services...');
    const createdServices = await Service.insertMany(sampleServices);
    console.log(`✅ Successfully seeded ${createdServices.length} services`);

    console.log('🔌 Disconnecting from MongoDB...');
    await mongoose.connection.close();
    console.log('👋 MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding services:', error.message);
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
    }
    process.exit(1);
  }
};

// Run the seed function if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('🚀 Starting seed process...');
  seedSampleServices().catch(console.error);
}

export { sampleServices, seedSampleServices };