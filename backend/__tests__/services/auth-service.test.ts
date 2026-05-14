import { jest } from '@jest/globals';

const mockSign = jest.fn().mockReturnValue('mock-jwt-token');
const mockVerify = jest.fn().mockReturnValue({ username: 'admin', role: 'superadmin', iat: 123, exp: 456 });
const mockDecode = jest.fn().mockReturnValue({ username: 'admin', role: 'superadmin' });

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: { sign: mockSign, verify: mockVerify, decode: mockDecode },
  sign: mockSign,
  verify: mockVerify,
  decode: mockDecode,
}));

let createAuthService: any;

beforeAll(async () => {
  const mod = await import('../../src/services/auth-service.js');
  createAuthService = mod.createAuthService;
});

import type { AppConfig } from '../../src/env.js';

const defaultConfig: AppConfig = {
  HOST: '',
  PORT: 0,
  API_PATH_PREFIX: '',
  SUPERUSER_USER: 'admin',
  SUPERUSER_PASS: 'secret123',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRES_IN: '1h',
  ENABLE_FRONTEND: false,
  DATA_ROOT: '',
  SQLITE_FILENAME: '',
  PLANNER_CRON: '',
  SEED_ON_BOOTSTRAP: false,
};

function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return { ...defaultConfig, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createAuthService', () => {
  it('returns an AuthService object with login, verifyToken, revokeToken methods', () => {
    const auth = createAuthService(makeConfig());
    expect(auth).toHaveProperty('login');
    expect(auth).toHaveProperty('verifyToken');
    expect(auth).toHaveProperty('revokeToken');
    expect(typeof auth.login).toBe('function');
    expect(typeof auth.verifyToken).toBe('function');
    expect(typeof auth.revokeToken).toBe('function');
  });
});

describe('login', () => {
  it('returns null when username does not match SUPERUSER_USER', async () => {
    const auth = createAuthService(makeConfig());
    const result = await auth.login('wronguser', 'secret123');
    expect(result).toBeNull();
  });

  it('returns null when password does not match SUPERUSER_PASS', async () => {
    const auth = createAuthService(makeConfig());
    const result = await auth.login('admin', 'wrongpass');
    expect(result).toBeNull();
  });

  it('returns null when both credentials do not match', async () => {
    const auth = createAuthService(makeConfig());
    const result = await auth.login('wronguser', 'wrongpass');
    expect(result).toBeNull();
  });

  it('returns { token, user } when credentials are correct', async () => {
    const auth = createAuthService(makeConfig());
    const result = await auth.login('admin', 'secret123');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result!.token).toBe('mock-jwt-token');
  });

  it('calls jwt.sign with correct secret and expiresIn', async () => {
    const auth = createAuthService(makeConfig({
      JWT_SECRET: 'my-secret',
      JWT_EXPIRES_IN: '48h',
    }));
    await auth.login('admin', 'secret123');
    expect(mockSign).toHaveBeenCalledWith(
      { username: 'admin', role: 'superadmin' },
      'my-secret',
      { expiresIn: '48h' },
    );
  });

  it('returns user object with correct username and role', async () => {
    const auth = createAuthService(makeConfig());
    const result = await auth.login('admin', 'secret123');
    expect(result!.user).toEqual({
      username: 'admin',
      role: 'superadmin',
    });
  });

  it('does not call jwt.sign when credentials are wrong', async () => {
    const auth = createAuthService(makeConfig());
    await auth.login('bad', 'creds');
    expect(mockSign).not.toHaveBeenCalled();
  });
});

describe('verifyToken', () => {
  it('returns decoded payload when token is valid', () => {
    const auth = createAuthService(makeConfig());
    const payload = auth.verifyToken('valid-token');
    expect(payload).toEqual({
      username: 'admin',
      role: 'superadmin',
      iat: 123,
      exp: 456,
    });
  });

  it('returns null when token is invalid (jwt.verify throws)', () => {
    mockVerify.mockImplementationOnce(() => { throw new Error('jwt malformed'); });
    const auth = createAuthService(makeConfig());
    const payload = auth.verifyToken('bad-token');
    expect(payload).toBeNull();
  });

  it('returns null when token is blacklisted', () => {
    const auth = createAuthService(makeConfig());
    auth.revokeToken('compromised-token');
    const payload = auth.verifyToken('compromised-token');
    expect(payload).toBeNull();
  });

  it('verifyToken calls jwt.verify with correct secret', () => {
    const auth = createAuthService(makeConfig({ JWT_SECRET: 'custom-secret' }));
    auth.verifyToken('some-token');
    expect(mockVerify).toHaveBeenCalledWith('some-token', 'custom-secret');
  });

  it('does not call jwt.verify when token is already blacklisted', () => {
    mockVerify.mockClear();
    const auth = createAuthService(makeConfig());
    auth.revokeToken('revoked-token');
    auth.verifyToken('revoked-token');
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('handles multiple revocations and still allows non-blacklisted tokens', () => {
    const auth = createAuthService(makeConfig());
    auth.revokeToken('token-a');
    auth.revokeToken('token-b');
    expect(auth.verifyToken('token-a')).toBeNull();
    expect(auth.verifyToken('token-b')).toBeNull();
    expect(auth.verifyToken('token-c')).not.toBeNull();
  });

  it('token blacklist is isolated per service instance', () => {
    const auth1 = createAuthService(makeConfig());
    const auth2 = createAuthService(makeConfig());
    auth1.revokeToken('shared-token');
    expect(auth1.verifyToken('shared-token')).toBeNull();
    expect(auth2.verifyToken('shared-token')).not.toBeNull();
  });
});

describe('revokeToken', () => {
  it('adds token to blacklist', () => {
    const auth = createAuthService(makeConfig());
    auth.revokeToken('token-to-revoke');
    expect(auth.verifyToken('token-to-revoke')).toBeNull();
  });

  it('blacklisted token returns null from verifyToken', () => {
    const auth = createAuthService(makeConfig());
    auth.revokeToken('bad-token');
    expect(auth.verifyToken('bad-token')).toBeNull();
  });

  it('non-blacklisted tokens still work after revoking unrelated tokens', () => {
    const auth = createAuthService(makeConfig());
    auth.revokeToken('revoked-one');
    expect(auth.verifyToken('good-token')).not.toBeNull();
  });

  it('revoking the same token multiple times does not error', () => {
    const auth = createAuthService(makeConfig());
    expect(() => {
      auth.revokeToken('dup');
      auth.revokeToken('dup');
      auth.revokeToken('dup');
    }).not.toThrow();
  });
});
