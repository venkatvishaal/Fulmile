const jwt = require('jsonwebtoken');
const sequelize = require('../config/database');
const { User } = require('../models');

// Set at startup by server.js once it has checked that the migration created the role.
let rlsEnabled = false;
const enableRls = (on) => { rlsEnabled = on; };

const unauthorized = (res, message) => res.status(401).json({ success: false, message });

// Opens the request transaction, switches to the restricted DB role and records who is asking,
// so the Postgres policies in scripts/migrateAuth.js apply to every query of this request.
const withRlsContext = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    await sequelize.query(
      "SELECT set_config('app.user_id', :id, true), set_config('app.role', :role, true)",
      { replacements: { id: req.user.id, role: req.user.role }, transaction: t }
    );
    await sequelize.query('SET LOCAL ROLE fulmile_app', { transaction: t });
  } catch (error) {
    await t.rollback();
    throw error;
  }

  const finish = (ok) => (t.finished ? Promise.resolve() : (ok ? t.commit() : t.rollback()))
    .catch((err) => console.error('Request transaction failed to close:', err));

  // Commit before the response leaves, so a client that refetches right away sees its own write.
  const end = res.end.bind(res);
  res.end = (...args) => {
    finish(res.statusCode < 400).then(() => end(...args));
    return res;
  };
  res.on('close', () => finish(false));

  sequelize.namespace.run(() => {
    sequelize.namespace.set('transaction', t);
    next();
  });
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'No token provided. Please login.');
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
  } catch (error) {
    return unauthorized(res, error.name === 'TokenExpiredError'
      ? 'Session expired. Please login again.'
      : 'Invalid token. Please login.');
  }
  if (decoded.purpose) return unauthorized(res, 'Invalid token. Please login.');

  try {
    const user = await User.findByPk(decoded.id, { attributes: ['id', 'is_active', 'token_version', 'carrier_id'] });
    if (!user || !user.is_active || user.token_version !== decoded.tv) {
      return unauthorized(res, 'Your session has ended. Please login again.');
    }
    req.user = { ...decoded, carrierId: user.carrier_id || decoded.carrierId || null };
    if (rlsEnabled) return await withRlsContext(req, res, next);
    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userRole = String(req.user.role || '').trim().toLowerCase();
    const allowedRoles = roles.map(r => String(r).trim().toLowerCase());

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

module.exports = { authMiddleware, authorize, enableRls };
