import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  ApiResponse, LoginRequest, LoginResponse, User, ContentPost, Material, DashboardStats, ContentComment, Notification, ChatConversation, ChatMessage, ChatGroupMember, ChatReaction, ChatPinnedMessage, ChatReadReceipt,
  Partner, Vacation, InventoryItem, EventItem, ProjectItem, KnowledgeArticle,
} from '../types';

const API_BASE_URL = '/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nexus_token');
      localStorage.removeItem('nexus_user');
      sessionStorage.removeItem('nexus_token');
      sessionStorage.removeItem('nexus_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    // Show toast for network errors (not API business errors)
    if (!error.response && error.message === 'Network Error') {
      window.dispatchEvent(new CustomEvent('nexus:toast', { detail: { message: 'Нет соединения с сервером', type: 'error' } }));
    }
    return Promise.reject(error);
  }
);

// ── Public/control client — no login redirect, uses control token ──
const CONTROL_TOKEN_KEY = 'nexus_control_token';

const publicApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

publicApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(CONTROL_TOKEN_KEY) || sessionStorage.getItem(CONTROL_TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function setControlToken(token: string | null): void {
  if (token) localStorage.setItem(CONTROL_TOKEN_KEY, token);
  else localStorage.removeItem(CONTROL_TOKEN_KEY);
}

export function getControlToken(): string | null {
  return localStorage.getItem(CONTROL_TOKEN_KEY) || sessionStorage.getItem(CONTROL_TOKEN_KEY);
}

// ── Typed CRUD factory — kills the `create: (data: any)` boilerplate ──
export function crudApi<T, TCreate = Partial<T>, TUpdate = Partial<T>>(base: string) {
  return {
    getAll: (): Promise<ApiResponse<T[]>> =>
      api.get(base).then((res) => res.data),
    create: (data: TCreate): Promise<ApiResponse<T>> =>
      api.post(base, data).then((res) => res.data),
    update: (id: string, data: TUpdate): Promise<ApiResponse<void>> =>
      api.put(`${base}/${id}`, data).then((res) => res.data),
    delete: (id: string): Promise<ApiResponse<void>> =>
      api.delete(`${base}/${id}`).then((res) => res.data),
  };
}

// Auth API
export const authApi = {
  login: (data: LoginRequest): Promise<ApiResponse<LoginResponse>> =>
    api.post('/auth/login', data).then((res) => res.data),
  
  register: (data: LoginRequest & { role: string; fullName: string }): Promise<ApiResponse<User>> =>
    api.post('/auth/register', data).then((res) => res.data),
  
  getMe: (): Promise<ApiResponse<User>> =>
    api.get('/auth/me').then((res) => res.data),
};

// Users API
export const usersApi = {
  getAll: (): Promise<ApiResponse<User[]>> =>
    api.get('/users').then((res) => res.data),
  
  getById: (id: string): Promise<ApiResponse<User>> =>
    api.get(`/users/${id}`).then((res) => res.data),
  
  create: (data: Partial<User> & { password: string }): Promise<ApiResponse<User>> =>
    api.post('/users', data).then((res) => res.data),
  
  update: (id: string, data: Partial<User>): Promise<ApiResponse<User>> =>
    api.put(`/users/${id}`, data).then((res) => res.data),
  
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/users/${id}`).then((res) => res.data),
  
  uploadAvatar: (id: string, file: File): Promise<ApiResponse<{ avatar: string }>> => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post(`/users/${id}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },

  uploadMyAvatar: (file: File): Promise<ApiResponse<{ avatar: string }>> => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },

  updateMyProfile: (data: { fullName?: string; position?: string; about?: string; status?: string; socialLinks?: Record<string, string>; password?: string }): Promise<ApiResponse<User>> =>
    api.put('/users/me/profile', data).then((res) => res.data),
};

