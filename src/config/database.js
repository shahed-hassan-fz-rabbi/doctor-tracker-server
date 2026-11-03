const mongoose = require('mongoose');
const env = require('./env');

let connecting = null;

function connectDatabase(uri = env.MONGODB_URI) {
  if (!connecting) {
    connecting = mongoose.connect(uri).then(() => {
      console.log(`✅ MongoDB connected (${mongoose.connection.name})`);
      return mongoose.connection;
    });
  }
  return connecting;
}

async function disconnectDatabase() {
  connecting = null;
  await mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
