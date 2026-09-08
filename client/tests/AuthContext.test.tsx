import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ReactNode, useEffect } from 'react';

// Mock the API module
vi.mock('../src/services/api', () => ({
  authApi: {
    login: vi.fn(),
    getMe: vi.fn(),
    register: vi.fn(),
  },
}));

import { authApi } from '../src/services/api';

let capturedLogin: ((data: { username: string; password: string }) => Promise<void>) | null = null;
let capturedLogout: (() => void) | null = null;

function TestComponent() {
  const { user, isAuthenticated, isLoading, login, logout, hasRole } = useAuth();

  useEffect(() => {
    capturedLogin = login;
    capturedLogout = logout;
  }, [login, logout]);

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="username">{user?.username || 'none'}</div>
      <div data-testid="role-check">{hasRole('редактор') ? 'is-editor' : 'not-editor'}</div>
    </div>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    capturedLogin = null;
    capturedLogout = null;
  });

  it('should start with no user and finish loading', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('No token'));

    render(<TestComponent />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
  });

  it.skip('should login successfully', async () => {
    const mockUser = {
      id: '1',
      username: 'testuser',
      email: 'test@test.com',
      fullName: 'Test User',
      role: 'редактор',
      roles: ['редактор'],
    };

    vi.mocked(authApi.login).mockResolvedValue({
      success: true,
      data: { token: 'new-token', user: mockUser },
    });

    vi.mocked(authApi.getMe).mockRejectedValue(new Error('No token'));

    render(<TestComponent />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    await act(async () => {
      try {
        await capturedLogin!({ username: 'test', password: 'test' });
      } catch (e) {
        // login may throw
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    });
    expect(screen.getByTestId('username')).toHaveTextContent('testuser');
    expect(localStorage.setItem).toHaveBeenCalledWith('nexus_token', 'new-token');
  });

  it('should logout and clear storage', async () => {
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('No token'));

    render(<TestComponent />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    act(() => {
      capturedLogout!();
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    expect(localStorage.removeItem).toHaveBeenCalledWith('nexus_token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('nexus_user');
  });

  it('should check user roles correctly', async () => {
    const mockUser = {
      id: '1',
      username: 'editor',
      email: 'editor@test.com',
      fullName: 'Editor',
      role: 'редактор',
      roles: ['редактор'],
    };

    vi.mocked(authApi.getMe).mockResolvedValue({
      success: true,
      data: mockUser,
    });

    localStorage.setItem('nexus_token', 'valid-token');

    render(<TestComponent />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    expect(screen.getByTestId('role-check')).toHaveTextContent('is-editor');
  });
});
