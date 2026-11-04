const jwt = require('jsonwebtoken');

const secret = () => process.env.JWT_SECRET;

const signSession = (user, roleName) => jwt.sign(
  {
    id: user.id,
    email: user.email,
    role: roleName,
    carrierId: user.carrier_id || null,
    shipperType: user.shipper_type || null,
    tv: user.token_version
  },
  secret(),
  { expiresIn: process.env.JWT_EXPIRE || '7d' }
);

module.exports = { signSession };
