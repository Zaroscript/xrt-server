import jwt from 'jsonwebtoken';

const generateAccessToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    isApproved: user.isApproved
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      algorithm: 'HS256'
    }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      algorithm: 'HS256'
    }
  );
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};

export { generateAccessToken, generateRefreshToken, verifyToken };