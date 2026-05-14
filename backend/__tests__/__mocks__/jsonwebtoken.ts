import { jest } from '@jest/globals';

const jsonwebtoken = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ username: 'admin', role: 'superadmin', iat: 123, exp: 456 }),
  decode: jest.fn().mockReturnValue({ username: 'admin', role: 'superadmin' }),
};

export default jsonwebtoken;
export const sign = jsonwebtoken.sign;
export const verify = jsonwebtoken.verify;
export const decode = jsonwebtoken.decode;
