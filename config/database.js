import mongoose from 'mongoose';

// Keep track of connection status
let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

// Connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  family: 4,
  retryWrites: true,
  w: 'majority'
};

// Handle connection events
const setupEventHandlers = () => {
  mongoose.connection.on('connected', () => {
    isConnected = true;
    retryCount = 0;
    console.log('✅ MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
    isConnected = false;
    
    // Auto-reconnect on error
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`⏳ Attempting to reconnect (${retryCount}/${MAX_RETRIES})...`);
      setTimeout(connectDB, RETRY_DELAY);
    } else {
      console.error('❌ Max reconnection attempts reached. Please check your MongoDB connection.');
    }
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
    isConnected = false;
    
    // Auto-reconnect on disconnect
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`⏳ Attempting to reconnect (${retryCount}/${MAX_RETRIES})...`);
      setTimeout(connectDB, RETRY_DELAY);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('🔴 MongoDB connection closed (App terminated)');
      process.exit(0);
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
      process.exit(1);
    }
  });
};

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('🟢 Using existing MongoDB connection');
    return mongoose;
  }

  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    
    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    // Connect with retry logic
    const connectWithRetry = async (attempt = 1) => {
      try {
        await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
        return mongoose;
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          console.log(`⏳ Connection attempt ${attempt} failed. Retrying in ${RETRY_DELAY / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return connectWithRetry(attempt + 1);
        }
        throw err; // Re-throw after max retries
      }
    };

    // Set up event handlers
    setupEventHandlers();
    
    // Attempt to connect
    return await connectWithRetry();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
};

export default connectDB;
