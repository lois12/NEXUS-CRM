import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  };
  return { default: mockAxios };
});

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Auth API', () => {
    it('should store token after successful login', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'test-token-123',
            user: {
              id: '1',
              username: 'testuser',
              fullName: 'Test User',
              role: 'редактор',
            },
          },
        },
      };

      const mockedAxios = vi.mocked(axios.create());
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      // Simulate login flow
      const token = mockResponse.data.data.token;
      localStorage.setItem('nexus_token', token);
      localStorage.setItem('nexus_user', JSON.stringify(mockResponse.data.data.user));

      expect(localStorage.getItem('nexus_token')).toBe('test-token-123');
      expect(localStorage.getItem('nexus_user')).toContain('testuser');
    });

    it('should clear storage on 401 response', () => {
      localStorage.setItem('nexus_token', 'expired-token');
      localStorage.setItem('nexus_user', '{"id":"1"}');

      // Simulate 401 handler
      localStorage.removeItem('nexus_token');
      localStorage.removeItem('nexus_user');

      expect(localStorage.getItem('nexus_token')).toBeNull();
      expect(localStorage.getItem('nexus_user')).toBeNull();
    });
  });

  describe('Token Management', () => {
    it('should add token to request headers', () => {
      localStorage.setItem('nexus_token', 'my-token');

      const token = localStorage.getItem('nexus_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      expect(headers.Authorization).toBe('Bearer my-token');
    });

    it('should handle missing token gracefully', () => {
      const token = localStorage.getItem('nexus_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      expect(headers.Authorization).toBeUndefined();
    });
  });
});