// Content Plan API
export const contentApi = {
  getAll: (params?: { platform?: string; status?: string }): Promise<ApiResponse<ContentPost[]>> =>
    api.get('/content', { params }).then((res) => res.data),
  
  getById: (id: string): Promise<ApiResponse<ContentPost>> =>
    api.get(`/content/${id}`).then((res) => res.data),
  
  create: (data: Partial<ContentPost>): Promise<ApiResponse<ContentPost>> =>
    api.post('/content', data).then((res) => res.data),
  
  update: (id: string, data: Partial<ContentPost>): Promise<ApiResponse<ContentPost>> =>
    api.put(`/content/${id}`, data).then((res) => res.data),
  
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/content/${id}`).then((res) => res.data),

  uploadImage: (id: string, file: File): Promise<ApiResponse<{ imageUrl: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/content/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },

  publish: (id: string): Promise<ApiResponse<void>> =>
    api.post(`/content/${id}/publish`).then((res) => res.data),

  // Comments
  getComments: (postId: string): Promise<ApiResponse<ContentComment[]>> =>
    api.get(`/content/${postId}/comments`).then((res) => res.data),

  addComment: (postId: string, content: string): Promise<ApiResponse<ContentComment>> =>
    api.post(`/content/${postId}/comments`, { content }).then((res) => res.data),

  deleteComment: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/content/comments/${id}`).then((res) => res.data),
};

