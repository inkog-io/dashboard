import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/dashboard';
  },
}));

// Mock Clerk
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isSignedIn: true,
    userId: 'test-user-id',
    getToken: jest.fn().mockResolvedValue('mock-token'),
  }),
  useUser: () => ({
    isSignedIn: true,
    user: {
      id: 'test-user-id',
      fullName: 'Test User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
  }),
  SignedIn: ({ children }) => children,
  SignedOut: () => null,
  UserButton: () => null,
  ClerkProvider: ({ children }) => children,
}));

// Mock PostHog
jest.mock('posthog-js', () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
