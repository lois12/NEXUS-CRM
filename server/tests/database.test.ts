import { describe, it, expect } from 'vitest';
import { query, run, get } from '../db/database';

describe('Database Operations', () => {
  describe('query()', () => {
    it('should return array of results', () => {
      const users = query('SELECT * FROM users');
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThanOrEqual(2);
    });

    it('should support parameterized queries', () => {
      const users = query('SELECT * FROM users WHERE username = ?', ['testadmin']);
      expect(users.length).toBe(1);
      expect(users[0].username).toBe('testadmin');
    });

    it('should return empty array for no matches', () => {
      const users = query('SELECT * FROM users WHERE username = ?', ['nonexistent']);
      expect(users.length).toBe(0);
    });
  });

  describe('get()', () => {
    it('should return single row', () => {
      const user = get('SELECT * FROM users WHERE username = ?', ['testadmin']);
      expect(user).not.toBeNull();
      expect(user!.username).toBe('testadmin');
    });

    it('should return null for no match', () => {
      const user = get('SELECT * FROM users WHERE username = ?', ['ghost']);
      expect(user).toBeNull();
    });
  });

  describe('run()', () => {
    it('should execute INSERT', () => {
      run(
        `INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
        ['test-activity-1', 'test', 'Test activity', 'test-admin-id']
      );

      const activity = get('SELECT * FROM activities WHERE id = ?', ['test-activity-1']);
      expect(activity).not.toBeNull();
      expect(activity!.type).toBe('test');
    });

    it('should execute UPDATE', () => {
      run(
        `UPDATE users SET fullName = ? WHERE id = ?`,
        ['Updated Admin', 'test-admin-id']
      );

      const user = get('SELECT fullName FROM users WHERE id = ?', ['test-admin-id']);
      expect(user!.fullName).toBe('Updated Admin');
    });

    it('should execute DELETE', () => {
      run(
        `INSERT INTO activities (id, type, description, userId) VALUES (?, ?, ?, ?)`,
        ['to-delete', 'test', 'Delete me', 'test-admin-id']
      );

      run('DELETE FROM activities WHERE id = ?', ['to-delete']);

      const activity = get('SELECT * FROM activities WHERE id = ?', ['to-delete']);
      expect(activity).toBeNull();
    });
  });
});
