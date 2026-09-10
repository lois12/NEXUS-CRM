import { run, get } from './database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Silent migration helper — catches errors without logging (for ALTER TABLE on existing columns)
function migrate(sql: string) {
  try { run(sql, [], true); } catch {}
}

export async function initializeDatabase() {
  // Create users table
  run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      fullName TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'редактор',
      roles TEXT DEFAULT '',
      avatar TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add roles column if missing (migration)
  migrate('ALTER TABLE users ADD COLUMN roles TEXT DEFAULT ""');

  // Profile fields migrations
  migrate('ALTER TABLE users ADD COLUMN position TEXT DEFAULT ""');
  migrate('ALTER TABLE users ADD COLUMN about TEXT DEFAULT ""');
  migrate('ALTER TABLE users ADD COLUMN status TEXT DEFAULT ""');
  migrate('ALTER TABLE users ADD COLUMN socialLinks TEXT DEFAULT "{}"');
  migrate('ALTER TABLE users ADD COLUMN lastSeen TEXT');

  // Create content_posts table
  run(`
    CREATE TABLE IF NOT EXISTS content_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'telegram',
      status TEXT NOT NULL DEFAULT 'черновик',
      scheduledDate TEXT,
      publishedDate TEXT,
      imageUrl TEXT,
      thumbnailUrl TEXT,
      authorId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (authorId) REFERENCES users(id)
    )
  `);

  // Create materials table
  run(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      url TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mimeType TEXT,
      folder TEXT,
      tags TEXT,
      uploadedBy TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (uploadedBy) REFERENCES users(id)
    )
  `);

  // Create qr_codes table
  run(`
    CREATE TABLE IF NOT EXISTS qr_codes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'url',
      createdAt TEXT DEFAULT (datetime('now')),
      createdBy TEXT NOT NULL,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `);

  // Create activities table for dashboard
  run(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      userId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Create ideas table for IdeaMap
  run(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      type TEXT NOT NULL DEFAULT 'default',
      color TEXT DEFAULT '#6b7280',
      parentId TEXT,
      authorId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (authorId) REFERENCES users(id),
      FOREIGN KEY (parentId) REFERENCES ideas(id)
    )
  `);

  // Create idea_links table
  run(`
    CREATE TABLE IF NOT EXISTS idea_links (
      id TEXT PRIMARY KEY,
      sourceId TEXT NOT NULL,
      targetId TEXT NOT NULL,
      label TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sourceId) REFERENCES ideas(id),
      FOREIGN KEY (targetId) REFERENCES ideas(id)
    )
  `);

  // Create idea_comments table
  run(`
    CREATE TABLE IF NOT EXISTS idea_comments (
      id TEXT PRIMARY KEY,
      ideaId TEXT NOT NULL,
      content TEXT NOT NULL,
      authorId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (ideaId) REFERENCES ideas(id),
      FOREIGN KEY (authorId) REFERENCES users(id)
    )
  `);

  // Create idea_attachments table
  run(`
    CREATE TABLE IF NOT EXISTS idea_attachments (
      id TEXT PRIMARY KEY,
      ideaId TEXT NOT NULL,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      mimeType TEXT,
      size INTEGER DEFAULT 0,
      uploadedBy TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (ideaId) REFERENCES ideas(id),
      FOREIGN KEY (uploadedBy) REFERENCES users(id)
    )
  `);

  // Create kanban_tasks table
  run(`
    CREATE TABLE IF NOT EXISTS kanban_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'queue',
      position INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      dueDate TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      userId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Add archived column if missing (migration for existing DB)
  migrate('ALTER TABLE kanban_tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');

  // Create partners table
  run(`
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'partner',
      category TEXT DEFAULT '',
      contactPerson TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      inn TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add category column if missing (migration)
  migrate('ALTER TABLE partners ADD COLUMN category TEXT DEFAULT ""');

  // Create vacations table (HR)
  run(`
    CREATE TABLE IF NOT EXISTS vacations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'annual',
      status TEXT NOT NULL DEFAULT 'pending',
      approvedBy TEXT,
      notes TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (approvedBy) REFERENCES users(id)
    )
  `);

  // Create inventory table (ТМЦ/ОС)
  run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'ТМЦ',
      description TEXT DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'шт',
      location TEXT DEFAULT '',
      responsiblePerson TEXT DEFAULT '',
      serialNumber TEXT DEFAULT '',
      purchaseDate TEXT,
      purchasePrice REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create events table (tourism department)
  run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT,
      location TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'planned',
      responsiblePerson TEXT DEFAULT '',
      budget REAL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create event blocks table
  run(`
    CREATE TABLE IF NOT EXISTS event_blocks (
      id TEXT PRIMARY KEY,
      eventId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      responsiblePerson TEXT DEFAULT '',
      deadline TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
    )
  `);

  // Create project links table
  run(`
    CREATE TABLE IF NOT EXISTS project_links (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Create projects table (tourism department)
  run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      priority TEXT NOT NULL DEFAULT 'medium',
      startDate TEXT,
      endDate TEXT,
      responsiblePerson TEXT DEFAULT '',
      budget REAL DEFAULT 0,
      progress INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add imageUrl column to events if missing
  migrate('ALTER TABLE events ADD COLUMN imageUrl TEXT DEFAULT ""');

  // Add imageUrl column to projects if missing
  migrate('ALTER TABLE projects ADD COLUMN imageUrl TEXT DEFAULT ""');

  // Create brand_assets table
  run(`
    CREATE TABLE IF NOT EXISTS brand_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'logo',
      description TEXT DEFAULT '',
      url TEXT NOT NULL,
      mimeType TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      uploadedBy TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (uploadedBy) REFERENCES users(id)
    )
  `);

  // Create knowledge_base table
  run(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      category TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      authorId TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (authorId) REFERENCES users(id)
    )
  `);

  // ─── Content approval migrations ─────────────────────────────
  migrate('ALTER TABLE content_posts ADD COLUMN scheduledAt TEXT');
  migrate('ALTER TABLE content_posts ADD COLUMN approvedAt TEXT');
  migrate('ALTER TABLE content_posts ADD COLUMN finalizedAt TEXT');
  migrate('ALTER TABLE content_posts ADD COLUMN rejectionReason TEXT DEFAULT ""');

  // Create content_comments table
  run(`
    CREATE TABLE IF NOT EXISTS content_comments (
      id TEXT PRIMARY KEY,
      postId TEXT NOT NULL,
      content TEXT NOT NULL,
      authorId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (postId) REFERENCES content_posts(id),
      FOREIGN KEY (authorId) REFERENCES users(id)
    )
  `);

  // Create content_approvals table
  run(`
    CREATE TABLE IF NOT EXISTS content_approvals (
      id TEXT PRIMARY KEY,
      postId TEXT NOT NULL,
      approverId TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'pending',
      comment TEXT DEFAULT '',
      actedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (postId) REFERENCES content_posts(id),
      FOREIGN KEY (approverId) REFERENCES users(id)
    )
  `);

  // Create notifications table
  run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      link TEXT DEFAULT '',
      isRead INTEGER NOT NULL DEFAULT 0,
      relatedId TEXT,
      senderId TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (senderId) REFERENCES users(id)
    )
  `);

  // Create chat_conversations table
  run(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'private',
      name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      user1Id TEXT NOT NULL,
      user2Id TEXT NOT NULL,
      lastMessageAt TEXT,
      lastMessagePreview TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user1Id) REFERENCES users(id),
      FOREIGN KEY (user2Id) REFERENCES users(id)
    )
  `);

  // Group chat migrations
  migrate('ALTER TABLE chat_conversations ADD COLUMN type TEXT NOT NULL DEFAULT "private"');
  migrate('ALTER TABLE chat_conversations ADD COLUMN name TEXT DEFAULT ""');
  migrate('ALTER TABLE chat_conversations ADD COLUMN avatar TEXT DEFAULT ""');

  // Create chat_group_members table
  run(`
    CREATE TABLE IF NOT EXISTS chat_group_members (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joinedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Create chat_messages table
  run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      replyToId TEXT,
      replyToContent TEXT DEFAULT '',
      replyToSenderName TEXT DEFAULT '',
      mentionedUserIds TEXT DEFAULT '',
      isRead INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id),
      FOREIGN KEY (senderId) REFERENCES users(id)
    )
  `);

  // Create chat_attachments table
  run(`
    CREATE TABLE IF NOT EXISTS chat_attachments (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      mimeType TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (messageId) REFERENCES chat_messages(id)
    )
  `);

  // Chat message extensions
  migrate('ALTER TABLE chat_messages ADD COLUMN editedAt TEXT');
  migrate('ALTER TABLE chat_messages ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0');
  migrate('ALTER TABLE chat_messages ADD COLUMN forwardedFrom TEXT DEFAULT ""');
  migrate('ALTER TABLE chat_messages ADD COLUMN caption TEXT DEFAULT ""');

  // Group chat extensions
  migrate('ALTER TABLE chat_conversations ADD COLUMN description TEXT DEFAULT ""');
  migrate('ALTER TABLE chat_conversations ADD COLUMN inviteLink TEXT DEFAULT ""');

  // Chat reactions
  run(`
    CREATE TABLE IF NOT EXISTS chat_reactions (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      emoji TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (messageId) REFERENCES chat_messages(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Chat pinned messages
  run(`
    CREATE TABLE IF NOT EXISTS chat_pinned (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      pinnedBy TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id),
      FOREIGN KEY (messageId) REFERENCES chat_messages(id),
      FOREIGN KEY (pinnedBy) REFERENCES users(id)
    )
  `);

  // Chat read receipts (per-user in groups)
  run(`
    CREATE TABLE IF NOT EXISTS chat_reads (
      id TEXT PRIMARY KEY,
      conversationId TEXT NOT NULL,
      userId TEXT NOT NULL,
      lastReadAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversationId) REFERENCES chat_conversations(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Seed default admin user if not exists
  const adminExists = get('SELECT id FROM users WHERE username = ?', ['admin']);
  
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    
    run(`
      INSERT INTO users (id, username, password, email, fullName, role, roles)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      'admin',
      hashedPassword,
      'admin@nexus-crm.ru',
      'Администратор',
      'руководитель',
      'руководитель'
    ]);

    console.log('Default admin user created');
  }

  // Seed super admin if not exists
  const superAdminExists = get('SELECT id FROM users WHERE username = ?', ['Liberty']);
  
  if (!superAdminExists) {
    const hashedPassword = bcrypt.hashSync('43239989', 10);
    
    run(`
      INSERT INTO users (id, username, password, email, fullName, role, roles)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      'Liberty',
      hashedPassword,
      'liberty@nexus-crm.ru',
      'Liberty',
      'super_admin',
      'super_admin'
    ]);

    console.log('Super admin user created');
  }

  console.log('Database initialized successfully');

  // Image generation tracking table
  run(`
    CREATE TABLE IF NOT EXISTS image_gen_log (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      month TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Index for fast monthly count lookups
  try { run('CREATE INDEX IF NOT EXISTS idx_image_gen_user_month ON image_gen_log(userId, month)'); } catch {}

  // Task attachments table
  run(`
    CREATE TABLE IF NOT EXISTS task_attachments (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSize INTEGER DEFAULT 0,
      mimeType TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (taskId) REFERENCES kanban_tasks(id) ON DELETE CASCADE
    )
  `);

  // Project timeline table
  run(`
    CREATE TABLE IF NOT EXISTS project_timeline (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'milestone',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Project documents table
  run(`
    CREATE TABLE IF NOT EXISTS project_documents (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSize INTEGER DEFAULT 0,
      mimeType TEXT DEFAULT '',
      thumbnailPath TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // ─── Schema migrations (add columns to existing tables) ──────
  migrate('ALTER TABLE content_posts ADD COLUMN thumbnailUrl TEXT');
  migrate('ALTER TABLE project_documents ADD COLUMN thumbnailPath TEXT');

  // ─── Performance indexes ──────────────────────────────────────
  try { run('CREATE INDEX IF NOT EXISTS idx_kanban_user_archived ON kanban_tasks(userId, archived, status)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversationId, createdAt)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_chat_messages_read ON chat_messages(conversationId, isRead, deleted)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_chat_conv_users ON chat_conversations(user1Id, user2Id, type)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_chat_group_members ON chat_group_members(conversationId, userId)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_chat_reactions_msg ON chat_reactions(messageId)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(userId, isRead)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_content_posts_status ON content_posts(status)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)'); } catch {}

  // Create push_subscriptions table
  run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      userAgent TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  try { run('CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(userId)'); } catch {}
  try { run('CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint)'); } catch {}

  // New table indexes
  try { run('CREATE INDEX IF NOT EXISTS idx_event_blocks_event ON event_blocks(eventId)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_project_links_project ON project_links(projectId)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_project_docs_project ON project_documents(projectId)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_project_timeline_project ON project_timeline(projectId)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_materials_folder ON materials(folder)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_content_posts_date ON content_posts(scheduledDate)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(createdAt)'); } catch {}

  // ─── Registrations module ────────────────────────────────────
  run(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      eventDate TEXT,
      eventTime TEXT,
      location TEXT DEFAULT '',
      imageUrl TEXT DEFAULT '',
      videoUrl TEXT DEFAULT '',
      maxParticipants INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      publicSlug TEXT UNIQUE,
      createdBy TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS registration_fields (
      id TEXT PRIMARY KEY,
      registrationId TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      placeholder TEXT DEFAULT '',
      required INTEGER NOT NULL DEFAULT 0,
      options TEXT DEFAULT '[]',
      settings TEXT DEFAULT '{}',
      position INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (registrationId) REFERENCES registrations(id) ON DELETE CASCADE
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS registration_submissions (
      id TEXT PRIMARY KEY,
      registrationId TEXT NOT NULL,
      userId TEXT,
      answers TEXT NOT NULL DEFAULT '{}',
      contactName TEXT DEFAULT '',
      contactEmail TEXT DEFAULT '',
      contactPhone TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'confirmed',
      cancelToken TEXT,
      position INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (registrationId) REFERENCES registrations(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  try { run('CREATE INDEX IF NOT EXISTS idx_reg_fields ON registration_fields(registrationId, position)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_reg_submissions ON registration_submissions(registrationId, status)'); } catch {}
  try { run('CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_slug ON registrations(publicSlug)'); } catch {}
  try { run('CREATE INDEX IF NOT EXISTS idx_reg_sub_cancel ON registration_submissions(cancelToken)'); } catch {}

  // Registration time fields migration
  migrate('ALTER TABLE registrations ADD COLUMN registrationStart TEXT DEFAULT ""');
  migrate('ALTER TABLE registrations ADD COLUMN registrationEnd TEXT DEFAULT ""');
  migrate('ALTER TABLE registrations ADD COLUMN closedMessage TEXT DEFAULT ""');
  migrate('ALTER TABLE registrations ADD COLUMN mapCoords TEXT DEFAULT ""');
  migrate('ALTER TABLE registrations ADD COLUMN showLimit INTEGER DEFAULT 1');
  migrate('ALTER TABLE registrations ADD COLUMN showTimer INTEGER DEFAULT 1');

  // Registration media gallery (photos + videos)
  run(`
    CREATE TABLE IF NOT EXISTS registration_media (
      id TEXT PRIMARY KEY,
      registrationId TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'image',
      url TEXT NOT NULL,
      filename TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (registrationId) REFERENCES registrations(id) ON DELETE CASCADE
    )
  `);
  try { run('CREATE INDEX IF NOT EXISTS idx_reg_media ON registration_media(registrationId, position)'); } catch {}

  // Check-in system migrations
  migrate('ALTER TABLE registration_submissions ADD COLUMN checkinToken TEXT DEFAULT ""');
  migrate('ALTER TABLE registration_submissions ADD COLUMN attended INTEGER NOT NULL DEFAULT 0');
  migrate('ALTER TABLE registration_submissions ADD COLUMN attendedAt TEXT');
  migrate('ALTER TABLE registration_submissions ADD COLUMN confirmCode TEXT DEFAULT ""');
  migrate('ALTER TABLE registrations ADD COLUMN organizer TEXT DEFAULT ""');
  try { run('CREATE INDEX IF NOT EXISTS idx_reg_sub_checkin ON registration_submissions(checkinToken)'); } catch {}
}
