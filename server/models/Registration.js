// const mongoose = require('mongoose');
// const uuid = require('uuid');
// const { getTeamFormat } = require('../utils/teamFormat');

// const STATUSES = ['pending', 'confirmed', 'cancelled', 'attended'];
// const TICKET_TYPES = ['standard', 'vip'];
// const TEAM_MODES = ['SOLO', 'DUO', 'TRIO', 'SQUAD'];

// const playerSchema = new mongoose.Schema(
//   {
//     playerName: {
//       type: String,
//       required: [true, 'Player name is required'],
//       trim: true,
//       minlength: [2, 'Player name must be at least 2 characters'],
//       maxlength: [50, 'Player name cannot exceed 50 characters'],
//     },
//     freeFireUid: {
//       type: String,
//       required: [true, 'Free Fire UID is required'],
//       match: [/^\d{1,20}$/, 'Free Fire UID must contain 1 to 20 digits only'],
//     },
//   },
//   { _id: false }
// );

// const registrationSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//       required: [true, 'User is required'],
//     },
//     event: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Event',
//       required: [true, 'Event is required'],
//     },
//     confirmationCode: {
//       type: String,
//       unique: true,
//       default: () => uuid.v4().replace(/-/g, '').substring(0, 12).toUpperCase(),
//     },
//     status: {
//       type: String,
//       enum: {
//         values: STATUSES,
//         message: '{VALUE} is not a valid status',
//       },
//       default: 'confirmed',
//     },
//     paymentStatus: {
//       type: String,
//       enum: {
//         values: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
//         message: '{VALUE} is not a valid payment status',
//       },
//       default: 'NOT_REQUIRED',
//     },
//     registeredAt: {
//       type: Date,
//       default: Date.now,
//     },
//     cancelledAt: {
//       type: Date,
//     },
//     ticketType: {
//       type: String,
//       enum: {
//         values: TICKET_TYPES,
//         message: '{VALUE} is not a valid ticket type',
//       },
//       default: 'standard',
//     },
//     teamMode: {
//       type: String,
//       enum: {
//         values: TEAM_MODES,
//         message: '{VALUE} is not a valid team mode',
//       },
//     },
//     gameMode: {
//       type: String,
//       enum: {
//         values: TEAM_MODES,
//         message: '{VALUE} is not a valid game mode',
//       },
//     },
//     teamSize: {
//       type: Number,
//       enum: [1, 2, 3, 4],
//       min: 1,
//       max: 4,
//     },
//     players: {
//       type: [playerSchema],
//       default: [],
//       validate: {
//         validator(players) {
//           const update =
//             typeof this.getUpdate === 'function' ? this.getUpdate() || {} : {};
//           const updateValues = update.$set || update;
//           const teamMode =
//             this.teamMode ?? updateValues.teamMode ?? updateValues.gameMode;
//           const gameMode = this.gameMode ?? updateValues.gameMode;
//           const teamSize = this.teamSize ?? updateValues.teamSize;
//           const hasTeamFormat =
//             Boolean(teamMode || gameMode) || teamSize != null;
//           const teamFormat = getTeamFormat({ teamMode, gameMode, teamSize });
//           if (!teamFormat) return !hasTeamFormat && players.length === 0;
//           if (players.length !== teamFormat.teamSize) return false;
//           const uids = players.map((player) => player.freeFireUid);
//           return (
//             uids.every((uid) => /^\d{1,20}$/.test(uid)) &&
//             new Set(uids).size === uids.length
//           );
//         },
//         message: 'Player roster must match the team mode and contain unique Free Fire UIDs',
//       },
//     },
//     notes: {
//       type: String,
//       maxlength: [500, 'Notes cannot exceed 500 characters'],
//       trim: true,
//       default: '',
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// // Indexes (confirmationCode already indexed via field-level unique: true)
// registrationSchema.index({ user: 1, event: 1 }, { unique: true });
// registrationSchema.index({ event: 1, status: 1 });
// registrationSchema.index({ user: 1, status: 1 });

