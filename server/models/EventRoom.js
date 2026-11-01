const mongoose = require('mongoose');

const hasUniqueTeamSlots = (assignments) => {
  const slots = assignments.map(({ slotNumber }) => slotNumber);
  const registrations = assignments.map(({ registration }) => String(registration));
  return new Set(slots).size === slots.length &&
    new Set(registrations).size === registrations.length;
};

const assignmentSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
    },
    slotNumber: {
      type: Number,
      required: true,
      min: [1, 'Slot number must be positive'],
      validate: {
        validator: Number.isInteger,
        message: 'Slot number must be a whole number',
      },
    },
    emailStatus: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default() {
        return this.parent()?.publishedAt ? 'sent' : 'pending';
      },
    },
    emailSentAt: Date,
    emailAttempts: {
      type: Number,
      min: 0,
      default: 0,
    },
    emailError: {
      type: String,
      maxlength: 200,
      select: false,
    },
  },
  { _id: false }
);

const roomDetailsSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    roomPassword: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      select: false,
    },
    matchAt: {
      type: Date,
      required: true,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    assignments: {
      type: [assignmentSchema],
      default: [],
      validate: {
        validator: hasUniqueTeamSlots,
        message: 'Room slots and registration assignments must be unique',
      },
    },
  },
  { _id: false }
);

const eventRoomSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      unique: true,
    },
    roomId: { type: String, trim: true, maxlength: 80 },
    roomPassword: {
      type: String,
      trim: true,
      maxlength: 80,
      select: false,
    },
    matchAt: Date,
    instructions: { type: String, trim: true, maxlength: 1000, default: '' },
    assignments: {
      type: [assignmentSchema],
      default: [],
      validate: {
        validator(assignments) {
          return hasUniqueTeamSlots(assignments);
        },
        message: 'Room slots and registration assignments must be unique',
      },
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default() {
        return this.publishedAt ? 'published' : 'draft';
      },
    },
    publishedAt: Date,
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    draft: { type: roomDetailsSchema, default: undefined },
  },
  { timestamps: true, optimisticConcurrency: true }
);

module.exports = mongoose.model('EventRoom', eventRoomSchema);
