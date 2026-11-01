const mongoose = require('mongoose');
const slugify = require('slugify');

const CATEGORIES = [
  'conference',
  'workshop',
  'seminar',
  'meetup',
  'concert',
  'sports',
  'networking',
  'webinar',
  'other',
];

// Keep legacy values valid for stored events; newly created or edited prices use INR.
const CURRENCIES = ['USD', 'EUR', 'TRY', 'GBP', 'INR'];

const STATUSES = ['draft', 'published', 'cancelled', 'completed'];
const TEAM_MODES = ['SOLO', 'DUO', 'TRIO', 'SQUAD'];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    endDate: {
      type: Date,
    },
    time: {
      type: String,
      trim: true,
    },
    location: {
      venue: {
        type: String,
        required: [true, 'Venue is required'],
        trim: true,
        maxlength: [200, 'Venue cannot exceed 200 characters'],
      },
      address: {
        type: String,
        trim: true,
        maxlength: [300, 'Address cannot exceed 300 characters'],
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        maxlength: [100, 'City cannot exceed 100 characters'],
      },
      country: {
        type: String,
        trim: true,
        maxlength: [100, 'Country cannot exceed 100 characters'],
      },
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      max: [100000, 'Capacity cannot exceed 100000'],
    },
    minParticipants: {
      type: Number,
      required: true,
      min: [1, 'Minimum members must be at least 1'],
      validate: {
        validator(value) {
          const capacity = this.get?.('capacity') ?? this.capacity;
          return capacity === undefined || value <= capacity;
        },
        message: 'Minimum members cannot exceed event capacity',
      },
      default: 1,
    },
    teamMode: {
      type: String,
      enum: {
        values: TEAM_MODES,
        message: '{VALUE} is not a valid team mode',
      },
      validate: {
        validator(value) {
          const otherMode = this.get?.('gameMode') ?? this.gameMode;
          return !value || !otherMode || value === otherMode;
        },
        message: 'Team mode and game mode must match',
      },
    },
    gameMode: {
      type: String,
      enum: {
        values: TEAM_MODES,
        message: '{VALUE} is not a valid game mode',
      },
      validate: {
        validator(value) {
          const mode = this.get?.('teamMode') ?? this.teamMode;
          return !value || !mode || value === mode;
        },
        message: 'Game mode and team mode must match',
      },
    },
    teamSize: {
      type: Number,
      enum: {
        values: [1, 2, 3, 4],
        message: '{VALUE} is not a supported team size',
      },
      min: 1,
      max: 4,
      validate: {
        validator(value) {
          const mode = this.get?.('gameMode') ?? this.gameMode ?? this.teamMode;
          const teamSizes = { SOLO: 1, DUO: 2, TRIO: 3, SQUAD: 4 };
          return value === undefined || !mode || teamSizes[mode] === Number(value);
        },
        message: 'Team size must match the selected game mode',
      },
    },
    registeredCount: {
      type: Number,
      min: [0, 'Registered count cannot be negative'],
      default: 0,
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    pricingType: {
      type: String,
      enum: {
        values: ['FREE', 'PAID'],
        message: '{VALUE} is not a valid pricing type',
      },
      default() {
        return this.price > 0 ? 'PAID' : 'FREE';
      },
      validate: {
        validator(value) {
          const price = this.get?.('price') ?? this.price;
          return value === 'FREE' ? Number(price) === 0 : Number(price) > 0;
        },
        message: 'FREE events must have a price of 0; PAID events require a price greater than 0',
      },
    },
    currency: {
      type: String,
      enum: {
        values: CURRENCIES,
        message: '{VALUE} is not a valid currency',
      },
      validate: {
        validator(value) {
          if (typeof this?.isModified === 'function') {
            return (!this.isNew && !this.isModified('currency')) || value === 'INR';
          }

          if (typeof this?.getUpdate === 'function') {
            const update = this.getUpdate() || {};
            const updatedCurrency =
              update.currency ??
              update.$set?.currency ??
              update.$setOnInsert?.currency;
            return updatedCurrency === undefined || updatedCurrency === 'INR';
          }

          return value === 'INR';
        },
        message: 'New or updated events must use INR',
      },
      default: 'INR',
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORIES,
        message: '{VALUE} is not a valid category',
      },
    },
    tags: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      default: '',
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer is required'],
    },
    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: '{VALUE} is not a valid status',
      },
      default: 'draft',
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    maxRegistrationsPerUser: {
      type: Number,
      min: [1, 'Max registrations per user must be at least 1'],
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes (slug already indexed via field-level unique: true)
eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ date: 1 });

// Virtuals
eventSchema.virtual('availableSpots').get(function () {
  return this.capacity - this.registeredCount;
});

eventSchema.virtual('isFull').get(function () {
  return this.registeredCount >= this.capacity;
});

eventSchema.virtual('isPast').get(function () {
  return this.date < new Date();
});

// Normalize title for slug: dots → hyphens so "Next.js" becomes "next-js" instead of "nextjs"
const normalizeForSlug = (title) => slugify(title.replace(/\./g, '-'), { lower: true, strict: true });

// Generate unique slug from title on save (Mongoose 9 — no next)
eventSchema.pre('save', async function () {
  if (!this.isModified('title')) return;

  this.slug = normalizeForSlug(this.title);

  const existingSlug = await mongoose
    .model('Event')
    .findOne({ slug: this.slug, _id: { $ne: this._id } });

  if (existingSlug) {
    this.slug = `${this.slug}-${Date.now()}`;
  }
});

// Regenerate slug when title is updated via findOneAndUpdate
eventSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  if (!update.title) return;

  let slug = normalizeForSlug(update.title);

  const filter = this.getFilter();
  const existingSlug = await mongoose
    .model('Event')
    .findOne({ slug, _id: { $ne: filter._id } });

  if (existingSlug) {
    slug = `${slug}-${Date.now()}`;
  }

  this.set({ slug });
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
