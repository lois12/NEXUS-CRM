// User types
export type UserRole = 'super_admin' | 'руководитель' | 'редактор' | 'smm' | 'документовед' | 'мол';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  roles?: string[];
  fullName: string;
  avatar?: string;
  position?: string;
  about?: string;
  status?: string;
  socialLinks?: Record<string, string>;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Content Plan types
export type ContentStatus = 'черновик' | 'запланирован' | 'на_доработку' | 'согласован' | 'утверждён' | 'опубликован';
export type SocialPlatform = 'telegram' | 'vk' | 'site' | 'max';

export interface ContentPost {
  id: string;
  title: string;
  content: string;
  platform: SocialPlatform;
  status: ContentStatus;
  scheduledDate?: string;
  scheduledAt?: string;
  publishedDate?: string;
  approvedAt?: string;
  finalizedAt?: string;
  rejectionReason?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  images?: string[];
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  author?: User;
  createdAt: string;
  updatedAt: string;
}

export interface ContentComment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  createdAt: string;
}

export interface ContentApproval {
  id: string;
  postId: string;
  approverId: string;
  approverName?: string;
  approverAvatar?: string;
  action: 'pending' | 'approved' | 'revision';
  comment: string;
  actedAt?: string;
  createdAt: string;
}

// Materials types
export type MaterialType = 'image' | 'document' | 'video' | 'audio' | 'other';

export interface Material {
  id: string;
  name: string;
  type: MaterialType;
  url: string;
  size: number;
  mimeType: string;
  folder?: string;
  tags?: string[];
  uploadedBy: string;
  uploader?: User;
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard types
export interface DashboardStats {
  totalUsers: number;
  totalPosts: number;
  totalMaterials: number;
  publishedPosts: number;
  scheduledPosts: number;
  recentActivities: Activity[];
}

export interface Activity {
  id: string;
  type: 'post_created' | 'post_published' | 'material_uploaded' | 'user_created';
  description: string;
  userId: string;
  user?: User;
  createdAt: string;
}

// Theme types
export type ThemeName = 'cyber-green' | 'cyber-pink' | 'cyber-blue' | 'cyber-purple' | 'cyber-orange';

export interface Theme {
  name: ThemeName;
  label: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
    bg: string;
    card: string;
    border: string;
  };
}

// Idea types
export type IdeaType = 'task' | 'idea' | 'problem' | 'goal' | 'note' | 'direction' | 'default';

export const IDEA_TYPE_CONFIG: Record<IdeaType, { label: string; color: string; isHyper?: boolean }> = {
  task: { label: 'Задача', color: '#00ff88' },
  idea: { label: 'Идея', color: '#00d4ff' },
  problem: { label: 'Проблема', color: '#ff8c00' },
  goal: { label: 'Цель', color: '#bf00ff' },
  note: { label: 'Заметка', color: '#eab308' },
  direction: { label: 'Направление', color: '#ff2200', isHyper: true },
  default: { label: 'Без типа', color: '#6b7280' },
};

export interface Idea {
  id: string;
  title: string;
  content?: string;
  type: IdeaType;
  color: string;
  parentId?: string;
  authorId: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaLink {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  createdAt: string;
}

// Kanban types
export type KanbanStatus = 'queue' | 'in_progress' | 'review' | 'done';
export type KanbanPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: KanbanStatus;
  position: number;
  priority: KanbanPriority;
  dueDate?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export const KANBAN_COLUMNS: { id: KanbanStatus; label: string; color: string }[] = [
  { id: 'queue', label: 'ОЧЕРЕДЬ', color: '#6b7280' },
  { id: 'in_progress', label: 'В РАБОТЕ', color: '#00d4ff' },
  { id: 'review', label: 'ПРОВЕРКА', color: '#eab308' },
  { id: 'done', label: 'ГОТОВО', color: '#00ff88' },
];

// Partners types
export type PartnerType = 'supplier' | 'client' | 'partner';
export type PartnerStatus = 'active' | 'inactive';

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  inn: string;
  notes: string;
  status: PartnerStatus;
  createdAt: string;
  updatedAt: string;
}

// Vacation types
export type VacationType = 'annual' | 'sick' | 'unpaid' | 'maternity';
export type VacationStatus = 'pending' | 'approved' | 'rejected';

export interface Vacation {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  startDate: string;
  endDate: string;
  type: VacationType;
  status: VacationStatus;
  approvedBy?: string;
  approverName?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Inventory types
export type InventoryType = 'ТМЦ' | 'ОС';
export type InventoryStatus = 'active' | 'written_off' | 'repair';

export interface InventoryItem {
  id: string;
  name: string;
  type: InventoryType;
  description: string;
  quantity: number;
  unit: string;
  location: string;
  responsiblePerson: string;
  serialNumber: string;
  purchaseDate?: string;
  purchasePrice: number;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: 'content_status' | 'content_comment' | 'chat_message' | 'mention';
  title: string;
  body: string;
  link: string;
  isRead: number;
  relatedId?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  createdAt: string;
}

// Chat types
export interface ChatConversation {
  id: string;
  type?: 'private' | 'group' | 'general';
  name?: string;
  avatar?: string;
  description?: string;
  inviteLink?: string;
  user1Id: string;
  user2Id: string;
  otherId?: string;
  otherName?: string;
  otherAvatar?: string;
  otherPosition?: string;
  otherLastSeen?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  memberCount?: number;
  isGroup?: boolean;
  isGeneral?: boolean;
  createdAt: string;
}

export interface ChatGroupMember {
  id: string;
  conversationId: string;
  userId: string;
  role: 'admin' | 'member';
  fullName?: string;
  avatar?: string;
  position?: string;
  userRole?: string;
  joinedAt: string;
}

export interface ChatReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  userName?: string;
  createdAt: string;
}

