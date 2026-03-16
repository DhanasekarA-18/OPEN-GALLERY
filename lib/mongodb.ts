import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGO_DB_URL || '';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGO_DB_URL environment variable inside .env');
}

declare global {
  var mongooseCached: {
    conn: typeof import("mongoose") | null;
    promise: Promise<typeof import("mongoose")> | null;
  };
}

let cached = global.mongooseCached;

if (!cached) {
  cached = global.mongooseCached = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('Connected to MongoDB');
      return mongoose;
    }).catch((err) => {
      cached.promise = null;
      console.error('MongoDB connection error:', err);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
