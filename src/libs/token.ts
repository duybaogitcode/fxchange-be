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
    });

    const refreshToken = jwt.sign(payload, privateKey, {
      expiresIn: '4 days',
    });
    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    console.log('🚀 ~ file: token.ts:28 ~ createJWTTokenPair ~ error:', error);
    throw new Error('Cannot generate JWT token pair');
  }
};
