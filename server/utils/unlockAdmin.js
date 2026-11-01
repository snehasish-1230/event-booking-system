require('dotenv').config();

const connectDB = require('../config/db');
const env = require('../config/env');
const User = require('../models/User');
const mongoose = require('mongoose');

const targetEmail = process.argv[2]?.trim().toLowerCase();

const unlockAdmin = async () => {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Admin unlock is available only when NODE_ENV=development');
  }
  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    throw new Error('Provide exactly one admin email: npm run unlock-admin -- admin@example.com');
  }

  await connectDB();
  const admin = await User.findOne({
    email: targetEmail,
    role: 'admin',
    emailVerified: true,
    isActive: true,
  }).select('+loginAttempts +lockUntil');

  if (!admin) {
    throw new Error('No active, verified admin account matches the supplied email');
  }

  if (!admin.loginAttempts && !admin.lockUntil) {
    console.log('The verified admin account has no account-level login lock to clear.');
    return;
  }

  const result = await User.updateOne(
    {
      _id: admin._id,
      email: targetEmail,
      role: 'admin',
      emailVerified: true,
      isActive: true,
    },
    {
      $set: { loginAttempts: 0, lockUntil: null },
    }
  );
  if (result.modifiedCount !== 1) {
    throw new Error('Admin lock state was not updated; re-check the account before retrying');
  }

  console.log(`Cleared account-level login lock for verified admin ${targetEmail}.`);
};

unlockAdmin()
  .catch((error) => {
    console.error(`Admin unlock failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
