import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

export const generateKeyPair = () => {
  const publicKey = randomBytes(64).toString('hex');
  const privateKey = randomBytes(64).toString('hex');

  return {
    publicKey,
    privateKey,
  };
};

export const createJWTTokenPair = (payload: object, publicKey: string, privateKey: string) => {
  try {
    const accessToken = jwt.sign(payload, publicKey, {
      expiresIn: '1 days',
      algorithm: 'HS256',
    });

    const refreshToken = jwt.sign(payload, privateKey, {
      expiresIn: '4 days',
      algorithm: 'HS256',
    });
    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    throw new Error('Cannot generate JWT token pair');
  }
};

export const generateAccessToken = (payload: object, publicKey: string) => {
  try {
    const accessToken = jwt.sign(payload, publicKey, {
      expiresIn: '1 days',
    });

    return accessToken;
  } catch (error) {
    throw new Error('Cannot refresh token');
  }
};
