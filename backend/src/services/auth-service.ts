import jwt from 'jsonwebtoken';
import { AppConfig } from '../env.js';
import { AuthPayload } from '../types.js';

export interface AuthService {
  login(username: string, password: string): Promise<{ token: string; user: { username: string; role: string } } | null>;
  verifyToken(token: string): AuthPayload | null;
  revokeToken(token: string): void;
}

export function createAuthService(config: AppConfig): AuthService {
  const blacklist: Set<string> = new Set();

  return {
    async login(username, password) {
      if (username !== config.SUPERUSER_USER || password !== config.SUPERUSER_PASS) {
        return null;
      }

      const payload: AuthPayload = {
        username,
        role: 'superadmin',
      };

      const token = jwt.sign(
        payload,
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions
      );

      return {
        token,
        user: { username, role: 'superadmin' },
      };
    },

    verifyToken(token) {
      if (blacklist.has(token)) {
        return null;
      }

      try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as AuthPayload;
        return decoded;
      } catch {
        return null;
      }
    },

    revokeToken(token) {
      blacklist.add(token);
    },
  };
}
