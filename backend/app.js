require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

const authRoutes        = require('./src/routes/auth');
const userRoutes        = require('./src/routes/users');
const patientRoutes     = require('./src/routes/patients');
const medicationRoutes  = require('./src/routes/medications');
const doseRoutes        = require('./src/routes/doses');
const auditRoutes       = require('./src/routes/audit');
const reportRoutes      = require('./src/routes/reports');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(apiLimiter);

app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.originalUrl}`, { ip: req.ip });
  next();
});

app.get('/health', async (_req, res) => {
  const { checkConnection } = require('./src/config/database');
  const dbOk = await checkConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'healthy' : 'degraded',
    db: dbOk ? 'connected' : 'unreachable',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth',        authRoutes);
app.use('/api/users',       userRoutes);
app.use('/api/patients',    patientRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/doses',       doseRoutes);
app.use('/api/audit',       auditRoutes);
app.use('/api/reports',     reportRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;
