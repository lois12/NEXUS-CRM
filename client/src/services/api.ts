import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, LoginRequest, LoginResponse, User, ContentPost, Material, DashboardStats, ContentComment, ContentApproval, Notification, ChatConversation, ChatMessage, ChatGroupMember, ChatReaction, ChatPinnedMessage, ChatReadReceipt } from '../types';

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
    const token = localStorage.getItem('nexus_token');
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

  // Approval workflow
  submitForApproval: (id: string): Promise<ApiResponse<void>> =>
    api.post(`/content/${id}/submit`).then((res) => res.data),

  approve: (id: string, comment?: string): Promise<ApiResponse<void>> =>
    api.post(`/content/${id}/approve`, { comment }).then((res) => res.data),

  requestRevision: (id: string, comment: string): Promise<ApiResponse<void>> =>
    api.post(`/content/${id}/request-revision`, { comment }).then((res) => res.data),

  finalize: (id: string): Promise<ApiResponse<void>> =>
    api.post(`/content/${id}/finalize`).then((res) => res.data),

  publish: (id: string): Promise<ApiResponse<void>> =>
    api.post(`/content/${id}/publish`).then((res) => res.data),

  // Comments
  getComments: (postId: string): Promise<ApiResponse<ContentComment[]>> =>
    api.get(`/content/${postId}/comments`).then((res) => res.data),

  addComment: (postId: string, content: string): Promise<ApiResponse<ContentComment>> =>
    api.post(`/content/${postId}/comments`, { content }).then((res) => res.data),

  deleteComment: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/content/comments/${id}`).then((res) => res.data),

  // Approvals
  getApprovals: (postId: string): Promise<ApiResponse<ContentApproval[]>> =>
    api.get(`/content/${postId}/approvals`).then((res) => res.data),
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

  getMaintenance: (): Promise<ApiResponse<{ active: boolean }>> =>
    api.get('/dashboard/maintenance').then((res) => res.data),

  toggleMaintenance: (): Promise<ApiResponse<{ active: boolean }>> =>
    api.post('/dashboard/maintenance/toggle').then((res) => res.data),

  getPostsByDay: (): Promise<ApiResponse<{ date: string; count: number }[]>> =>
    api.get('/dashboard/analytics/posts-by-day').then((res) => res.data),

  getByPlatform: (): Promise<ApiResponse<{ platform: string; count: number }[]>> =>
    api.get('/dashboard/analytics/by-platform').then((res) => res.data),

  getByStatus: (): Promise<ApiResponse<{ status: string; count: number }[]>> =>
    api.get('/dashboard/analytics/by-status').then((res) => res.data),
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
export const partnersApi = {
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/partners').then((res) => res.data),
  create: (data: any): Promise<ApiResponse<any>> =>
    api.post('/partners', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/partners/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/partners/${id}`).then((res) => res.data),
};

// Vacations API
export const vacationsApi = {
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/vacations').then((res) => res.data),
  create: (data: any): Promise<ApiResponse<any>> =>
    api.post('/vacations', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/vacations/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/vacations/${id}`).then((res) => res.data),
};

// Inventory API
export const inventoryApi = {
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/inventory').then((res) => res.data),
  create: (data: any): Promise<ApiResponse<any>> =>
    api.post('/inventory', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/inventory/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/inventory/${id}`).then((res) => res.data),
};

// Events API
export const eventsApi = {
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/events').then((res) => res.data),
  create: (data: any): Promise<ApiResponse<any>> =>
    api.post('/events', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/events/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/events/${id}`).then((res) => res.data),
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
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/projects').then((res) => res.data),
  create: (data: any): Promise<ApiResponse<any>> =>
    api.post('/projects', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/projects/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/projects/${id}`).then((res) => res.data),
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
  getAll: (): Promise<ApiResponse<any[]>> =>
    api.get('/knowledge').then((res) => res.data),
  create: (data: any): Promise<ApiResponse<any>> =>
    api.post('/knowledge', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/knowledge/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/knowledge/${id}`).then((res) => res.data),
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

  getGroupMembers: (id: string): Promise<ApiResponse<ChatGroupMember[]>> =>
    api.get(`/chat/groups/${id}/members`).then((res) => res.data),

  addGroupMember: (id: string, userId: string): Promise<ApiResponse<void>> =>
    api.post(`/chat/groups/${id}/members`, { userId }).then((res) => res.data),

  removeGroupMember: (id: string, userId: string): Promise<ApiResponse<void>> =>
    api.delete(`/chat/groups/${id}/members/${userId}`).then((res) => res.data),

  joinByInvite: (link: string): Promise<ApiResponse<ChatConversation>> =>
    api.post(`/chat/invite/${link}`).then((res) => res.data),
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
  getOne: (id: string): Promise<ApiResponse<any>> =>
    api.get(`/registrations/${id}`).then((res) => res.data),
  create: (data: any): Promise<ApiResponse<any>> =>
    api.post('/registrations', data).then((res) => res.data),
  update: (id: string, data: any): Promise<ApiResponse<void>> =>
    api.put(`/registrations/${id}`, data).then((res) => res.data),
  delete: (id: string): Promise<ApiResponse<void>> =>
    api.delete(`/registrations/${id}`).then((res) => res.data),
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
  cancelSubmission: (subId: string): Promise<ApiResponse<void>> =>
    api.delete(`/registrations/submissions/${subId}`).then((res) => res.data),
  exportCSV: (regId: string): Promise<Blob> =>
    api.get(`/registrations/${regId}/submissions/export`, { responseType: 'blob' }).then((res) => res.data),
  getParticipants: (regId: string): Promise<ApiResponse<any[]>> =>
    api.get(`/registrations/${regId}/participants`).then((res) => res.data),
  toggleAttended: (regId: string, subId: string): Promise<ApiResponse<any>> =>
    api.post(`/registrations/${regId}/participants/${subId}/attended`).then((res) => res.data),
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
  getQRUrl: (slug: string): string => `/api/reg/${slug}/qr`,
};

export default api;