// // Returns count of confirmed registrations for the given event
// registrationSchema.statics.getConfirmedCount = async function (eventId) {
//   return this.countDocuments({ event: eventId, status: 'confirmed' });
// };

// registrationSchema.statics.getCapacityConsumingCount = async function (eventId) {
//   return this.countDocuments({
//     event: eventId,
//     status: { $in: ['pending', 'confirmed', 'attended'] },
//   });
// };

// const Registration = mongoose.model('Registration', registrationSchema);

// module.exports = Registration;










//new-------
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { getTeamFormat } = require('../utils/teamFormat');

const STATUSES = ['pending', 'confirmed', 'cancelled', 'attended'];
const TICKET_TYPES = ['standard', 'vip'];
const TEAM_MODES = ['SOLO', 'DUO', 'TRIO', 'SQUAD'];

const playerSchema = new mongoose.Schema(
  {
    playerName: {
      type: String,
      required: [true, 'Player name is required'],
      trim: true,
      minlength: [2, 'Player name must be at least 2 characters'],
      maxlength: [50, 'Player name cannot exceed 50 characters'],
    },
    freeFireUid: {
      type: String,
      required: [true, 'Free Fire UID is required'],
      match: [/^\d{1,20}$/, 'Free Fire UID must contain 1 to 20 digits only'],
    },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event is required'],
    },
    confirmationCode: {
      type: String,
      unique: true,
      default: () => randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase(),
    },
    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: '{VALUE} is not a valid status',
      },
      default: 'confirmed',
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'NOT_REQUIRED',
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    cancelledAt: {
      type: Date,
    },
    ticketType: {
      type: String,
      enum: {
        values: TICKET_TYPES,
        message: '{VALUE} is not a valid ticket type',
      },
      default: 'standard',
    },
    teamMode: {
      type: String,
      enum: {
        values: TEAM_MODES,
        message: '{VALUE} is not a valid team mode',
      },
    },
    gameMode: {
      type: String,
      enum: {
        values: TEAM_MODES,
        message: '{VALUE} is not a valid game mode',
      },
    },
    teamSize: {
      type: Number,
      enum: [1, 2, 3, 4],
      min: 1,
      max: 4,
    },
    players: {
      type: [playerSchema],
      default: [],
      validate: {
        validator(players) {
          const update =
            typeof this.getUpdate === 'function' ? this.getUpdate() || {} : {};
          const updateValues = update.$set || update;
          const teamMode =
            this.teamMode ?? updateValues.teamMode ?? updateValues.gameMode;
          const gameMode = this.gameMode ?? updateValues.gameMode;
          const teamSize = this.teamSize ?? updateValues.teamSize;
          const hasTeamFormat =
            Boolean(teamMode || gameMode) || teamSize != null;
          const teamFormat = getTeamFormat({ teamMode, gameMode, teamSize });
          if (!teamFormat) return !hasTeamFormat && players.length === 0;
          if (players.length !== teamFormat.teamSize) return false;
          const uids = players.map((player) => player.freeFireUid);
          return (
            uids.every((uid) => /^\d{1,20}$/.test(uid)) &&
            new Set(uids).size === uids.length
          );
        },
        message: 'Player roster must match the team mode and contain unique Free Fire UIDs',
      },
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (confirmationCode already indexed via field-level unique: true)
registrationSchema.index({ user: 1, event: 1 }, { unique: true });
registrationSchema.index({ event: 1, status: 1 });
registrationSchema.index({ user: 1, status: 1 });

// Returns count of confirmed registrations for the given event
registrationSchema.statics.getConfirmedCount = async function (eventId) {
  return this.countDocuments({ event: eventId, status: 'confirmed' });
};

registrationSchema.statics.getCapacityConsumingCount = async function (eventId) {
  return this.countDocuments({
    event: eventId,
    status: { $in: ['pending', 'confirmed', 'attended'] },
  });
};

const Registration = mongoose.model('Registration', registrationSchema);

module.exports = Registration;