// Materials API
export const materialsApi = {
  getAll: (params?: { folder?: string; type?: string }): Promise<ApiResponse<Material[]>> =>
    api.get('/materials', { params }).then((res) => res.data),
  
  upload: (file: File, folder?: string): Promise<ApiResponse<Material>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) formData.append('folder', folder);
    return api.post('/materials/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },
  
  update: (id: string, data: { folder?: string; name?: string }): Promise<ApiResponse<Material>> =>
    api.put(`/materials/${id}`, data).then((res) => res.data),

  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/materials/${id}`).then((res) => res.data),
};

// Dashboard API
export const dashboardApi = {
  getStats: (): Promise<ApiResponse<DashboardStats>> =>
    api.get('/dashboard/stats').then((res) => res.data),

  getHealth: (): Promise<ApiResponse<any>> =>
    api.get('/dashboard/health').then((res) => res.data),

  getMaintenance: (): Promise<ApiResponse<{ pages: string[] }>> =>
    api.get('/dashboard/maintenance').then((res) => res.data),

  setMaintenancePages: (pages: string[]): Promise<ApiResponse<{ pages: string[] }>> =>
    api.post('/dashboard/maintenance', { pages }).then((res) => res.data),

  toggleMaintenance: (): Promise<ApiResponse<{ pages: string[] }>> =>
    api.post('/dashboard/maintenance/toggle').then((res) => res.data),

  getPostsByDay: (): Promise<ApiResponse<{ date: string; count: number }[]>> =>
    api.get('/dashboard/analytics/posts-by-day').then((res) => res.data),

  getByPlatform: (): Promise<ApiResponse<{ platform: string; count: number }[]>> =>
    api.get('/dashboard/analytics/by-platform').then((res) => res.data),

  getByStatus: (): Promise<ApiResponse<{ status: string; count: number }[]>> =>
    api.get('/dashboard/analytics/by-status').then((res) => res.data),

  listBackups: (): Promise<ApiResponse<{ dir: string; files: { name: string; size: number; at: number }[] }>> =>
    api.get('/dashboard/backups').then((res) => res.data),

  createBackup: (): Promise<ApiResponse<{ name: string; size: number; at: number; dir: string; files: { name: string; size: number; at: number }[] }>> =>
    api.post('/dashboard/backups').then((res) => res.data),

  downloadBackupUrl: (name: string) => `/api/dashboard/backups/${encodeURIComponent(name)}`,

  /** authed download (plain <a href> misses the Bearer token) */
  downloadBackup: async (name: string) => {
    const res = await api.get(`/dashboard/backups/${encodeURIComponent(name)}`, { responseType: 'blob' });
    return res.data as Blob;
  },
};

// Collage projects (server-side, team-shared)
export interface CollageProjectMeta {
  id: string;
  name: string;
  description: string;
  updatedAt: string | number;
  pageCount: number;
  ownerName?: string;
}

export const collageApi = {
  list: (): Promise<ApiResponse<CollageProjectMeta[]>> =>
    api.get('/collage/projects').then((res) => res.data),

  get: (id: string): Promise<ApiResponse<any>> =>
    api.get(`/collage/projects/${id}`).then((res) => res.data),

  create: (payload: { name: string; description?: string; pagesJson?: string; images?: { id: string; dataUrl: string }[] }): Promise<ApiResponse<any>> =>
    api.post('/collage/projects', payload).then((res) => res.data),

  save: (id: string, payload: {
    name?: string;
    description?: string;
    pageCount?: number;
    pagesJson?: string;
    images?: { id: string; dataUrl: string }[];
  }): Promise<ApiResponse<any>> =>
    api.put(`/collage/projects/${id}`, payload).then((res) => res.data),

  patchMeta: (id: string, payload: { name?: string; description?: string }): Promise<ApiResponse<any>> =>
    api.patch(`/collage/projects/${id}/meta`, payload).then((res) => res.data),

  remove: (id: string): Promise<ApiResponse<any>> =>
    api.delete(`/collage/projects/${id}`).then((res) => res.data),

  addVersion: (id: string, name: string): Promise<ApiResponse<{ versions: any[] }>> =>
    api.post(`/collage/projects/${id}/versions`, { name }).then((res) => res.data),

  removeVersion: (id: string, versionId: string): Promise<ApiResponse<{ versions: any[] }>> =>
    api.delete(`/collage/projects/${id}/versions/${versionId}`).then((res) => res.data),
};

// Ideas API
export const ideasApi = {
  getAll: (): Promise<ApiResponse<{ ideas: any[]; links: any[] }>> =>
    api.get('/ideas').then((res) => res.data),

  create: (data: { title: string; content?: string; type?: string; color?: string; parentId?: string }): Promise<ApiResponse<any>> =>
    api.post('/ideas', data).then((res) => res.data),

  update: (id: string, data: Partial<{ title: string; content: string; type: string; color: string; parentId: string }>): Promise<ApiResponse<void>> =>
    api.put(`/ideas/${id}`, data).then((res) => res.data),

  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/ideas/${id}`).then((res) => res.data),

  createLink: (data: { sourceId: string; targetId: string; label?: string }): Promise<ApiResponse<any>> =>
    api.post('/ideas/link', data).then((res) => res.data),

  deleteLink: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/ideas/link/${id}`).then((res) => res.data),

  // Comments
  getComments: (ideaId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/ideas/${ideaId}/comments`).then((res) => res.data),

  addComment: (ideaId: string, content: string): Promise<ApiResponse<any>> =>
    api.post(`/ideas/${ideaId}/comments`, { content }).then((res) => res.data),

  deleteComment: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/ideas/comments/${id}`).then((res) => res.data),

  // Attachments
  getAttachments: (ideaId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/ideas/${ideaId}/attachments`).then((res) => res.data),

  uploadAttachment: (ideaId: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/ideas/${ideaId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => res.data);
  },

  deleteAttachment: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/ideas/attachments/${id}`).then((res) => res.data),
};

// Kanban API
export const kanbanApi = {
  getAll: (archived = false): Promise<ApiResponse<any[]>> =>
    api.get(`/kanban?archived=${archived ? '1' : '0'}`).then((res) => res.data),
  create: (data: { title: string; description?: string; status?: string; priority?: string; dueDate?: string }): Promise<ApiResponse<any>> =>
    api.post('/kanban', data).then((res) => res.data),
  update: (id: string, data: Partial<{ title: string; description: string; status: string; position: number; priority: string; dueDate: string }>): Promise<ApiResponse<void>> =>
    api.put(`/kanban/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/kanban/${id}`).then((res) => res.data),
  reorder: (tasks: { id: string; status: string; position: number }[]): Promise<ApiResponse<void>> =>
    api.put('/kanban/reorder', { tasks }).then((res) => res.data),
  archive: (id: string): Promise<ApiResponse<void>> =>
    api.put(`/kanban/${id}/archive`).then((res) => res.data),
  unarchive: (id: string): Promise<ApiResponse<void>> =>
    api.put(`/kanban/${id}/unarchive`).then((res) => res.data),
  getAttachments: (taskId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/kanban/${taskId}/attachments`).then((res) => res.data),
  uploadAttachment: (taskId: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/kanban/${taskId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  deleteAttachment: (attachmentId: string): Promise<ApiResponse<void>> =>
    api.delete(`/kanban/attachments/${attachmentId}`).then((res) => res.data),
};

// Partners API
export const partnersApi = crudApi<Partner, Partial<Partner>>('/partners');

// Vacations API
export const vacationsApi = crudApi<Vacation, Partial<Vacation>>('/vacations');

// Inventory API
export const inventoryApi = crudApi<InventoryItem, Partial<InventoryItem>>('/inventory');

// Events API
export const eventsApi = {
  ...crudApi<EventItem, Partial<EventItem>>('/events'),
  uploadImage: (id: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/events/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  // Blocks (sub-tasks)
  getBlocks: (eventId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/events/${eventId}/blocks`).then((res) => res.data),
  createBlock: (eventId: string, data: any): Promise<ApiResponse<any>> =>
    api.post(`/events/${eventId}/blocks`, data).then((res) => res.data),
  updateBlock: (eventId: string, blockId: string, data: any): Promise<ApiResponse<any>> =>
    api.put(`/events/${eventId}/blocks/${blockId}`, data).then((res) => res.data),
  deleteBlock: (eventId: string, blockId: string): Promise<ApiResponse<void>> =>
    api.delete(`/events/${eventId}/blocks/${blockId}`).then((res) => res.data),
};

// Projects API
export const projectsApi = {
  ...crudApi<ProjectItem, Partial<ProjectItem>>('/projects'),
  uploadImage: (id: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  // Timeline
  getTimeline: (projectId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/projects/${projectId}/timeline`).then((res) => res.data),
  createTimelinePoint: (projectId: string, data: any): Promise<ApiResponse<any>> =>
    api.post(`/projects/${projectId}/timeline`, data).then((res) => res.data),
  updateTimelinePoint: (pointId: string, data: any): Promise<ApiResponse<any>> =>
    api.put(`/projects/timeline/${pointId}`, data).then((res) => res.data),
  deleteTimelinePoint: (pointId: string): Promise<ApiResponse<void>> =>
    api.delete(`/projects/timeline/${pointId}`).then((res) => res.data),
  // Documents
  getDocuments: (projectId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/projects/${projectId}/documents`).then((res) => res.data),
  uploadDocument: (projectId: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${projectId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  deleteDocument: (docId: string): Promise<ApiResponse<void>> =>
    api.delete(`/projects/documents/${docId}`).then((res) => res.data),
  // Links
  getLinks: (projectId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/projects/${projectId}/links`).then((res) => res.data),
  createLink: (projectId: string, data: any): Promise<ApiResponse<any>> =>
    api.post(`/projects/${projectId}/links`, data).then((res) => res.data),
  deleteLink: (projectId: string, linkId: string): Promise<ApiResponse<void>> =>
    api.delete(`/projects/${projectId}/links/${linkId}`).then((res) => res.data),
};

// Knowledge Base API
export const knowledgeApi = {
  ...crudApi<KnowledgeArticle, Partial<KnowledgeArticle>>('/knowledge'),
  getAttachments: (articleId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/knowledge/${articleId}/attachments`).then((res) => res.data),
  uploadAttachment: (articleId: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/knowledge/${articleId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  deleteAttachment: (attId: string): Promise<ApiResponse<void>> =>
    api.delete(`/knowledge/attachments/${attId}`).then((res) => res.data),
};

// Brand Bank API
export const brandApi = {
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/brand').then((res) => res.data),
  upload: (file: File, data: { name: string; category: string; description?: string }): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', data.name);
    formData.append('category', data.category);
    if (data.description) formData.append('description', data.description);
    return api.post('/brand', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/brand/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/brand/${id}`).then((res) => res.data),
};

// Notifications API
export const notificationsApi = {
  getAll: (params?: { unread?: string | boolean; limit?: number }): Promise<ApiResponse<Notification[]>> =>
    api.get('/notifications', { params }).then((res) => res.data),

  getUnreadCount: (): Promise<ApiResponse<{ count: number }>> =>
    api.get('/notifications/unread-count').then((res) => res.data),

  markAsRead: (id: string): Promise<ApiResponse<void>> =>
    api.put(`/notifications/${id}/read`).then((res) => res.data),

  markAllAsRead: (): Promise<ApiResponse<void>> =>
    api.put('/notifications/read-all').then((res) => res.data),
};

// Chat API
export const chatApi = {
  getConversations: (): Promise<ApiResponse<ChatConversation[]>> =>
    api.get('/chat/conversations').then((res) => res.data),

  getOrCreateConversation: (targetUserId: string): Promise<ApiResponse<ChatConversation>> =>
    api.post('/chat/conversations', { targetUserId }).then((res) => res.data),

  getMessages: (conversationId: string, params?: { after?: string; limit?: number }): Promise<ApiResponse<ChatMessage[]>> =>
    api.get(`/chat/conversations/${conversationId}/messages`, { params }).then((res) => res.data),

  sendMessage: (conversationId: string, data: { content: string; type?: string; replyToId?: string; mentionedUserIds?: string; forwardedFrom?: string; caption?: string }): Promise<ApiResponse<ChatMessage>> =>
    api.post(`/chat/conversations/${conversationId}/messages`, data).then((res) => res.data),

  editMessage: (id: string, content: string): Promise<ApiResponse<ChatMessage>> =>
    api.put(`/chat/messages/${id}`, { content }).then((res) => res.data),

  deleteMessage: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/messages/${id}`).then((res) => res.data),

  addReaction: (messageId: string, emoji: string): Promise<ApiResponse<ChatReaction[]>> =>
    api.post(`/chat/messages/${messageId}/reactions`, { emoji }).then((res) => res.data),

  removeReaction: (messageId: string): Promise<ApiResponse<ChatReaction[]>> =>
    api.delete(`/chat/messages/${messageId}/reactions`).then((res) => res.data),

  pinMessage: (messageId: string): Promise<ApiResponse<void>> =>
    api.post(`/chat/messages/${messageId}/pin`).then((res) => res.data),

  unpinMessage: (messageId: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/messages/${messageId}/pin`).then((res) => res.data),

  getPinnedMessages: (conversationId: string): Promise<ApiResponse<ChatPinnedMessage[]>> =>
    api.get(`/chat/conversations/${conversationId}/pinned`).then((res) => res.data),

  getReadReceipts: (conversationId: string): Promise<ApiResponse<ChatReadReceipt[]>> =>
    api.get(`/chat/conversations/${conversationId}/reads`).then((res) => res.data),

  setTyping: (conversationId: string): Promise<ApiResponse<void>> =>
    api.post(`/chat/conversations/${conversationId}/typing`).then((res) => res.data),

  getTyping: (conversationId: string): Promise<ApiResponse<{ userId: string; name: string }[]>> =>
    api.get(`/chat/conversations/${conversationId}/typing`).then((res) => res.data),

  uploadFile: (conversationId: string, file: File): Promise<ApiResponse<{ url: string; filename: string; size: number; mimeType: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/chat/conversations/${conversationId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },

  markRead: (conversationId: string): Promise<ApiResponse<void>> =>
    api.put(`/chat/conversations/${conversationId}/read`).then((res) => res.data),

  getUnreadCount: (): Promise<ApiResponse<{ count: number }>> =>
    api.get('/chat/unread-count').then((res) => res.data),

  // Groups
  createGroup: (data: { name: string; memberIds: string[] }): Promise<ApiResponse<ChatConversation>> =>
    api.post('/chat/groups', data).then((res) => res.data),

  updateGroup: (id: string, data: { name?: string; avatar?: string; description?: string }): Promise<ApiResponse<void>> =>
    api.put(`/chat/groups/${id}`, data).then((res) => res.data),

  deleteGroup: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/groups/${id}`).then((res) => res.data),

  leaveGroup: (id: string): Promise<ApiResponse<void>> =>
    api.post(`/chat/groups/${id}/leave`).then((res) => res.data),

  // Hide conversation for me ("delete chat")
  hideConversation: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/conversations/${id}`).then((res) => res.data),
  unhideConversation: (id: string): Promise<ApiResponse<void>> =>
    api.put(`/chat/conversations/${id}/unhide`).then((res) => res.data),

  getGroupMembers: (id: string): Promise<ApiResponse<ChatGroupMember[]>> =>
    api.get(`/chat/groups/${id}/members`).then((res) => res.data),

  addGroupMember: (id: string, userId: string): Promise<ApiResponse<void>> =>
    api.post(`/chat/groups/${id}/members`, { userId }).then((res) => res.data),

  removeGroupMember: (id: string, userId: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/groups/${id}/members/${userId}`).then((res) => res.data),

  joinByInvite: (link: string): Promise<ApiResponse<ChatConversation>> =>
    api.post(`/chat/invite/${link}`).then((res) => res.data),

  // Archive
  archiveConversation: (id: string): Promise<ApiResponse<void>> =>
    api.put(`/chat/conversations/${id}/archive`).then((res) => res.data),
  unarchiveConversation: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/conversations/${id}/archive`).then((res) => res.data),

  // Pin conversation
  pinConversation: (id: string): Promise<ApiResponse<void>> =>
    api.put(`/chat/conversations/${id}/pin-conv`).then((res) => res.data),
  unpinConversation: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/conversations/${id}/pin-conv`).then((res) => res.data),

  // Favorites
  addFavorite: (messageId: string): Promise<ApiResponse<void>> =>
    api.post(`/chat/messages/${messageId}/favorite`).then((res) => res.data),
  removeFavorite: (messageId: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/messages/${messageId}/favorite`).then((res) => res.data),
  getFavorites: (convId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/chat/conversations/${convId}/favorites`).then((res) => res.data),

  // Polls
  createPoll: (convId: string, data: { question: string; options: string[] }): Promise<ApiResponse<any>> =>
    api.post(`/chat/conversations/${convId}/polls`, data).then((res) => res.data),
  getPollResults: (pollId: string): Promise<ApiResponse<any>> =>
    api.get(`/chat/polls/${pollId}`).then((res) => res.data),
  votePoll: (pollId: string, optionId: string): Promise<ApiResponse<any>> =>
    api.post(`/chat/polls/${pollId}/vote`, { optionId }).then((res) => res.data),

  // Mute
  muteMember: (convId: string, userId: string, until?: string): Promise<ApiResponse<void>> =>
    api.post(`/chat/groups/${convId}/mute/${userId}`, { until }).then((res) => res.data),
  unmuteMember: (convId: string, userId: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/groups/${convId}/mute/${userId}`).then((res) => res.data),
  muteConversation: (convId: string, until?: string): Promise<ApiResponse<void>> =>
    api.put(`/chat/conversations/${convId}/mute`, { until }).then((res) => res.data),
  unmuteConversation: (convId: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/conversations/${convId}/mute`).then((res) => res.data),
};

// Search API
export const searchApi = {
  search: (q: string): Promise<ApiResponse<{ id: string; title: string; subtitle: string; type: string; link: string; avatar?: string }[]>> =>
    api.get('/search', { params: { q } }).then((res) => res.data),
};

// QR Auth API
export const qrAuthApi = {
  generate: (): Promise<ApiResponse<{ token: string; url: string; expiresAt: number }>> =>
    api.post('/qr-auth/generate').then((res) => res.data),

  status: (token: string): Promise<ApiResponse<{ status: string; token?: string; user?: any }>> =>
    api.get(`/qr-auth/status/${token}`).then((res) => res.data),

  confirm: (token: string): Promise<ApiResponse<void>> =>
    api.post(`/qr-auth/confirm/${token}`).then((res) => res.data),
};

// Push Notifications API
export const pushApi = {
  getVapidKey: (): Promise<ApiResponse<{ publicKey: string }>> =>
    api.get('/push/vapid-key').then((res) => res.data),

  subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<ApiResponse<void>> =>
    api.post('/push/subscribe', { subscription }).then((res) => res.data),

  unsubscribe: (endpoint: string): Promise<ApiResponse<void>> =>
    api.post('/push/unsubscribe', { endpoint }).then((res) => res.data),
};

// Registrations API
export const registrationsApi = {
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/registrations').then((res) => res.data),
  getAllContacts: (): Promise<ApiResponse<any[]>> =>
    api.get('/registrations/contacts').then((res) => res.data),
  getOne: (id: string): Promise<ApiResponse<any>> =>
    api.get(`/registrations/${id}`).then((res) => res.data),
  create: (data: any): Promise<ApiResponse<any>> =>
    api.post('/registrations', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/registrations/${id}`, data).then((res) => res.data),
  updateAndNotify: (id: string, data: any): Promise<ApiResponse<any>> =>
    api.put(`/registrations/${id}/notify`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/registrations/${id}`).then((res) => res.data),
  duplicate: (id: string): Promise<ApiResponse<any>> =>
    api.post(`/registrations/${id}/duplicate`).then((res) => res.data),
  uploadImage: (id: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/registrations/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  uploadVideo: (id: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/registrations/${id}/video`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  getMedia: (regId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/registrations/${regId}/media`).then((res) => res.data),
  uploadMedia: (regId: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/registrations/${regId}/media`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  deleteMedia: (mediaId: string): Promise<ApiResponse<void>> =>
    api.delete(`/registrations/media/${mediaId}`).then((res) => res.data),
  createField: (regId: string, data: any): Promise<ApiResponse<any>> =>
    api.post(`/registrations/${regId}/fields`, data).then((res) => res.data),
  updateField: (regId: string, fieldId: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/registrations/${regId}/fields/${fieldId}`, data).then((res) => res.data),
  deleteField: (regId: string, fieldId: string): Promise<ApiResponse<void>> =>
    api.delete(`/registrations/${regId}/fields/${fieldId}`).then((res) => res.data),
  reorderFields: (regId: string, order: string[]): Promise<ApiResponse<void>> =>
    api.put(`/registrations/${regId}/fields-reorder`, { order }).then((res) => res.data),
  getSubmissions: (regId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/registrations/${regId}/submissions`).then((res) => res.data),
  createAdminSubmission: (regId: string, data: { contactName?: string; contactLastName?: string; contactFirstName?: string; contactPatronymic?: string; contactEmail?: string; contactPhone?: string; answers?: Record<string, string>; sendEmail?: boolean }): Promise<ApiResponse<any>> =>
    api.post(`/registrations/${regId}/admin-submission`, data).then((res) => res.data),
  updateSubmissionStatus: (subId: string, status: string): Promise<ApiResponse<any>> =>
    api.patch(`/registrations/submissions/${subId}/status`, { status }).then((res) => res.data),
  cancelSubmission: (subId: string): Promise<ApiResponse<void>> =>
    api.delete(`/registrations/submissions/${subId}`).then((res) => res.data),
  deleteSubmission: (subId: string): Promise<ApiResponse<void>> =>
    api.delete(`/registrations/submissions/${subId}/delete`).then((res) => res.data),
  exportCSV: (regId: string): Promise<Blob> =>
    api.get(`/registrations/${regId}/submissions/export`, { responseType: 'blob' }).then((res) => res.data),
  getParticipants: (regId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/registrations/${regId}/participants`).then((res) => res.data),
  toggleAttended: (regId: string, subId: string): Promise<ApiResponse<any>> =>
    api.post(`/registrations/${regId}/participants/${subId}/attended`).then((res) => res.data),
  getStats: (regId: string): Promise<ApiResponse<any>> =>
    api.get(`/registrations/${regId}/stats`).then((res) => res.data),
};

// CONTROL page API (public, password-gated when set)
export const controlApi = {
  getStatus: (): Promise<ApiResponse<{ passwordRequired: boolean }>> =>
    publicApi.get('/control/status').then((res) => res.data),
  auth: (password: string): Promise<ApiResponse<{ token: string; passwordRequired: boolean }>> =>
    publicApi.post('/control/auth', { password }).then((res) => res.data),
  getRegistrations: (): Promise<ApiResponse<any[]>> =>
    publicApi.get('/control/registrations').then((res) => res.data),
  getSubmissions: (regId: string): Promise<ApiResponse<any[]>> =>
    publicApi.get(`/control/registrations/${regId}/submissions`).then((res) => res.data),
  setPassword: (password: string | null): Promise<ApiResponse<void>> =>
    api.put('/registrations/control-password', { password }).then((res) => res.data),
};

// Public Registration API (no auth)
export const publicRegApi = {
  getBySlug: (slug: string): Promise<ApiResponse<any>> =>
    api.get(`/reg/${slug}`).then((res) => res.data),
  submit: (slug: string, data: any): Promise<ApiResponse<any>> =>
    api.post(`/reg/${slug}`, data).then((res) => res.data),
  cancelByToken: (token: string): Promise<ApiResponse<void>> =>
    api.delete(`/reg/cancel/${token}`).then((res) => res.data),
  checkinGet: (token: string): Promise<ApiResponse<any>> =>
    api.get(`/reg/checkin/${token}`).then((res) => res.data),
  checkinPost: (token: string): Promise<ApiResponse<any>> =>
    api.post(`/reg/checkin/${token}`).then((res) => res.data),
  checkinByCode: (registrationId: string, code: string): Promise<ApiResponse<any>> =>
    api.get(`/reg/checkin-code/${registrationId}/${code}`).then((res) => res.data),
  getQRUrl: (slug: string): string => `/api/reg/${slug}/qr`,
};

// Widgets API (authenticated)
export const widgetsApi = {
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/widgets').then((res) => res.data),
  getById: (id: string): Promise<ApiResponse<any>> =>
    api.get(`/widgets/${id}`).then((res) => res.data),
  create: (data: { title: string; description?: string; category?: string; folder?: string }): Promise<ApiResponse<any>> =>
    api.post('/widgets', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<any>> =>
    api.put(`/widgets/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/widgets/${id}`).then((res) => res.data),
  uploadImage: (id: string, file: File): Promise<ApiResponse<{ imageUrl: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/widgets/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  togglePublish: (id: string): Promise<ApiResponse<any>> =>
    api.put(`/widgets/${id}/publish`).then((res) => res.data),
  togglePin: (id: string): Promise<ApiResponse<any>> =>
    api.put(`/widgets/${id}/pin`).then((res) => res.data),
  duplicate: (id: string): Promise<ApiResponse<any>> =>
    api.post(`/widgets/${id}/duplicate`).then((res) => res.data),
  updatePublishSettings: (id: string, data: { customSlug?: string; password?: string }): Promise<ApiResponse<any>> =>
    api.put(`/widgets/${id}/publish-settings`, data).then((res) => res.data),
  getGallery: (id: string): Promise<ApiResponse<any[]>> =>
    api.get(`/widgets/${id}/gallery`).then((res) => res.data),
  uploadGalleryImage: (id: string, file: File): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/widgets/${id}/gallery`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data);
  },
  deleteGalleryImage: (id: string, imageId: string): Promise<ApiResponse<void>> =>
    api.delete(`/widgets/${id}/gallery/${imageId}`).then((res) => res.data),
};

// Public Widget API (no auth)
export const publicWidgetApi = {
  getBySlug: (slug: string): Promise<ApiResponse<any>> =>
    api.get(`/w/${slug}`).then((res) => res.data),
};

// Lists API
export const listsApi = {
  getAll: (): Promise<ApiResponse<any[]>> => api.get('/lists').then(res => res.data),
  getOne: (id: string): Promise<ApiResponse<any>> => api.get(`/lists/${id}`).then(res => res.data),
  create: (data: any): Promise<ApiResponse<any>> => api.post('/lists', data).then(res => res.data),
  update: (id: string, data: any): Promise<ApiResponse<any>> => api.put(`/lists/${id}`, data).then(res => res.data),
  delete: (id: string): Promise<ApiResponse<void>> => api.delete(`/lists/${id}`).then(res => res.data),
  duplicate: (id: string): Promise<ApiResponse<any>> => api.post(`/lists/${id}/duplicate`).then(res => res.data),
  // Fields
  createField: (listId: string, data: any): Promise<ApiResponse<any>> => api.post(`/lists/${listId}/fields`, data).then(res => res.data),
  updateField: (listId: string, fieldId: string, data: any): Promise<ApiResponse<void>> => api.put(`/lists/${listId}/fields/${fieldId}`, data).then(res => res.data),
  deleteField: (listId: string, fieldId: string): Promise<ApiResponse<void>> => api.delete(`/lists/${listId}/fields/${fieldId}`).then(res => res.data),
  reorderFields: (listId: string, order: string[]): Promise<ApiResponse<void>> => api.put(`/lists/${listId}/fields-reorder`, { order }).then(res => res.data),
  // Entries
  createEntry: (listId: string, data: any): Promise<ApiResponse<any>> => api.post(`/lists/${listId}/entries`, data).then(res => res.data),
  updateEntry: (listId: string, entryId: string, data: any): Promise<ApiResponse<void>> => api.put(`/lists/${listId}/entries/${entryId}`, data).then(res => res.data),
  deleteEntry: (listId: string, entryId: string): Promise<ApiResponse<void>> => api.delete(`/lists/${listId}/entries/${entryId}`).then(res => res.data),
  toggleEntry: (listId: string, entryId: string, field: 'called' | 'visited' | 'pinned' | 'starred'): Promise<ApiResponse<any>> => api.patch(`/lists/${listId}/entries/${entryId}/toggle`, { field }).then(res => res.data),
  togglePin: (listId: string, entryId: string): Promise<ApiResponse<any>> => api.patch(`/lists/${listId}/entries/${entryId}/pin`).then(res => res.data),
  toggleStar: (listId: string, entryId: string): Promise<ApiResponse<any>> => api.patch(`/lists/${listId}/entries/${entryId}/star`).then(res => res.data),
  restoreEntry: (listId: string, entryId: string): Promise<ApiResponse<any>> => api.post(`/lists/${listId}/entries/${entryId}/restore`).then(res => res.data),
  permanentDelete: (listId: string, entryId: string): Promise<ApiResponse<any>> => api.delete(`/lists/${listId}/entries/${entryId}/permanent`).then(res => res.data),
  emptyTrash: (listId: string): Promise<ApiResponse<any>> => api.delete(`/lists/${listId}/trash`).then(res => res.data),
  getTrash: (listId: string): Promise<ApiResponse<any>> => api.get(`/lists/${listId}/trash`).then(res => res.data),
  massAction: (listId: string, action: string, entryIds: string[]): Promise<ApiResponse<any>> => api.post(`/lists/${listId}/mass-action`, { action, entryIds }).then(res => res.data),
  togglePublish: (id: string): Promise<ApiResponse<any>> => api.post(`/lists/${id}/toggle-publish`).then(res => res.data),
};

// Public Lists API (no auth)
export const publicListsApi = {
  getBySlug: (slug: string): Promise<ApiResponse<any>> => api.get(`/lists/public/${slug}`).then(res => res.data),
};

export default api;
