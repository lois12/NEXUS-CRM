/**
 * Canonical server-side entity types (DB row shapes).
 * Source of truth for `query<T>()` / `get<T>()` call sites.
 * Keep in sync with client/src/types/index.ts DTOs.
 */

// ── Users ──
export type UserRole = 'super_admin' | 'руководитель' | 'редактор' | 'smm' | 'документовед' | 'мол';

export interface UserRow {
  id: string;
  username: string;
  password: string;
  email: string;
  fullName: string;
  role: UserRole;
  roles: string | null;
  avatar: string | null;
  position: string | null;
  about: string | null;
  status: string | null;
  socialLinks: string | null;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Auth / middleware ──
export interface AuthUser {
  id: string;
  username: string;
  role: string;
  roles: string[];
}

// ── Content plan ──
export interface ContentPostRow {
  id: string;
  title: string;
  content: string;
  platform: string;
  status: string;
  scheduledDate: string | null;
  publishedDate: string | null;
  imageUrl: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

// ── Materials ──
export interface MaterialRow {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  mimeType: string;
  folder: string | null;
  tags: string | null;
  uploadedBy: string;
  createdAt: string;
}

// ── Kanban ──
export interface KanbanTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  position: number;
  priority: string | null;
  dueDate: string | null;
  archived: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAttachmentRow {
  id: string;
  taskId: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
}

// ── Partners / vacations / inventory ──
export interface PartnerRow {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  inn: string | null;
  notes: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VacationRow {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  approvedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRow {
  id: string;
  name: string;
  type: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  location: string | null;
  responsiblePerson: string | null;
  serialNumber: string | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Registrations ──
export interface RegistrationRow {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  eventTime: string | null;
  location: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  maxParticipants: number | null;
  status: string;
  publicSlug: string | null;
  createdBy: string;
  registrationStart: string | null;
  registrationEnd: string | null;
  closedMessage: string | null;
  mapCoords: string | null;
  showLimit: number | null;
  showTimer: number | null;
  organizer: string | null;
  color: string | null;
  theme: string | null;
  waitlistEnabled: number | null;
  maxWaitlist: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationFieldRow {
  id: string;
  registrationId: string;
  type: string;
  label: string;
  placeholder: string | null;
  required: number;
  options: string | null;
  settings: string | null;
  position: number;
  createdAt: string;
}

export interface RegistrationSubmissionRow {
  id: string;
  registrationId: string;
  userId: string | null;
  answers: string | null;
  contactName: string | null;
  contactLastName: string | null;
  contactFirstName: string | null;
  contactPatronymic: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  cancelToken: string;
  checkinToken: string | null;
  confirmCode: string | null;
  position: number;
  attended: number | null;
  attendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Lists (Списки) ──
export interface ListRow {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  publicSlug: string | null;
  isPublic: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListFieldRow {
  id: string;
  listId: string;
  type: string;
  label: string;
  placeholder: string | null;
  required: number;
  options: string | null;
  position: number;
  createdAt: string;
}

export interface ListEntryRow {
  id: string;
  listId: string;
  lastName: string | null;
  firstName: string | null;
  patronymic: string | null;
  phone: string | null;
  email: string | null;
  comment: string | null;
  called: number | null;
  visited: number | null;
  pinned: number | null;
  starred: number | null;
  deleted: number | null;
  deletedAt: string | null;
  answers: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Widgets ──
export interface WidgetRow {
  id: string;
  title: string;
  description: string | null;
  htmlCode: string | null;
  imageUrl: string | null;
  category: string | null;
  folder: string | null;
  publicSlug: string | null;
  customSlug: string | null;
  password: string | null;
  viewCount: number | null;
  isPinned: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Chat ──
export interface ChatConversationRow {
  id: string;
  type: string;
  name: string | null;
  avatar: string | null;
  description: string | null;
  user1Id: string | null;
  user2Id: string | null;
  inviteLink: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type: string | null;
  replyToId: string | null;
  isRead: number | null;
  deleted: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Notifications ──
export interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  senderId: string | null;
  isRead: number | null;
  createdAt: string;
}

// ── App settings ──
export interface AppSettingRow {
  key: string;
  value: string;
  updatedAt: string;
}

// ── Generic API envelope ──
export interface ApiOk<T> {
  success: true;
  data?: T;
  message?: string;
}

export interface ApiErr {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;
