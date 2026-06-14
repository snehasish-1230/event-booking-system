require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Event = require('../models/Event');

const { ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, ADMIN_SEED_NAME } = process.env;

if (!ADMIN_SEED_EMAIL || !ADMIN_SEED_PASSWORD) {
  console.error(
    'Usage: ADMIN_SEED_EMAIL=xxx ADMIN_SEED_PASSWORD=xxx npm run seed'
  );
  console.error('Set these values in your .env file or pass them inline.');
  process.exit(1);
}

const generateFutureDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

const seedEvents = [
  {
    title: 'Global Tech Summit 2026',
    description:
      'Join industry leaders and innovators at the biggest tech conference of the year. Explore cutting-edge technologies including AI, blockchain, cloud computing, and more. Network with thousands of professionals from around the world.',
    date: generateFutureDate(30),
    endDate: generateFutureDate(32),
    time: '09:00',
    location: {
      venue: 'Istanbul Congress Center',
      address: 'Darulbedai Cad. No:3, Harbiye',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 2000,
    price: 149.99,
    currency: 'USD',
    category: 'conference',
    tags: ['technology', 'ai', 'blockchain', 'innovation'],
    status: 'published',
    isFeatured: true,
  },
  {
    title: 'React & Next.js Workshop',
    description:
      'A hands-on workshop covering modern React patterns, Server Components, and Next.js App Router. Build a full-stack application from scratch with live coding sessions and expert guidance.',
    date: generateFutureDate(14),
    endDate: generateFutureDate(14),
    time: '10:00',
    location: {
      venue: 'Kolektif House Levent',
      address: 'Buyukdere Cad. No:185',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 50,
    price: 79.99,
    currency: 'USD',
    category: 'workshop',
    tags: ['react', 'nextjs', 'frontend', 'javascript'],
    status: 'published',
    isFeatured: true,
  },
  {
    title: 'Startup Networking Night',
    description:
      'Connect with fellow entrepreneurs, investors, and startup enthusiasts in a relaxed evening atmosphere. Pitch your ideas, find co-founders, and discover new opportunities in the startup ecosystem.',
    date: generateFutureDate(7),
    time: '19:00',
    location: {
      venue: 'Soho House Istanbul',
      address: 'Mesrutiyet Cad. No:56, Beyoglu',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 150,
    price: 0,
    currency: 'TRY',
    category: 'networking',
    tags: ['startup', 'entrepreneurship', 'networking', 'investors'],
    status: 'published',
    isFeatured: true,
  },
  {
    title: 'Cloud Architecture Seminar',
    description:
      'Deep dive into cloud architecture patterns with AWS and Azure. Learn about microservices, serverless computing, container orchestration, and best practices for building scalable distributed systems.',
    date: generateFutureDate(21),
    time: '13:00',
    location: {
      venue: 'Microsoft Turkey Office',
      address: 'Bellevue Residences, Levent',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 120,
    price: 49.99,
    currency: 'USD',
    category: 'seminar',
    tags: ['cloud', 'aws', 'azure', 'devops'],
    status: 'published',
    isFeatured: false,
  },
  {
    title: 'JavaScript Developers Meetup',
    description:
      'Monthly meetup for JavaScript enthusiasts. This month we cover TypeScript 6.0 features, Bun runtime performance benchmarks, and building real-time applications with WebSockets.',
    date: generateFutureDate(10),
    time: '18:30',
    location: {
      venue: 'Workinton Maslak',
      address: 'Maslak Mah. Eski Buyukdere Cad.',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 80,
    price: 0,
    currency: 'TRY',
    category: 'meetup',
    tags: ['javascript', 'typescript', 'bun', 'community'],
    status: 'published',
    isFeatured: false,
  },
  {
    title: 'Summer Music Festival',
    description:
      'Three days of live music featuring local and international artists across multiple stages. Enjoy rock, electronic, jazz, and indie performances in the heart of the city with food trucks and art installations.',
    date: generateFutureDate(45),
    endDate: generateFutureDate(47),
    time: '16:00',
    location: {
      venue: 'Parkorman',
      address: 'Maslak, Sariyer',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 5000,
    price: 299.99,
    currency: 'TRY',
    category: 'concert',
    tags: ['music', 'festival', 'live', 'entertainment'],
    status: 'published',
    isFeatured: true,
  },
  {
    title: 'Marathon Istanbul 2026',
    description:
      'Annual international marathon crossing two continents. Run across the iconic Bosphorus Bridge and experience the beauty of Istanbul. Categories include full marathon, half marathon, and 10K fun run.',
    date: generateFutureDate(60),
    time: '07:00',
    location: {
      venue: 'Bosphorus Bridge Start Point',
      address: '15 Temmuz Sehitler Koprusu',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 10000,
    price: 150,
    currency: 'TRY',
    category: 'sports',
    tags: ['marathon', 'running', 'sports', 'fitness'],
    status: 'published',
    isFeatured: true,
  },
  {
    title: 'AI & Machine Learning Webinar',
    description:
      'Online webinar exploring the latest trends in artificial intelligence and machine learning. Topics include large language models, computer vision, reinforcement learning, and ethical AI practices.',
    date: generateFutureDate(5),
    time: '14:00',
    location: {
      venue: 'Online - Zoom',
      address: 'Virtual Event',
      city: 'Online',
      country: 'Global',
    },
    capacity: 500,
    price: 0,
    currency: 'USD',
    category: 'webinar',
    tags: ['ai', 'machine-learning', 'deep-learning', 'online'],
    status: 'published',
    isFeatured: false,
  },
  {
    title: 'UX/UI Design Bootcamp',
    description:
      'Intensive 2-day bootcamp covering user experience research, wireframing, prototyping with Figma, design systems, and usability testing. Perfect for beginners and intermediate designers looking to level up.',
    date: generateFutureDate(18),
    endDate: generateFutureDate(19),
    time: '09:30',
    location: {
      venue: 'Bilgi University Santral Campus',
      address: 'Eski Silahtaraga Elektrik Santrali, Eyupsultan',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 40,
    price: 129.99,
    currency: 'USD',
    category: 'workshop',
    tags: ['ux', 'ui', 'design', 'figma'],
    status: 'published',
    isFeatured: false,
  },
  {
    title: 'Cybersecurity Conference',
    description:
      'Annual cybersecurity conference bringing together security professionals, ethical hackers, and researchers. Featuring live hacking demos, CTF challenges, and talks on zero-day vulnerabilities and threat intelligence.',
    date: generateFutureDate(35),
    endDate: generateFutureDate(36),
    time: '10:00',
    location: {
      venue: 'Hilton Istanbul Bomonti',
      address: 'Silahsor Cad. No:42, Sisli',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 300,
    price: 199.99,
    currency: 'USD',
    category: 'conference',
    tags: ['cybersecurity', 'hacking', 'infosec', 'ctf'],
    status: 'published',
    isFeatured: false,
  },
  {
    title: 'Blockchain & Web3 Summit',
    description:
      'Explore the decentralized future at this comprehensive summit covering DeFi, NFTs, smart contracts, and DAOs. Hear from blockchain pioneers and learn how Web3 is reshaping industries.',
    date: generateFutureDate(25),
    time: '10:00',
    location: {
      venue: 'Raffles Istanbul',
      address: 'Zorlu Center, Besiktas',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 200,
    price: 99.99,
    currency: 'USD',
    category: 'conference',
    tags: ['blockchain', 'web3', 'defi', 'crypto'],
    status: 'published',
    isFeatured: false,
  },
  {
    title: 'Photography Walk: Hidden Istanbul',
    description:
      'Discover the hidden gems of Istanbul through your camera lens. A guided photography walk through historic neighborhoods, capturing street art, architecture, and everyday life. All camera types welcome.',
    date: generateFutureDate(12),
    time: '08:00',
    location: {
      venue: 'Balat Meeting Point',
      address: 'Balat Mahallesi, Fatih',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 25,
    price: 50,
    currency: 'TRY',
    category: 'other',
    tags: ['photography', 'culture', 'walking-tour', 'istanbul'],
    status: 'published',
    isFeatured: false,
  },
  {
    title: 'Data Engineering with Python',
    description:
      'Full-day workshop on building data pipelines with Python. Learn Apache Airflow, PySpark, data modeling, ETL best practices, and how to build production-ready data infrastructure from scratch.',
    date: generateFutureDate(22),
    time: '09:00',
    location: {
      venue: 'Google Developer Hub',
      address: 'Maslak Mah., Sariyer',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 60,
    price: 89.99,
    currency: 'USD',
    category: 'workshop',
    tags: ['python', 'data-engineering', 'airflow', 'spark'],
    status: 'published',
    isFeatured: false,
  },
  {
    title: 'Acoustic Jazz Night',
    description:
      'An intimate evening of live acoustic jazz performances featuring top Turkish and international jazz artists. Enjoy world-class music with craft cocktails and gourmet appetizers in a cozy venue.',
    date: generateFutureDate(8),
    time: '20:00',
    location: {
      venue: 'Nardis Jazz Club',
      address: 'Galata Kulesi Sokak No:14, Beyoglu',
      city: 'Istanbul',
      country: 'Turkey',
    },
    capacity: 100,
    price: 175,
    currency: 'TRY',
    category: 'concert',
    tags: ['jazz', 'live-music', 'acoustic', 'nightlife'],
    status: 'published',
    isFeatured: false,
  },
];

const seed = async () => {
  try {
    await connectDB();

    // --- Admin seed ---
    let admin = await User.findOne({ role: 'admin' });

    if (admin) {
      console.log('Admin already exists, skipping admin creation.');
    } else {
      admin = await User.create({
        name: ADMIN_SEED_NAME || 'Admin',
        email: ADMIN_SEED_EMAIL,
        password: ADMIN_SEED_PASSWORD,
        role: 'admin',
      });
      console.log(`Admin created with email: ${ADMIN_SEED_EMAIL}`);
    }

    // --- Events seed ---
    const existingCount = await Event.countDocuments({ organizer: admin._id });

    if (existingCount >= seedEvents.length) {
      console.log(
        `Events already seeded (${existingCount} found), skipping.`
      );
      process.exit(0);
    }

    let created = 0;

    for (const eventData of seedEvents) {
      const exists = await Event.findOne({ title: eventData.title });

      if (!exists) {
        await Event.create({ ...eventData, organizer: admin._id });
        created++;
      }
    }

    console.log(`${created} events created by admin.`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seed();
