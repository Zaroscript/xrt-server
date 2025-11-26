import jwt from 'jsonwebtoken';

export const generateAccessToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    isApproved: user.isApproved,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
    algorithm: "HS256",
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { 
      algorithms: ["HS256"],
      ignoreExpiration: false
    });
  } catch (error) {
    console.error("Token verification failed:", error.message);
    throw error;
  }
};

export const generateRefreshToken = (user) => {
  const payload = {
    id: user._id,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256",
  });
};