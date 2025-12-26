/**
 * API Client Tests
 *
 * Tests for the Inkog Dashboard API client including:
 * - Retry logic with exponential backoff
 * - Error handling
 * - Authentication
 */

import { createAPIClient, InkogAPIError } from '@/lib/api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  const mockGetToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetToken.mockResolvedValue('mock-token');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Authentication', () => {
    it('should throw InkogAPIError when not authenticated', async () => {
      mockGetToken.mockResolvedValue(null);
      const client = createAPIClient(mockGetToken);

      await expect(client.keys.list()).rejects.toThrow(InkogAPIError);
      await expect(client.keys.list()).rejects.toMatchObject({
        code: 'not_authenticated',
        status: 401,
      });
    });

    it('should include Bearer token in requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, api_keys: [], count: 0 }),
      });

      const client = createAPIClient(mockGetToken);
      await client.keys.list();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw InkogAPIError on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          code: 'invalid_request',
          message: 'Invalid request parameters',
        }),
      });

      const client = createAPIClient(mockGetToken);

      try {
        await client.keys.list();
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InkogAPIError);
        expect((error as InkogAPIError).code).toBe('invalid_request');
        expect((error as InkogAPIError).status).toBe(400);
      }
    });

    it('should handle legacy error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400, // Use 400 to avoid retry
        json: () => Promise.resolve({
          error: 'Legacy error message',
        }),
      });

      const client = createAPIClient(mockGetToken);

      try {
        await client.keys.list();
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as InkogAPIError).message).toBe('Legacy error message');
      }
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 429 (rate limit)', async () => {
      // First call: 429, second call: success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ message: 'Rate limited' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, api_keys: [], count: 0 }),
        });

      const client = createAPIClient(mockGetToken);

      const promise = client.keys.list();

      // Fast-forward through retry delay
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 (server error)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, api_keys: [], count: 0 }),
        });

      const client = createAPIClient(mockGetToken);

      const promise = client.keys.list();
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 400 (client error)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad request' }),
      });

      const client = createAPIClient(mockGetToken);

      try {
        await client.keys.list();
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Bad request');
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 401 (unauthorized)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      const client = createAPIClient(mockGetToken);

      try {
        await client.keys.list();
        fail('Expected error to be thrown');
      } catch (error) {
        expect((error as Error).message).toBe('Unauthorized');
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('API Key Methods', () => {
    it('should list API keys', async () => {
      const mockKeys = [
        { id: '1', name: 'Test Key', key_prefix: 'ink_test' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          api_keys: mockKeys,
          count: 1,
        }),
      });

      const client = createAPIClient(mockGetToken);
      const result = await client.keys.list();

      expect(result.success).toBe(true);
      expect(result.api_keys).toEqual(mockKeys);
      expect(result.count).toBe(1);
    });

    it('should create API key with name and scopes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          key: 'ink_live_secret123',
          api_key: { id: '1', name: 'My Key' },
        }),
      });

      const client = createAPIClient(mockGetToken);
      const result = await client.keys.create('My Key', ['scan:read']);

      expect(result.success).toBe(true);
      expect(result.key).toBe('ink_live_secret123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/keys'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My Key', scopes: ['scan:read'] }),
        })
      );
    });

    it('should revoke API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Key revoked',
        }),
      });

      const client = createAPIClient(mockGetToken);
      const result = await client.keys.revoke('key-123');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/keys/key-123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});

describe('InkogAPIError', () => {
  it('should create error with correct properties', () => {
    const error = new InkogAPIError('Test error', 'test_code', 400);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('test_code');
    expect(error.status).toBe(400);
    expect(error.name).toBe('InkogAPIError');
  });

  it('should be instanceof Error', () => {
    const error = new InkogAPIError('Test', 'test', 500);
    expect(error instanceof Error).toBe(true);
  });
});
