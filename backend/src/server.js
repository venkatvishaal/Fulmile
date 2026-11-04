const Sentry = require('./instrument');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const sequelize = require('./config/database');
const AppError = require('./utils/AppError');
const { enableRls } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const driverRoutes = require('./routes/drivers');
const tripRoutes = require('./routes/trips');
const maintenanceRoutes = require('./routes/maintenance');
const fuelRoutes = require('./routes/fuelLogs');
const expenseRoutes = require('./routes/expenses');
const reportRoutes = require('./routes/reports');
const trackingRoutes = require('./routes/tracking');
const carrierRoutes = require('./routes/carriers');
const freightBookingRoutes = require('./routes/freightBookings');

const app = express();
const server = http.createServer(app);

// Socket.io Setup
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.set('io', io);

// Middleware
app.set('trust proxy', 1); // Render sits in front of us; rate limits need the real client IP
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true
}));
app.use(morgan('dev'));

app.use(express.json({ limit: '1mb' }));

// General API ceiling per IP
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down and try again in a few minutes.' }
}));

// Socket.io Connection Room Setup
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  socket.on('join', (room) => {
    console.log(`Socket ${socket.id} joined room: ${room}`);
    socket.join(room);
  });

  socket.on('driverLocation', ({ trip_id, latitude, longitude, location, speed }) => {
    if (!trip_id || latitude === undefined || longitude === undefined) return;
    
    io.to(trip_id).emit('trackingUpdated', {
      id: `live-${Date.now()}`,
      trip_id,
      latitude,
      longitude,
      location: location || 'Live GPS Position',
      status: 'in_transit',
      speed: speed || null,
      notes: null,
      timestamp: new Date().toISOString(),
      isLive: true
    });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Routes
app.get('/', (req, res) => res.json({ name: 'TransitOps API', status: 'online', health: '/api/health' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/fuel-logs', fuelRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/carriers', carrierRoutes);
app.use('/api/freight-bookings', freightBookingRoutes);

// Fallback route
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

Sentry.setupExpressErrorHandler(app);

// Global Error Handler
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  console.error('SERVER ERROR 💥:', err);

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || undefined
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Something went wrong on the server'
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Refusing to start: add it to backend/.env (local) or the Render environment.');
    process.exit(1);
  }
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Auto-run schema migration for carriers, freight_bookings, and roles
    try {
      const migrateCarrierShipper = require('./scripts/migrateCarrierShipper');
      await migrateCarrierShipper();
      console.log('Carrier & Shipper database schema successfully synchronized.');
    } catch (migErr) {
      console.warn('Schema auto-migration notice:', migErr?.message || migErr);
    }

    const [[{ ready }]] = await sequelize.query("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'transitops_app') AS ready");
    enableRls(ready);
    if (!ready) console.warn('Row-level security is OFF: run `npm run db:migrate-auth` to enable it.');
    
    server.listen(PORT, () => {
      console.log(`TransitOps server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    console.error('Unable to start TransitOps server:', error);
    process.exit(1);
  }
};

startServer();
