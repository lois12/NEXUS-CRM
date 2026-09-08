import { describe, it, expect } from 'vitest';

// Type definitions matching the project
interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  roles: string[];
  avatar?: string;
  position?: string;
  about?: string;
  status?: string;
  socialLinks?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

interface ContentPost {
  id: string;
  title: string;
  content: string;
  platform: string;
  status: string;
  scheduledDate?: string;
  publishedDate?: string;
  imageUrl?: string;
  authorId: string;
}

interface Material {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  mimeType?: string;
  folder?: string;
  tags?: string;
}

interface DashboardStats {
  totalUsers: number;
  totalPosts: number;
  totalMaterials: number;
  recentActivities: any[];
}

describe('Type Safety Tests', () => {
  describe('User type', () => {
    it('should accept valid user object', () => {
      const user: User = {
        id: '1',
        username: 'test',
        email: 'test@test.com',
        fullName: 'Test User',
        role: 'редактор',
        roles: ['редактор'],
      };

      expect(user.id).toBe('1');
      expect(user.roles).toContain('редактор');
    });

    it('should allow optional fields', () => {
      const user: User = {
        id: '1',
        username: 'test',
        email: 'test@test.com',
        fullName: 'Test',
        role: 'admin',
        roles: ['admin'],
        avatar: '/uploads/avatar.jpg',
        position: 'Developer',
        about: 'About me',
        status: 'online',
        socialLinks: { telegram: '@test' },
      };

      expect(user.socialLinks?.telegram).toBe('@test');
    });
  });

  describe('ApiResponse type', () => {
    it('should represent success response', () => {
      const response: ApiResponse<User> = {
        success: true,
        data: {
          id: '1',
          username: 'test',
          email: 'test@test.com',
          fullName: 'Test',
          role: 'admin',
          roles: ['admin'],
        },
      };

      expect(response.success).toBe(true);
      expect(response.data?.username).toBe('test');
    });

    it('should represent error response', () => {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Something went wrong',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
    });
  });

  describe('LoginRequest type', () => {
    it('should accept valid login data', () => {
      const request: LoginRequest = {
        username: 'admin',
        password: 'secret',
      };

      expect(request.username).toBe('admin');
    });
  });

  describe('ContentPost type', () => {
    it('should accept valid content post', () => {
      const post: ContentPost = {
        id: '1',
        title: 'Test Post',
        content: 'Post content',
        platform: 'telegram',
        status: 'черновик',
        authorId: 'user-1',
      };

      expect(post.platform).toBe('telegram');
      expect(post.status).toBe('черновик');
    });
  });
});
