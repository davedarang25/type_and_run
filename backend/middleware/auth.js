const jwt = require('jsonwebtoken');
const { HttpError } = require('./errors');

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set in .env');
  return s;
};

const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

/** Requires "Authorization: Bearer <token>"; sets req.userId. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Sign in required'));
  try {
    const payload = jwt.verify(token, secret());
    req.userId = Number(payload.sub);
    next();
  } catch {
    next(new HttpError(401, 'Session expired, please sign in again'));
  }
}

module.exports = { requireAuth, signToken };
