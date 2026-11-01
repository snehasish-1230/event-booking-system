const mongoose = require("mongoose");
const { MONGODB_URI } = require("./env");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      })
      .then((mongooseInstance) => {
        console.log(
          `MongoDB connected: ${mongooseInstance.connection.host}`
        );
        return mongooseInstance;
      })
      .catch((error) => {
        cached.promise = null;
        console.error("MongoDB connection error:", {
          name: error.name,
          code: error.code,
          codeName: error.codeName,
          message: error.message.replace(
            /mongodb(?:\+srv)?:\/\/\S+/gi,
            "[redacted MongoDB URI]"
          ),
        });
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;
