export type MockRole = 'customer' | 'admin';

const toBool = (value: string | undefined) =>
  ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

export const MOCK_LOGGED_OUT_KEY = 'dev_mock_logged_out';

export function isDevMockEnabled(): boolean {
  return toBool(import.meta.env.VITE_DEV_MOCK_ENABLED);
}

export function isMockAutoLoginEnabled(): boolean {
  return toBool(import.meta.env.VITE_DEV_MOCK_AUTO_LOGIN);
}

export function getMockAuthPayloadForRole(role: MockRole) {
  if (role === 'admin') {
    return {
      accessToken: 'dev-mock-admin-token',
      role: 'admin' as const,
      forcePasswordChange: false,
    };
  }

  return {
    accessToken: 'dev-mock-customer-token',
    role: 'customer' as const,
    forcePasswordChange: false,
  };
}