export interface ChatPinnedMessage {
  id: string;
  conversationId: string;
  messageId: string;
  pinnedBy: string;
  content?: string;
  type?: string;
  senderId?: string;
  senderName?: string;
  messageCreatedAt?: string;
  createdAt: string;
}

export interface ChatReadReceipt {
  id: string;
  conversationId: string;
  userId: string;
  fullName?: string;
  avatar?: string;
  lastReadAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'file' | 'audio';
  content: string;
  replyToId?: string;
  replyToContent?: string;
  replyToSenderName?: string;
  mentionedUserIds?: string;
  forwardedFrom?: string;
  editedAt?: string;
  deleted?: number;
  caption?: string;
  isRead: number;
  senderName?: string;
  senderAvatar?: string;
  senderPosition?: string;
  reactions?: ChatReaction[];
  createdAt: string;
}

// ── Registrations ──

export type RegistrationStatus = 'draft' | 'active' | 'closed' | 'archived';

export type FieldType =
  | 'text_short' | 'text_long' | 'email' | 'phone' | 'number' | 'date'
  | 'datetime' | 'time' | 'slider' | 'linear_scale' | 'nps' | 'color'
  | 'select_single' | 'select_multi' | 'dropdown' | 'image_choice' | 'ranking' | 'matrix'
  | 'file' | 'multi_file' | 'signature'
  | 'checkbox' | 'rating'
  | 'url' | 'address' | 'heading' | 'paragraph' | 'divider' | 'page_break'
  | 'map';

export interface RegistrationField {
  id: string;
  registrationId: string;
  type: FieldType;
  label: string;
  placeholder: string;
  required: number;
  options: string;
  settings: string;
  position: number;
  createdAt: string;
}

export interface Registration {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  location: string;
  imageUrl: string;
  videoUrl: string;
  maxParticipants: number;
  status: RegistrationStatus;
  publicSlug: string;
  createdBy: string;
  creatorName?: string;
  confirmedCount?: number;
  waitlistCount?: number;
  registrationStart: string;
  registrationEnd: string;
  closedMessage: string;
  fields?: RegistrationField[];
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationSubmission {
  id: string;
  registrationId: string;
  userId: string | null;
  answers: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: 'confirmed' | 'waitlist' | 'cancelled';
  cancelToken: string;
  position: number;
  userName?: string;
  createdAt: string;
  updatedAt: string;
}

export const FIELD_TYPE_CONFIG: Record<FieldType, { label: string; icon: string; category: 'input' | 'choice' | 'media' | 'layout' }> = {
  // ── Input ──
  text_short: { label: 'Короткий текст', icon: '✏️', category: 'input' },
  text_long: { label: 'Длинный текст', icon: '📄', category: 'input' },
  email: { label: 'Email', icon: '📧', category: 'input' },
  phone: { label: 'Телефон', icon: '📱', category: 'input' },
  number: { label: 'Число', icon: '🔢', category: 'input' },
  date: { label: 'Дата', icon: '📅', category: 'input' },
  datetime: { label: 'Дата и время', icon: '🗓️', category: 'input' },
  time: { label: 'Время', icon: '⏰', category: 'input' },
  slider: { label: 'Ползунок', icon: '🎚️', category: 'input' },
  linear_scale: { label: 'Шкала 1-N', icon: '📊', category: 'input' },
  nps: { label: 'NPS оценка', icon: '📈', category: 'input' },
  color: { label: 'Цвет', icon: '🎨', category: 'input' },
  url: { label: 'Ссылка', icon: '🔗', category: 'input' },
  address: { label: 'Адрес', icon: '📍', category: 'input' },
  // ── Choice ──
  select_single: { label: 'Один вариант', icon: '☐', category: 'choice' },
  select_multi: { label: 'Несколько вариантов', icon: '☑', category: 'choice' },
  dropdown: { label: 'Выпадающий список', icon: '▾', category: 'choice' },
  image_choice: { label: 'Выбор картинкой', icon: '🖼️', category: 'choice' },
  ranking: { label: 'Ранжирование', icon: '↕️', category: 'choice' },
  matrix: { label: 'Матрица', icon: '▦', category: 'choice' },
  checkbox: { label: 'Галочка', icon: '✓', category: 'choice' },
  rating: { label: 'Рейтинг', icon: '⭐', category: 'choice' },
  // ── Media ──
  file: { label: 'Файл', icon: '📎', category: 'media' },
  multi_file: { label: 'Несколько файлов', icon: '📂', category: 'media' },
  signature: { label: 'Подпись', icon: '✍️', category: 'media' },
  // ── Layout ──
  map: { label: 'Карта', icon: '🗺️', category: 'media' },
  heading: { label: 'Заголовок', icon: 'H', category: 'layout' },
  paragraph: { label: 'Параграф', icon: '¶', category: 'layout' },
  divider: { label: 'Разделитель', icon: '—', category: 'layout' },
  page_break: { label: 'Разрыв страницы', icon: '⏸️', category: 'layout' },
};
