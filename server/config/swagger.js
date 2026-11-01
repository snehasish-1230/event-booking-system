const swaggerJsdoc = require('swagger-jsdoc');
const { version } = require('../package.json');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Booking System API',
      version,
      description:
        'A full-stack MERN event booking platform with role-based access control, atomic capacity management, email notifications, QR code tickets, and a security-hardened REST API.',
      contact: {
        name: 'Serkanby',
        url: 'https://serkanbayraktar.com/',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:{port}',
        description: 'Development server',
        variables: {
          port: { default: '5000' },
        },
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            name: { type: 'string', example: 'John Doe' },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com',
            },
            role: {
              type: 'string',
              enum: ['attendee', 'organizer', 'admin'],
              example: 'attendee',
            },
            avatar: { type: 'string', example: '/uploads/avatar.jpg' },
            bio: { type: 'string', example: 'Event enthusiast and organizer' },
            phone: { type: 'string', example: '+1234567890' },
            isActive: { type: 'boolean', example: true },
            preferences: {
              type: 'object',
              properties: {
                emailNotifications: { type: 'boolean', example: true },
                registrationAlerts: { type: 'boolean', example: true },
                reminderEmails: { type: 'boolean', example: true },
                theme: {
                  type: 'string',
                  enum: ['light', 'dark', 'system'],
                  example: 'system',
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-15T10:30:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-15T10:30:00.000Z',
            },
          },
        },
        Event: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            title: { type: 'string', example: 'React Conference 2026' },
            slug: { type: 'string', example: 'react-conference-2026' },
            description: {
              type: 'string',
              example:
                'Annual React conference with workshops and networking sessions.',
            },
            date: {
              type: 'string',
              format: 'date-time',
              example: '2026-06-15T09:00:00.000Z',
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              example: '2026-06-16T18:00:00.000Z',
            },
            time: { type: 'string', example: '09:00 - 18:00' },
            location: {
              type: 'object',
              properties: {
                venue: {
                  type: 'string',
                  example: 'Istanbul Congress Center',
                },
                address: { type: 'string', example: 'Harbiye Mah.' },
                city: { type: 'string', example: 'Istanbul' },
                country: { type: 'string', example: 'Turkey' },
              },
            },
            capacity: { type: 'integer', example: 500 },
            minParticipants: { type: 'integer', minimum: 1, example: 2 },
            teamMode: {
              type: 'string',
              enum: ['SOLO', 'DUO', 'TRIO', 'SQUAD'],
              nullable: true,
              description: 'Fixed Free Fire team format for the event.',
            },
            gameMode: {
              type: 'string',
              enum: ['SOLO', 'DUO', 'TRIO', 'SQUAD'],
              nullable: true,
            },
            teamSize: { type: 'integer', enum: [1, 2, 3, 4], nullable: true },
            registeredCount: { type: 'integer', example: 120 },
            price: { type: 'number', example: 49.99 },
            pricingType: { type: 'string', enum: ['FREE', 'PAID'], example: 'PAID' },
            currency: {
              type: 'string',
              enum: ['INR'],
              example: 'INR',
            },
            category: {
              type: 'string',
              enum: [
                'conference',
                'workshop',
                'seminar',
                'meetup',
                'concert',
                'sports',
                'networking',
                'webinar',
                'other',
              ],
              example: 'conference',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              example: ['react', 'javascript', 'frontend'],
            },
            image: { type: 'string', example: '/uploads/event-image.jpg' },
            organizer: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'cancelled', 'completed'],
              example: 'published',
            },
            isFeatured: { type: 'boolean', example: false },
            maxRegistrationsPerUser: { type: 'integer', example: 1 },
            availableSpots: { type: 'integer', example: 380 },
            isFull: { type: 'boolean', example: false },
            isPast: { type: 'boolean', example: false },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-15T10:30:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-15T10:30:00.000Z',
            },
          },
        },
        Registration: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            user: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            event: { type: 'string', example: '665f1a2b3c4d5e6f7a8b9c0d' },
            confirmationCode: { type: 'string', example: 'A1B2C3D4E5F6' },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'cancelled', 'attended'],
              example: 'confirmed',
            },
            registeredAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-15T10:30:00.000Z',
            },
            cancelledAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            ticketType: {
              type: 'string',
              enum: ['standard', 'vip'],
              example: 'standard',
            },
            teamMode: {
              type: 'string',
              enum: ['SOLO', 'DUO', 'TRIO', 'SQUAD'],
              nullable: true,
            },
            gameMode: {
              type: 'string',
              enum: ['SOLO', 'DUO', 'TRIO', 'SQUAD'],
              nullable: true,
            },
            teamSize: { type: 'integer', enum: [1, 2, 3, 4], nullable: true },
            players: {
              type: 'array',
              items: {
                type: 'object',
                required: ['playerName', 'freeFireUid'],
                properties: {
                  playerName: { type: 'string', minLength: 2, maxLength: 50 },
                  freeFireUid: { type: 'string', pattern: '^\\d{1,20}$' },
                },
              },
            },
            notes: { type: 'string', example: 'Dietary requirements: vegan' },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-15T10:30:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-15T10:30:00.000Z',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error description' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            pages: { type: 'integer', example: 5 },
          },
        },
      },
      parameters: {
        MongoId: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'MongoDB ObjectId',
          example: '665f1a2b3c4d5e6f7a8b9c0d',
        },
        PageParam: {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number',
        },
        LimitParam: {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          description: 'Items per page',
        },
        SearchParam: {
          in: 'query',
          name: 'search',
          schema: { type: 'string' },
          description: 'Search keyword',
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Server health check',
      },
      {
        name: 'Authentication',
        description: 'User registration, login, profile management, and password operations',
      },
      {
        name: 'Events',
        description: 'Event CRUD, listing, filtering, and lifecycle management',
      },
      {
        name: 'Registrations',
        description: 'Event registration, ticket management, and check-in operations',
      },
      {
        name: 'Users',
        description: 'Public user profiles and statistics',
      },
      {
        name: 'Organizer',
        description: 'Organizer dashboard, revenue, and event analytics',
      },
      {
        name: 'Admin',
        description: 'System-wide administration for users, events, and registrations',
      },
      {
        name: 'Upload',
        description: 'Image upload and management',
      },
    ],
    paths: {
      // ─── Health ────────────────────────────────────────────────
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Server health check',
          description: 'Returns the current server status and timestamp.',
          responses: {
            200: {
              description: 'Server is running',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'API is running' },
                      timestamp: {
                        type: 'string',
                        format: 'date-time',
                        example: '2026-04-15T10:30:00.000Z',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ─── Authentication ────────────────────────────────────────
      '/api/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user',
          description:
            'Creates a new user account with the specified role (attendee or organizer). Returns a JWT token upon successful registration.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'email', 'password'],
                  properties: {
                    name: {
                      type: 'string',
                      minLength: 2,
                      maxLength: 50,
                      example: 'John Doe',
                    },
                    email: {
                      type: 'string',
                      format: 'email',
                      example: 'john@example.com',
                    },
                    password: {
                      type: 'string',
                      minLength: 6,
                      example: 'securePassword123',
                    },
                    role: {
                      type: 'string',
                      enum: ['attendee', 'organizer'],
                      default: 'attendee',
                      example: 'attendee',
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'User registered successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                          token: {
                            type: 'string',
                            example: 'eyJhbGciOiJIUzI1NiIs...',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Validation error or email already registered',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            429: { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login user',
          description:
            'Authenticates a user with email and password. Returns a JWT token. Account locks after 5 failed attempts for 15 minutes.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: {
                      type: 'string',
                      format: 'email',
                      example: 'john@example.com',
                    },
                    password: {
                      type: 'string',
                      example: 'securePassword123',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                          token: {
                            type: 'string',
                            example: 'eyJhbGciOiJIUzI1NiIs...',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Invalid credentials or account deactivated' },
            423: { description: 'Account temporarily locked' },
            429: { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user profile',
          description: 'Returns the authenticated user\'s profile information.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Current user profile',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Not authenticated' },
          },
        },
      },
      '/api/auth/profile': {
        put: {
          tags: ['Authentication'],
          summary: 'Update user profile',
          description:
            'Updates the authenticated user\'s profile fields (name, bio, phone, avatar, preferences).',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'John Updated' },
                    bio: { type: 'string', example: 'Updated bio' },
                    phone: { type: 'string', example: '+1234567890' },
                    avatar: { type: 'string', example: '/uploads/new-avatar.jpg' },
                    preferences: {
                      type: 'object',
                      properties: {
                        emailNotifications: { type: 'boolean' },
                        registrationAlerts: { type: 'boolean' },
                        reminderEmails: { type: 'boolean' },
                        theme: {
                          type: 'string',
                          enum: ['light', 'dark', 'system'],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Profile updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Not authenticated' },
          },
        },
      },
      '/api/auth/change-password': {
        put: {
          tags: ['Authentication'],
          summary: 'Change password',
          description:
            'Changes the authenticated user\'s password after verifying the current password.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['currentPassword', 'newPassword'],
                  properties: {
                    currentPassword: {
                      type: 'string',
                      example: 'oldPassword123',
                    },
                    newPassword: {
                      type: 'string',
                      minLength: 6,
                      example: 'newSecurePassword456',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Password updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: {
                        type: 'string',
                        example: 'Password updated successfully',
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Current password is incorrect' },
          },
        },
      },
      '/api/auth/delete-account': {
        delete: {
          tags: ['Authentication'],
          summary: 'Delete user account',
          description:
            'Permanently deletes the authenticated user\'s account and all associated registrations. Requires password confirmation.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['password'],
                  properties: {
                    password: {
                      type: 'string',
                      example: 'currentPassword123',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Account deleted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: {
                        type: 'string',
                        example: 'Account deleted successfully',
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Password is incorrect' },
          },
        },
      },

      // ─── Events ────────────────────────────────────────────────
      '/api/events': {
        get: {
          tags: ['Events'],
          summary: 'List published events',
          description:
            'Returns a paginated list of published events with support for search, filtering by category/city/date/price, and sorting.',
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            {
              in: 'query',
              name: 'limit',
              schema: { type: 'integer', default: 12, maximum: 50 },
              description: 'Items per page',
            },
            { $ref: '#/components/parameters/SearchParam' },
            {
              in: 'query',
              name: 'category',
              schema: {
                type: 'string',
                enum: [
                  'conference',
                  'workshop',
                  'seminar',
                  'meetup',
                  'concert',
                  'sports',
                  'networking',
                  'webinar',
                  'other',
                ],
              },
            },
            {
              in: 'query',
              name: 'city',
              schema: { type: 'string' },
              description: 'Filter by city name',
            },
            {
              in: 'query',
              name: 'dateFrom',
              schema: { type: 'string', format: 'date' },
              description: 'Start date filter',
            },
            {
              in: 'query',
              name: 'dateTo',
              schema: { type: 'string', format: 'date' },
              description: 'End date filter',
            },
            {
              in: 'query',
              name: 'priceMin',
              schema: { type: 'number' },
              description: 'Minimum price',
            },
            {
              in: 'query',
              name: 'priceMax',
              schema: { type: 'number' },
              description: 'Maximum price',
            },
            {
              in: 'query',
              name: 'sort',
              schema: {
                type: 'string',
                enum: ['date', '-date', 'price', '-price', 'title', 'createdAt'],
                default: 'date',
              },
            },
            {
              in: 'query',
              name: 'upcoming',
              schema: { type: 'string', enum: ['true', 'false'] },
              description: 'Filter only upcoming events',
            },
          ],
          responses: {
            200: {
              description: 'Paginated event list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          events: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Event' },
                          },
                          page: { type: 'integer', example: 1 },
                          totalPages: { type: 'integer', example: 5 },
                          total: { type: 'integer', example: 50 },
                          hasNextPage: { type: 'boolean', example: true },
                          hasPrevPage: { type: 'boolean', example: false },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Events'],
          summary: 'Create a new event',
          description:
            'Creates a new event in draft status. Requires organizer or admin role.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'description', 'date', 'capacity', 'category', 'location'],
                  properties: {
                    title: { type: 'string', example: 'React Conference 2026' },
                    description: {
                      type: 'string',
                      example: 'Annual React conference with workshops.',
                    },
                    date: {
                      type: 'string',
                      format: 'date-time',
                      example: '2026-06-15T09:00:00.000Z',
                    },
                    endDate: {
                      type: 'string',
                      format: 'date-time',
                      example: '2026-06-16T18:00:00.000Z',
                    },
                    time: { type: 'string', example: '09:00 - 18:00' },
                    location: {
                      type: 'object',
                      required: ['venue', 'city'],
                      properties: {
                        venue: { type: 'string', example: 'Istanbul Congress Center' },
                        address: { type: 'string', example: 'Harbiye Mah.' },
                        city: { type: 'string', example: 'Istanbul' },
                        country: { type: 'string', example: 'Turkey' },
                      },
                    },
                    capacity: { type: 'integer', minimum: 1, example: 500 },
                    teamMode: {
                      type: 'string',
                      enum: ['SOLO', 'DUO', 'TRIO', 'SQUAD'],
                      description: 'One fixed team format for all registrations in this event.',
                    },
                    gameMode: {
                      type: 'string',
                      enum: ['SOLO', 'DUO', 'TRIO', 'SQUAD'],
                      description: 'Must agree with teamMode and teamSize.',
                    },
                    teamSize: {
                      type: 'integer',
                      enum: [1, 2, 3, 4],
                      description: 'Derived from the selected gameMode.',
                    },
                    minParticipants: {
                      type: 'integer',
                      minimum: 1,
                      example: 2,
                      description: 'Target minimum attendance; does not gate publishing.',
                    },
                    price: { type: 'number', minimum: 0, example: 49.99 },
                    pricingType: {
                      type: 'string',
                      enum: ['FREE', 'PAID'],
                      example: 'PAID',
                      description: 'FREE events require price 0; PAID events require a price greater than 0.',
                    },
                    currency: {
                      type: 'string',
                      enum: ['INR'],
                      example: 'INR',
                    },
                    category: {
                      type: 'string',
                      enum: [
                        'conference',
                        'workshop',
                        'seminar',
                        'meetup',
                        'concert',
                        'sports',
                        'networking',
                        'webinar',
                        'other',
                      ],
                      example: 'conference',
                    },
                    tags: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['react', 'javascript'],
                    },
                    image: { type: 'string', example: '/uploads/event.jpg' },
                    maxRegistrationsPerUser: {
                      type: 'integer',
                      minimum: 1,
                      example: 1,
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Event created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          event: { $ref: '#/components/schemas/Event' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Validation error' },
            401: { description: 'Not authenticated' },
            403: { description: 'Not authorized (organizer role required)' },
          },
        },
      },
      '/api/events/featured': {
        get: {
          tags: ['Events'],
          summary: 'Get featured events',
          description: 'Returns up to 6 featured upcoming published events.',
          responses: {
            200: {
              description: 'Featured events list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          events: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Event' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/events/categories': {
        get: {
          tags: ['Events'],
          summary: 'Get event categories',
          description:
            'Returns an aggregated list of categories with event counts.',
          responses: {
            200: {
              description: 'Category list with counts',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          categories: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                category: {
                                  type: 'string',
                                  example: 'conference',
                                },
                                count: { type: 'integer', example: 15 },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/events/my/organized': {
        get: {
          tags: ['Events'],
          summary: 'Get my organized events',
          description:
            'Returns the authenticated organizer\'s events with optional status filter and pagination.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'query',
              name: 'status',
              schema: {
                type: 'string',
                enum: ['draft', 'published', 'cancelled', 'completed'],
              },
            },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: {
              description: 'Organizer event list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          events: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Event' },
                          },
                          pagination: {
                            $ref: '#/components/schemas/Pagination',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Not authenticated' },
            403: { description: 'Not authorized' },
          },
        },
      },
      '/api/events/id/{id}': {
        get: {
          tags: ['Events'],
          summary: 'Get event by ID',
          description: 'Returns a single published event by its MongoDB ObjectId.',
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: {
              description: 'Event details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          event: { $ref: '#/components/schemas/Event' },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/events/{slug}': {
        get: {
          tags: ['Events'],
          summary: 'Get event by slug',
          description:
            'Returns a single published event by its slug. Also returns whether the authenticated user is registered.',
          parameters: [
            {
              in: 'path',
              name: 'slug',
              required: true,
              schema: { type: 'string' },
              example: 'react-conference-2026',
            },
          ],
          responses: {
            200: {
              description: 'Event details with registration status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          event: { $ref: '#/components/schemas/Event' },
                          isRegistered: { type: 'boolean', example: false },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/events/{id}': {
        put: {
          tags: ['Events'],
          summary: 'Update event',
          description:
            'Updates an existing event. Only the organizer who created it or an admin can update.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    date: { type: 'string', format: 'date-time' },
                    endDate: { type: 'string', format: 'date-time' },
                    time: { type: 'string' },
                    location: {
                      type: 'object',
                      properties: {
                        venue: { type: 'string' },
                        address: { type: 'string' },
                        city: { type: 'string' },
                        country: { type: 'string' },
                      },
                    },
                    capacity: { type: 'integer' },
                    price: { type: 'number' },
                    pricingType: { type: 'string', enum: ['FREE', 'PAID'] },
                    currency: { type: 'string' },
                    category: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } },
                    image: { type: 'string' },
                    maxRegistrationsPerUser: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Event updated successfully' },
            400: { description: 'Validation error or cancelled event' },
            403: { description: 'Not authorized' },
            404: { description: 'Event not found' },
          },
        },
        delete: {
          tags: ['Events'],
          summary: 'Delete event',
          description:
            'Deletes an event. Cannot delete events with active registrations. Only the organizer or admin can delete.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'Event deleted successfully' },
            400: { description: 'Event has active registrations' },
            403: { description: 'Not authorized' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/events/{id}/publish': {
        put: {
          tags: ['Events'],
          summary: 'Publish a draft event',
          description:
            'Changes event status from draft to published. Validates that all required fields are present.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'Event published successfully' },
            400: { description: 'Missing required fields or not a draft' },
            403: { description: 'Not authorized' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/events/{id}/cancel': {
        put: {
          tags: ['Events'],
          summary: 'Cancel an event',
          description:
            'Changes event status to cancelled. Only published or draft events can be cancelled.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'Event cancelled successfully' },
            400: { description: 'Event cannot be cancelled' },
            403: { description: 'Not authorized' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/events/{id}/register': {
        post: {
          tags: ['Registrations'],
          summary: 'Register for an event',
          description:
            'Registers the authenticated user for an event using atomic capacity check to prevent race conditions. Sends a confirmation email with a unique code.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ticketType: {
                      type: 'string',
                      enum: ['standard', 'vip'],
                      default: 'standard',
                    },
                    notes: {
                      type: 'string',
                      maxLength: 500,
                      example: 'Dietary requirements: vegan',
                    },
                    teamMode: {
                      type: 'string',
                      enum: ['SOLO', 'DUO', 'TRIO', 'SQUAD'],
                    },
                    players: {
                      type: 'array',
                      minItems: 1,
                      maxItems: 4,
                      items: {
                        type: 'object',
                        required: ['playerName', 'freeFireUid'],
                        properties: {
                          playerName: { type: 'string', minLength: 2, maxLength: 50 },
                          freeFireUid: { type: 'string', pattern: '^\\d{1,20}$' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Registration successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          registration: {
                            $ref: '#/components/schemas/Registration',
                          },
                          confirmationCode: {
                            type: 'string',
                            example: 'A1B2C3D4E5F6',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description:
                'Event not available, already registered, or event is full',
            },
            401: { description: 'Not authenticated' },
            404: { description: 'Event not found' },
            429: { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/events/{id}/registrations': {
        get: {
          tags: ['Registrations'],
          summary: 'Get event registrations',
          description:
            'Returns all registrations for a specific event with stats. Organizer or admin only.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/MongoId' },
            {
              in: 'query',
              name: 'status',
              schema: {
                type: 'string',
                enum: ['pending', 'confirmed', 'cancelled', 'attended'],
              },
            },
            { $ref: '#/components/parameters/SearchParam' },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: {
              description: 'Event registrations with stats',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          registrations: {
                            type: 'array',
                            items: {
                              $ref: '#/components/schemas/Registration',
                            },
                          },
                          stats: {
                            type: 'object',
                            properties: {
                              totalConfirmed: {
                                type: 'integer',
                                example: 50,
                              },
                              totalCancelled: {
                                type: 'integer',
                                example: 5,
                              },
                              totalAttended: {
                                type: 'integer',
                                example: 30,
                              },
                              capacityPercentage: {
                                type: 'integer',
                                example: 60,
                              },
                            },
                          },
                          pagination: {
                            $ref: '#/components/schemas/Pagination',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            403: { description: 'Not authorized' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/events/{id}/stats': {
        get: {
          tags: ['Events'],
          summary: 'Get event statistics',
          description:
            'Returns detailed statistics for a specific event including registration counts and revenue estimate.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: {
              description: 'Event statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          event: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              title: { type: 'string' },
                              capacity: { type: 'integer' },
                              price: { type: 'number' },
                              currency: { type: 'string' },
                            },
                          },
                          stats: {
                            type: 'object',
                            properties: {
                              totalRegistrations: {
                                type: 'integer',
                                example: 100,
                              },
                              confirmedCount: {
                                type: 'integer',
                                example: 80,
                              },
                              cancelledCount: {
                                type: 'integer',
                                example: 10,
                              },
                              attendedCount: {
                                type: 'integer',
                                example: 10,
                              },
                              capacityPercentage: {
                                type: 'integer',
                                example: 60,
                              },
                              revenueEstimate: {
                                type: 'number',
                                example: 3999.2,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            403: { description: 'Not authorized' },
            404: { description: 'Event not found' },
          },
        },
      },

      // ─── Registrations ─────────────────────────────────────────
      '/api/registrations/my': {
        get: {
          tags: ['Registrations'],
          summary: 'Get my registrations',
          description:
            'Returns the authenticated user\'s registrations with optional status filter and pagination.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'query',
              name: 'status',
              schema: {
                type: 'string',
                enum: ['pending', 'confirmed', 'cancelled', 'attended'],
              },
            },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: {
              description: 'User registrations list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          registrations: {
                            type: 'array',
                            items: {
                              $ref: '#/components/schemas/Registration',
                            },
                          },
                          pagination: {
                            $ref: '#/components/schemas/Pagination',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Not authenticated' },
          },
        },
      },
      '/api/registrations/code/{code}': {
        get: {
          tags: ['Registrations'],
          summary: 'Find registration by confirmation code',
          description:
            'Looks up a registration by its unique confirmation code. Only the owner or event organizer/admin can view.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'code',
              required: true,
              schema: { type: 'string' },
              description: '12-character confirmation code',
              example: 'A1B2C3D4E5F6',
            },
          ],
          responses: {
            200: {
              description: 'Registration details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          registration: {
                            $ref: '#/components/schemas/Registration',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            403: { description: 'Not authorized' },
            404: { description: 'Registration not found' },
          },
        },
      },
      '/api/registrations/{id}': {
        get: {
          tags: ['Registrations'],
          summary: 'Get registration by ID',
          description:
            'Returns a single registration with populated event and user data. Only the owner or event organizer/admin can view.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: {
              description: 'Registration details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          registration: {
                            $ref: '#/components/schemas/Registration',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            403: { description: 'Not authorized' },
            404: { description: 'Registration not found' },
          },
        },
        delete: {
          tags: ['Registrations'],
          summary: 'Cancel a registration',
          description:
            'Cancels an existing registration and atomically decrements the event\'s registered count. Sends a cancellation email.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: {
              description: 'Registration cancelled successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: {
                        type: 'string',
                        example: 'Registration cancelled successfully',
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Registration already cancelled' },
            403: { description: 'Not authorized' },
            404: { description: 'Registration not found' },
          },
        },
      },
      '/api/registrations/{id}/check-in': {
        put: {
          tags: ['Registrations'],
          summary: 'Check-in an attendee',
          description:
            'Marks a confirmed registration as attended. Organizer or admin only. Also accepts confirmation codes as the ID parameter.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: {
              description: 'Attendee checked in successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: {
                        type: 'string',
                        example: 'Attendee checked in successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          registration: {
                            $ref: '#/components/schemas/Registration',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Already checked in or cancelled' },
            403: { description: 'Not authorized' },
            404: { description: 'Registration not found' },
          },
        },
      },

      // ─── Users ─────────────────────────────────────────────────
      '/api/users/me/stats': {
        get: {
          tags: ['Users'],
          summary: 'Get current user statistics',
          description:
            'Returns the authenticated user\'s registration stats including upcoming events, attended, and cancelled counts.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'User statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          stats: {
                            type: 'object',
                            properties: {
                              totalRegistrations: {
                                type: 'integer',
                                example: 15,
                              },
                              upcomingEvents: {
                                type: 'integer',
                                example: 3,
                              },
                              attendedCount: {
                                type: 'integer',
                                example: 10,
                              },
                              cancelledCount: {
                                type: 'integer',
                                example: 2,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Not authenticated' },
          },
        },
      },
      '/api/users/{id}/profile': {
        get: {
          tags: ['Users'],
          summary: 'Get public user profile',
          description:
            'Returns a public profile of a user. For organizers, includes recent events and event count.',
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: {
              description: 'Public user profile',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          user: {
                            type: 'object',
                            properties: {
                              _id: { type: 'string' },
                              name: { type: 'string' },
                              avatar: { type: 'string' },
                              bio: { type: 'string' },
                              role: { type: 'string' },
                              createdAt: {
                                type: 'string',
                                format: 'date-time',
                              },
                              events: {
                                type: 'object',
                                properties: {
                                  count: { type: 'integer' },
                                  recent: {
                                    type: 'array',
                                    items: {
                                      $ref: '#/components/schemas/Event',
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: { description: 'User not found' },
          },
        },
      },
      '/api/users/{id}/organizer': {
        get: {
          tags: ['Users'],
          summary: 'Get organizer profile',
          description:
            'Returns the full organizer profile with all published events and registration counts.',
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: {
              description: 'Organizer profile with events',
            },
            400: { description: 'User is not an organizer' },
            404: { description: 'User not found' },
          },
        },
      },

      // ─── Organizer ────────────────────────────────────────────
      '/api/organizer/dashboard': {
        get: {
          tags: ['Organizer'],
          summary: 'Get organizer dashboard stats',
          description:
            'Returns aggregated dashboard statistics: events by status, total registrations, revenue, capacity utilization, and month-over-month comparisons.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Dashboard statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          totalEvents: { type: 'integer', example: 12 },
                          publishedEvents: { type: 'integer', example: 8 },
                          draftEvents: { type: 'integer', example: 2 },
                          cancelledEvents: { type: 'integer', example: 1 },
                          completedEvents: { type: 'integer', example: 1 },
                          totalCapacity: { type: 'integer', example: 5000 },
                          totalRegistered: { type: 'integer', example: 3200 },
                          totalRevenue: { type: 'number', example: 15990.5 },
                          upcomingEvents: { type: 'integer', example: 5 },
                          capacityUtilization: {
                            type: 'number',
                            example: 64.0,
                          },
                          thisMonthRegistrations: {
                            type: 'integer',
                            example: 45,
                          },
                          lastMonthRegistrations: {
                            type: 'integer',
                            example: 32,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Not authenticated' },
            403: { description: 'Not authorized' },
          },
        },
      },
      '/api/organizer/revenue': {
        get: {
          tags: ['Organizer'],
          summary: 'Get revenue breakdown',
          description:
            'Returns revenue breakdown grouped by event (registeredCount x price), sorted by revenue descending.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Revenue breakdown by event' },
            401: { description: 'Not authenticated' },
            403: { description: 'Not authorized' },
          },
        },
      },
      '/api/organizer/recent-registrations': {
        get: {
          tags: ['Organizer'],
          summary: 'Get recent registrations',
          description:
            'Returns the 10 most recent registrations across all organizer events with user and event details.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Recent registrations list' },
            401: { description: 'Not authenticated' },
            403: { description: 'Not authorized' },
          },
        },
      },
      '/api/organizer/upcoming-events': {
        get: {
          tags: ['Organizer'],
          summary: 'Get upcoming events',
          description:
            'Returns the organizer\'s upcoming published events sorted by date with capacity and available spots.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Upcoming events list' },
            401: { description: 'Not authenticated' },
            403: { description: 'Not authorized' },
          },
        },
      },

      // ─── Admin ─────────────────────────────────────────────────
      '/api/admin/dashboard': {
        get: {
          tags: ['Admin'],
          summary: 'Get admin dashboard',
          description:
            'Returns system-wide aggregate statistics: users by role, events by status, registrations by status, monthly growth, and top events.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'System-wide dashboard statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          users: {
                            type: 'object',
                            properties: {
                              total: { type: 'integer', example: 150 },
                              byRole: {
                                type: 'object',
                                properties: {
                                  attendee: {
                                    type: 'integer',
                                    example: 120,
                                  },
                                  organizer: {
                                    type: 'integer',
                                    example: 25,
                                  },
                                  admin: { type: 'integer', example: 5 },
                                },
                              },
                              newThisMonth: {
                                type: 'integer',
                                example: 15,
                              },
                            },
                          },
                          events: {
                            type: 'object',
                            properties: {
                              total: { type: 'integer', example: 50 },
                              byStatus: {
                                type: 'object',
                                properties: {
                                  draft: { type: 'integer', example: 5 },
                                  published: {
                                    type: 'integer',
                                    example: 30,
                                  },
                                  cancelled: {
                                    type: 'integer',
                                    example: 5,
                                  },
                                  completed: {
                                    type: 'integer',
                                    example: 10,
                                  },
                                },
                              },
                              newThisMonth: {
                                type: 'integer',
                                example: 8,
                              },
                            },
                          },
                          registrations: {
                            type: 'object',
                            properties: {
                              total: { type: 'integer', example: 500 },
                              byStatus: {
                                type: 'object',
                                properties: {
                                  confirmed: {
                                    type: 'integer',
                                    example: 400,
                                  },
                                  cancelled: {
                                    type: 'integer',
                                    example: 50,
                                  },
                                  attended: {
                                    type: 'integer',
                                    example: 50,
                                  },
                                },
                              },
                            },
                          },
                          topEvents: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Event' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Not authenticated' },
            403: { description: 'Admin role required' },
          },
        },
      },
      '/api/admin/users': {
        get: {
          tags: ['Admin'],
          summary: 'List all users',
          description:
            'Returns a paginated list of all users with optional search and role filter.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/SearchParam' },
            {
              in: 'query',
              name: 'role',
              schema: {
                type: 'string',
                enum: ['attendee', 'organizer', 'admin'],
              },
            },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: { description: 'Paginated user list' },
            401: { description: 'Not authenticated' },
            403: { description: 'Admin role required' },
          },
        },
      },
      '/api/admin/users/{id}/role': {
        put: {
          tags: ['Admin'],
          summary: 'Update user role',
          description:
            'Changes a user\'s role. Admin cannot change their own role. Cannot remove the last admin.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['role'],
                  properties: {
                    role: {
                      type: 'string',
                      enum: ['attendee', 'organizer', 'admin'],
                      example: 'organizer',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'User role updated' },
            400: { description: 'Invalid role or last admin check' },
            403: { description: 'Cannot change own role' },
            404: { description: 'User not found' },
          },
        },
      },
      '/api/admin/users/{id}/toggle-active': {
        put: {
          tags: ['Admin'],
          summary: 'Toggle user active status',
          description:
            'Activates or deactivates a user account. Admin cannot deactivate themselves.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'User active status toggled' },
            403: { description: 'Cannot deactivate self' },
            404: { description: 'User not found' },
          },
        },
      },
      '/api/admin/users/{id}': {
        delete: {
          tags: ['Admin'],
          summary: 'Delete a user',
          description:
            'Permanently deletes a user, their registrations, and cancels organizer events. Cannot delete self or last admin.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'User deleted successfully' },
            400: { description: 'Cannot delete last admin' },
            403: { description: 'Cannot delete self' },
            404: { description: 'User not found' },
          },
        },
      },
      '/api/admin/events': {
        get: {
          tags: ['Admin'],
          summary: 'List all events (any status)',
          description:
            'Returns a paginated list of all events regardless of status with optional search, status, and organizer filters.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: '#/components/parameters/SearchParam' },
            {
              in: 'query',
              name: 'status',
              schema: {
                type: 'string',
                enum: ['draft', 'published', 'cancelled', 'completed'],
              },
            },
            {
              in: 'query',
              name: 'organizer',
              schema: { type: 'string' },
              description: 'Filter by organizer ID',
            },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: { description: 'Paginated event list' },
            401: { description: 'Not authenticated' },
            403: { description: 'Admin role required' },
          },
        },
      },
      '/api/admin/events/{id}/room': {
        get: {
          tags: ['Admin'],
          summary: 'Get event registrations and room details',
          description:
            'Returns registrations for this event and existing room credentials. Admin access is required.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'Event registrations and room details' },
            400: { description: 'Event must have a team format configured' },
            401: { description: 'Not authenticated' },
            403: { description: 'Admin role required' },
            404: { description: 'Event not found' },
          },
        },
        put: {
          tags: ['Admin'],
          summary: 'Publish room details to eligible teams',
          description:
            'Assigns unique slots to every confirmed and payment-eligible team, persists room details, and sends email notifications to team contacts.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['roomId', 'roomPassword', 'matchAt', 'assignments'],
                  properties: {
                    roomId: { type: 'string', maxLength: 80 },
                    roomPassword: { type: 'string', maxLength: 80 },
                    matchAt: { type: 'string', format: 'date-time' },
                    assignments: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        required: ['registrationId', 'slotNumber'],
                        properties: {
                          registrationId: { type: 'string' },
                          slotNumber: { type: 'integer', minimum: 1, maximum: 100000 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Room details published; includes email delivery counts' },
            400: { description: 'Invalid room, slots, or no eligible teams' },
            401: { description: 'Not authenticated' },
            403: { description: 'Admin role required' },
            404: { description: 'Event not found' },
            409: { description: 'Conflicting room slot data' },
          },
        },
      },
      '/api/admin/events/{id}/room/draft': {
        put: {
          tags: ['Admin'],
          summary: 'Save event room details as a draft',
          description: 'Stores event-scoped room credentials and slot assignments without exposing them to users or sending email.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['roomId', 'roomPassword', 'matchAt'],
                  properties: {
                    roomId: { type: 'string', maxLength: 80 },
                    roomPassword: { type: 'string', maxLength: 80 },
                    matchAt: { type: 'string', format: 'date-time' },
                    instructions: { type: 'string', maxLength: 1000 },
                    assignments: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['registrationId', 'slotNumber'],
                        properties: {
                          registrationId: { type: 'string' },
                          slotNumber: { type: 'integer', minimum: 1, maximum: 100000 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Draft saved; not visible to users' },
            400: { description: 'Invalid room details or slot assignments' },
            403: { description: 'Admin role required' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/admin/events/{id}/room/resend-failed': {
        post: {
          tags: ['Admin'],
          summary: 'Resend failed event room emails',
          description: 'Retries only failed deliveries for eligible registrations belonging to the selected event.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'Email retry counts' },
            400: { description: 'Room details have not been published' },
            403: { description: 'Admin role required' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/admin/events/{id}/room/resend': {
        post: {
          tags: ['Admin'],
          summary: 'Resend room details to eligible event teams',
          description: 'Explicitly resends the currently published room details to eligible registrations belonging to this event.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'Email delivery counts' },
            400: { description: 'Room details have not been published' },
            403: { description: 'Admin role required' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/admin/events/{id}/status': {
        put: {
          tags: ['Admin'],
          summary: 'Update event status',
          description:
            'Changes an event\'s status with transition validation (e.g., draft → published/cancelled, published → cancelled/completed).',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: {
                      type: 'string',
                      enum: ['draft', 'published', 'cancelled', 'completed'],
                      example: 'published',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Event status updated' },
            400: { description: 'Invalid status transition' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/admin/events/{id}': {
        delete: {
          tags: ['Admin'],
          summary: 'Delete any event',
          description:
            'Permanently deletes an event and all associated registrations.',
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/MongoId' }],
          responses: {
            200: { description: 'Event deleted successfully' },
            404: { description: 'Event not found' },
          },
        },
      },
      '/api/admin/registrations': {
        get: {
          tags: ['Admin'],
          summary: 'List all registrations',
          description:
            'Returns a paginated list of all registrations system-wide with optional event, user, and status filters.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'query',
              name: 'event',
              schema: { type: 'string' },
              description: 'Filter by event ID',
            },
            {
              in: 'query',
              name: 'user',
              schema: { type: 'string' },
              description: 'Filter by user ID',
            },
            {
              in: 'query',
              name: 'status',
              schema: {
                type: 'string',
                enum: ['pending', 'confirmed', 'cancelled', 'attended'],
              },
            },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            200: { description: 'Paginated registration list' },
            401: { description: 'Not authenticated' },
            403: { description: 'Admin role required' },
          },
        },
      },

      // ─── Upload ────────────────────────────────────────────────
      '/api/upload/image': {
        post: {
          tags: ['Upload'],
          summary: 'Upload event image',
          description:
            'Uploads a single image file. Accepts JPEG, PNG, GIF, and WebP. Max size: 5MB. Organizer or admin only.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['image'],
                  properties: {
                    image: {
                      type: 'string',
                      format: 'binary',
                      description:
                        'Image file (JPEG, PNG, GIF, or WebP, max 5MB)',
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Image uploaded successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          url: {
                            type: 'string',
                            example: '/uploads/event-1234567890-987654321.jpg',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'No image file provided' },
            401: { description: 'Not authenticated' },
            403: { description: 'Not authorized' },
            429: { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/upload/{filename}': {
        delete: {
          tags: ['Upload'],
          summary: 'Delete uploaded image',
          description:
            'Deletes an uploaded image by filename. Path traversal protection applied.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              in: 'path',
              name: 'filename',
              required: true,
              schema: { type: 'string' },
              description: 'Filename of the uploaded image',
              example: 'event-1234567890-987654321.jpg',
            },
          ],
          responses: {
            200: {
              description: 'Image deleted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: {
                        type: 'string',
                        example: 'Image deleted successfully',
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Invalid filename' },
            401: { description: 'Not authenticated' },
            403: { description: 'Not authorized' },
            404: { description: 'File not found' },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
