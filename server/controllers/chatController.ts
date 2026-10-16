import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, run, get, transaction } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { createNotification, createNotificationsBatch } from './notificationController';
import { sendPushNotification, sendPushBatch } from '../utils/push';

const GENERAL_CHAT_ID = 'general';

// ─── Conversations ─────────────────────────────────────────────

function isSuperUser(req: AuthRequest): boolean {
  const rolesArr = Array.isArray(req.user!.roles) ? req.user!.roles : [req.user!.role].filter(Boolean);
  return rolesArr.includes('super_admin') || req.user!.role === 'super_admin';
}

/** Участник ли текущий юзер в чате (private / group). General — да. */
function isChatMember(conv: any, userId: string): boolean {
  if (!conv) return false;
  if (conv.id === GENERAL_CHAT_ID || conv.type === 'general') return true;
  if (conv.type === 'private') return conv.user1Id === userId || conv.user2Id === userId;
  return !!get('SELECT 1 FROM chat_group_members WHERE conversationId = ? AND userId = ?', [conv.id, userId]);
}

/** Cascade-очистка всех дочерних таблиц чата (FK ON). */
function purgeConversation(id: string) {
  // chat_polls не имеет conversationId — идём через messageId
  run(`DELETE FROM chat_poll_votes WHERE pollId IN (
         SELECT p.id FROM chat_polls p JOIN chat_messages m ON p.messageId = m.id WHERE m.conversationId = ?
       )`, [id], true);
  run(`DELETE FROM chat_poll_options WHERE pollId IN (
         SELECT p.id FROM chat_polls p JOIN chat_messages m ON p.messageId = m.id WHERE m.conversationId = ?
       )`, [id], true);
  run(`DELETE FROM chat_polls WHERE messageId IN (SELECT id FROM chat_messages WHERE conversationId = ?)`, [id], true);

  const mids = query('SELECT id FROM chat_messages WHERE conversationId = ?', [id]) as any[];
  for (const m of mids) {
    run('DELETE FROM chat_reactions WHERE messageId = ?', [m.id], true);
    run('DELETE FROM chat_pinned WHERE messageId = ?', [m.id], true);
    run('DELETE FROM chat_favorites WHERE messageId = ?', [m.id], true);
    run('DELETE FROM chat_attachments WHERE messageId = ?', [m.id], true);
  }
  run('DELETE FROM chat_messages WHERE conversationId = ?', [id]);
  run('DELETE FROM chat_reads WHERE conversationId = ?', [id], true);
  run('DELETE FROM chat_muted WHERE conversationId = ?', [id], true);
  run('DELETE FROM chat_user_mutes WHERE conversationId = ?', [id], true);
  run('DELETE FROM chat_group_members WHERE conversationId = ?', [id], true);
  run('DELETE FROM chat_hidden WHERE conversationId = ?', [id], true);
  run('DELETE FROM chat_user_flags WHERE conversationId = ?', [id], true);
  run('DELETE FROM chat_conversations WHERE id = ?', [id]);
}

/** Непрочитанные — строго per-user через chat_reads.lastReadAt (не global isRead). */
function unreadCountSql(alias = 'm'): string {
  return `(SELECT COUNT(*) FROM chat_messages ${alias}
           WHERE ${alias}.conversationId = c.id AND ${alias}.senderId != ?
             AND ${alias}.deleted = 0
             AND ${alias}.createdAt > COALESCE(
               (SELECT r.lastReadAt FROM chat_reads r WHERE r.conversationId = c.id AND r.userId = ?), ''))`;
}

function lastReadAt(conversationId: string, userId: string): string {
  return get('SELECT lastReadAt FROM chat_reads WHERE conversationId = ? AND userId = ?', [conversationId, userId])?.lastReadAt || '';
}

export const getConversations = (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const privateConvs = query(`
      SELECT c.*,
        CASE WHEN c.user1Id = ? THEN u2.fullName ELSE u1.fullName END as otherName,
        CASE WHEN c.user1Id = ? THEN u2.avatar ELSE u1.avatar END as otherAvatar,
        CASE WHEN c.user1Id = ? THEN u2.position ELSE u1.position END as otherPosition,
        CASE WHEN c.user1Id = ? THEN u2.lastSeen ELSE u1.lastSeen END as otherLastSeen,
        CASE WHEN c.user1Id = ? THEN u2.id ELSE u1.id END as otherId,
        ${unreadCountSql()} as unreadCount,
        (SELECT COUNT(*) FROM chat_user_mutes um WHERE um.conversationId = c.id AND um.userId = ?) as isMuted,
        COALESCE((SELECT uf.pinned FROM chat_user_flags uf WHERE uf.conversationId = c.id AND uf.userId = ?), 0) as pinned,
        COALESCE((SELECT uf.archived FROM chat_user_flags uf WHERE uf.conversationId = c.id AND uf.userId = ?), 0) as archived
      FROM chat_conversations c
      LEFT JOIN users u1 ON c.user1Id = u1.id
      LEFT JOIN users u2 ON c.user2Id = u2.id
      WHERE (c.user1Id = ? OR c.user2Id = ?) AND c.type = 'private'
        AND NOT EXISTS (SELECT 1 FROM chat_hidden h WHERE h.conversationId = c.id AND h.userId = ?)
      ORDER BY c.lastMessageAt DESC
    `, [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]);

    const groupConvs = query(`
      SELECT c.*,
        ${unreadCountSql()} as unreadCount,
        (SELECT COUNT(*) FROM chat_group_members gm WHERE gm.conversationId = c.id) as memberCount,
        (SELECT COUNT(*) FROM chat_user_mutes um WHERE um.conversationId = c.id AND um.userId = ?) as isMuted,
        (SELECT gm.role FROM chat_group_members gm WHERE gm.conversationId = c.id AND gm.userId = ?) as myRole,
        COALESCE((SELECT uf.pinned FROM chat_user_flags uf WHERE uf.conversationId = c.id AND uf.userId = ?), 0) as pinned,
        COALESCE((SELECT uf.archived FROM chat_user_flags uf WHERE uf.conversationId = c.id AND uf.userId = ?), 0) as archived
      FROM chat_conversations c
      JOIN chat_group_members gm ON c.id = gm.conversationId AND gm.userId = ?
      WHERE c.type = 'group'
        AND NOT EXISTS (SELECT 1 FROM chat_hidden h WHERE h.conversationId = c.id AND h.userId = ?)
      ORDER BY c.lastMessageAt DESC
    `, [userId, userId, userId, userId, userId, userId, userId, userId]);

    const generalLast = get(`SELECT content, createdAt FROM chat_messages WHERE conversationId = ? AND deleted = 0 ORDER BY createdAt DESC LIMIT 1`, [GENERAL_CHAT_ID]);
    const generalUnread = get(`SELECT COUNT(*) as count FROM chat_messages m WHERE m.conversationId = ? AND m.senderId != ? AND m.deleted = 0
      AND m.createdAt > COALESCE((SELECT r.lastReadAt FROM chat_reads r WHERE r.conversationId = ? AND r.userId = ?), '')`,
      [GENERAL_CHAT_ID, userId, GENERAL_CHAT_ID, userId]);
    const generalMuted = get(`SELECT COUNT(*) as count FROM chat_user_mutes WHERE conversationId = ? AND userId = ?`, [GENERAL_CHAT_ID, userId]);
    const generalFlags = get('SELECT pinned, archived FROM chat_user_flags WHERE conversationId = ? AND userId = ?', [GENERAL_CHAT_ID, userId]);

    const generalConv = {
      id: GENERAL_CHAT_ID, type: 'general', name: 'Общий чат', avatar: '', description: '', inviteLink: '',
      user1Id: '', user2Id: '', otherName: 'Общий чат', otherAvatar: null,
      otherPosition: 'Все сотрудники', otherId: null,
      lastMessageAt: generalLast?.createdAt || null,
      lastMessagePreview: generalLast?.content?.substring(0, 100) || 'Нет сообщений',
      unreadCount: generalUnread?.count || 0, isGeneral: true, createdAt: '',
      isMuted: generalMuted?.count || 0,
      pinned: generalFlags?.pinned || 0,
      archived: generalFlags?.archived || 0,
    };

    const allConvs = [
      generalConv,
      ...groupConvs.map((c: any) => ({ ...c, isGroup: true, otherName: c.name, otherAvatar: c.avatar, otherPosition: `${c.memberCount || 0} участников` })),
      ...privateConvs,
    ].sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });

    res.json({ success: true, data: allConvs });
  } catch (error) {
    console.error('GetConversations error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const getOrCreateConversation = (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId обязателен' });
    if (targetUserId === userId) return res.status(400).json({ success: false, error: 'Нельзя создать диалог с собой' });

    const u1 = userId < targetUserId ? userId : targetUserId;
    const u2 = userId < targetUserId ? targetUserId : userId;

    let conv = get('SELECT * FROM chat_conversations WHERE user1Id = ? AND user2Id = ? AND type = ?', [u1, u2, 'private']);
    if (!conv) {
      const id = uuidv4();
      run('INSERT INTO chat_conversations (id, type, user1Id, user2Id) VALUES (?, ?, ?, ?)', [id, 'private', u1, u2]);
      conv = get('SELECT * FROM chat_conversations WHERE id = ?', [id]);
    } else {
      // H6 fix: unhide only for the CALLER — never clear the other user's deliberate hide
      run('DELETE FROM chat_hidden WHERE conversationId = ? AND userId = ?', [conv.id, userId]);
    }
    res.json({ success: true, data: conv });
  } catch (error) {
    console.error('GetOrCreateConversation error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ─── Groups ────────────────────────────────────────────────────

export const createGroup = (req: AuthRequest, res: Response) => {
  try {
    const { name, memberIds } = req.body;
    const userId = req.user!.id;

    if (!name) return res.status(400).json({ success: false, error: 'Название группы обязательно' });
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 1) return res.status(400).json({ success: false, error: 'Добавьте минимум 1 участника' });

    const id = uuidv4();
    const inviteLink = uuidv4().substring(0, 8);
    const uniqueMembers = [...new Set(memberIds)].filter(uid => uid !== userId);

    transaction(() => {
      run('INSERT INTO chat_conversations (id, type, name, user1Id, user2Id, inviteLink) VALUES (?, ?, ?, ?, ?, ?)', [id, 'group', name, userId, userId, inviteLink]);
      run('INSERT INTO chat_group_members (id, conversationId, userId, role) VALUES (?, ?, ?, ?)', [uuidv4(), id, userId, 'admin']);
      for (const uid of uniqueMembers) {
        run('INSERT INTO chat_group_members (id, conversationId, userId) VALUES (?, ?, ?)', [uuidv4(), id, uid]);
      }
    });

    // Notifications outside the transaction — external side effects shouldn't roll back
    for (const uid of uniqueMembers) {
      createNotification({ userId: uid, type: 'chat_message', title: `Добавлены в группу "${name}"`, body: `${req.user!.username} добавил вас`, link: `/chat?conv=${id}`, senderId: userId });
    }

    const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: { ...conv, isGroup: true, otherName: conv?.name, otherAvatar: conv?.avatar, memberCount: uniqueMembers.length + 1 } });
  } catch (error) {
    console.error('CreateGroup error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateGroup = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, avatar, description } = req.body;
    const conv = get('SELECT * FROM chat_conversations WHERE id = ? AND type = ?', [id, 'group']);
    if (!conv) return res.status(404).json({ success: false, error: 'Группа не найдена' });
    const callerMembership = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, req.user!.id]);
    if (callerMembership?.role !== 'admin' && !isSuperUser(req)) return res.status(403).json({ success: false, error: 'Только админ группы может изменять настройки' });

    const updates: string[] = []; const params: any[] = [];
    if (name) { updates.push('name = ?'); params.push(name); }
    if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'Нечего обновлять' });
    params.push(id);
    run(`UPDATE chat_conversations SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (error) {
    console.error('UpdateGroup error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const addGroupMember = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; const { userId: newMemberId } = req.body;
    const callerMembership = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, req.user!.id]);
    if (callerMembership?.role !== 'admin' && !isSuperUser(req)) return res.status(403).json({ success: false, error: 'Только админ группы может добавлять участников' });
    const existing = get('SELECT * FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, newMemberId]);
    if (existing) return res.status(400).json({ success: false, error: 'Уже в группе' });
    run('INSERT INTO chat_group_members (id, conversationId, userId) VALUES (?, ?, ?)', [uuidv4(), id, newMemberId]);
    // H7 fix: a re-added member must see the group immediately (clear old hide tombstone)
    run('DELETE FROM chat_hidden WHERE conversationId = ? AND userId = ?', [id, newMemberId]);
    res.json({ success: true });
  } catch (error) { console.error('AddGroupMember error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const removeGroupMember = (req: AuthRequest, res: Response) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const callerMembership = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, req.user!.id]);
    if (!callerMembership) return res.status(403).json({ success: false, error: 'Вы не участник группы' });
    if (targetUserId !== req.user!.id && callerMembership.role !== 'admin' && !isSuperUser(req)) {
      return res.status(403).json({ success: false, error: 'Только админ группы может удалять других участников' });
    }
    // нельзя удалить последнего админа
    const target = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, targetUserId]);
    if (target?.role === 'admin') {
      const adminCount = get("SELECT COUNT(*) as c FROM chat_group_members WHERE conversationId = ? AND role = 'admin'", [id])?.c || 0;
      if (adminCount <= 1) return res.status(400).json({ success: false, error: 'Нельзя удалить последнего админа' });
    }
    run('DELETE FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, targetUserId]);
    res.json({ success: true });
  } catch (error) { console.error('RemoveGroupMember error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

/** Смена роли участника (admin / member) */
export const setGroupMemberRole = (req: AuthRequest, res: Response) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { role } = req.body || {};
    if (role !== 'admin' && role !== 'member') {
      return res.status(400).json({ success: false, error: 'Роль: admin или member' });
    }
    const callerMembership = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, req.user!.id]);
    if (callerMembership?.role !== 'admin' && !isSuperUser(req)) {
      return res.status(403).json({ success: false, error: 'Только админ группы может менять роли' });
    }
    const target = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, targetUserId]);
    if (!target) return res.status(404).json({ success: false, error: 'Участник не найден' });
    // нельзя понизить последнего админа
    if (target.role === 'admin' && role === 'member') {
      const adminCount = get("SELECT COUNT(*) as c FROM chat_group_members WHERE conversationId = ? AND role = 'admin'", [id])?.c || 0;
      if (adminCount <= 1) return res.status(400).json({ success: false, error: 'Нельзя понизить последнего админа' });
    }
    run('UPDATE chat_group_members SET role = ? WHERE conversationId = ? AND userId = ?', [role, id, targetUserId]);
    res.json({ success: true });
  } catch (error) { console.error('SetGroupMemberRole error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const getGroupMembers = (req: AuthRequest, res: Response) => {
  try {
    const members = query(`SELECT gm.*, u.fullName, u.avatar, u.position, u.role as userRole FROM chat_group_members gm LEFT JOIN users u ON gm.userId = u.id WHERE gm.conversationId = ? ORDER BY gm.role DESC, u.fullName ASC`, [req.params.id]);
    res.json({ success: true, data: members });
  } catch (error) { console.error('GetGroupMembers error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const joinByInvite = (req: AuthRequest, res: Response) => {
  try {
    const { link } = req.params;
    const conv = get('SELECT * FROM chat_conversations WHERE inviteLink = ?', [link]);
    if (!conv) return res.status(404).json({ success: false, error: 'Ссылка недействительна' });
    const existing = get('SELECT * FROM chat_group_members WHERE conversationId = ? AND userId = ?', [conv.id, req.user!.id]);
    if (!existing) run('INSERT INTO chat_group_members (id, conversationId, userId) VALUES (?, ?, ?)', [uuidv4(), conv.id, req.user!.id]);
    // повторный вход по инвайту — группа снова видна
    run('DELETE FROM chat_hidden WHERE conversationId = ? AND userId = ?', [conv.id, req.user!.id]);
    res.json({ success: true, data: { ...conv, isGroup: conv.type === 'group', otherName: conv.name, otherAvatar: conv.avatar } });
  } catch (error) { console.error('JoinByInvite error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ─── Messages ──────────────────────────────────────────────────

export const getMessages = (req: AuthRequest, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user?.id;
    const after = req.query.after as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
    if (!conv && conversationId !== GENERAL_CHAT_ID) return res.status(404).json({ success: false, error: 'Чат не найден' });
    if (conv && userId && !isChatMember(conv, userId)) return res.status(403).json({ success: false, error: 'Нет доступа' });

    let sql: string;
    const params: any[] = [];
    if (after) {
      // Pagination forward: messages after a cursor
      sql = `SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition
             FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id
             WHERE m.conversationId = ? AND m.deleted = 0 AND m.createdAt > ?
             ORDER BY m.createdAt ASC LIMIT ?`;
      params.push(conversationId, after, limit);
    } else {
      // Initial load: return the NEWEST `limit` messages in chronological order
      sql = `SELECT * FROM (
               SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition
               FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id
               WHERE m.conversationId = ? AND m.deleted = 0
               ORDER BY m.createdAt DESC LIMIT ?
             ) ORDER BY createdAt ASC`;
      params.push(conversationId, limit);
    }

    const messages = query(sql, params);

    // Attach reactions to each message
    const msgIds = messages.map(m => m.id);
    if (msgIds.length > 0) {
      const placeholders = msgIds.map(() => '?').join(',');
      const reactions = query(`SELECT r.*, u.fullName as userName FROM chat_reactions r LEFT JOIN users u ON r.userId = u.id WHERE r.messageId IN (${placeholders})`, msgIds);
      for (const msg of messages) {
        (msg as any).reactions = reactions.filter(r => r.messageId === msg.id);
      }
    }

    // isRead — per-user (курсор в chat_reads), чтобы разделитель «непрочитанные» был честным
    if (userId) {
      const lr = lastReadAt(conversationId, userId);
      for (const msg of messages) {
        if (msg.senderId === userId) continue;
        (msg as any).isRead = lr && msg.createdAt <= lr ? 1 : 0;
      }
    }

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('GetMessages error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const sendMessage = (req: AuthRequest, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const { content, type = 'text', replyToId, mentionedUserIds, forwardedFrom, caption } = req.body;
    const senderId = req.user!.id;

    if (!content && !caption) return res.status(400).json({ success: false, error: 'content обязателен' });

    const isGeneral = conversationId === GENERAL_CHAT_ID;
    let conv: any = null;

    if (!isGeneral) {
      conv = get('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
      if (!conv) return res.status(404).json({ success: false, error: 'Диалог не найден' });
      if (conv.type === 'private' && conv.user1Id !== senderId && conv.user2Id !== senderId) return res.status(403).json({ success: false, error: 'Нет доступа' });
      if (conv.type === 'group' && !get('SELECT id FROM chat_group_members WHERE conversationId = ? AND userId = ?', [conversationId, senderId])) return res.status(403).json({ success: false, error: 'Нет доступа к группе' });
      // mute: замученный участник не может писать
      const muted = get("SELECT id FROM chat_muted WHERE conversationId = ? AND userId = ? AND (mutedUntil IS NULL OR mutedUntil > datetime('now'))", [conversationId, senderId]);
      if (muted) return res.status(403).json({ success: false, error: 'Вы замучены в этом чате' });
    }

    let replyToContent = '', replyToSenderName = '';
    if (replyToId) {
      const replyMsg = get('SELECT m.content, u.fullName FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?', [replyToId]);
      if (replyMsg) { replyToContent = (replyMsg.content || '').substring(0, 200); replyToSenderName = replyMsg.fullName || ''; }
    }

    const msgId = uuidv4();
    run(`INSERT INTO chat_messages (id, conversationId, senderId, type, content, replyToId, replyToContent, replyToSenderName, mentionedUserIds, forwardedFrom, caption)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msgId, conversationId, senderId, type, content || '', replyToId || null, replyToContent, replyToSenderName, mentionedUserIds || '', forwardedFrom || '', caption || '']);

    const preview = type === 'text' ? (content || '').substring(0, 100) : ((caption || '').substring(0, 100) || `[${type}]`);
    if (!isGeneral) {
      run("UPDATE chat_conversations SET lastMessageAt = datetime('now'), lastMessagePreview = ? WHERE id = ?", [preview, conversationId]);
      // H6 fix: for private chats a new message bumps the chat back (Telegram-like).
      // For groups NEVER blanket-unhide — a member who deliberately hid (or left) must stay hidden.
      const convType = get('SELECT type FROM chat_conversations WHERE id = ?', [conversationId]);
      if (convType?.type === 'private') {
        run('DELETE FROM chat_hidden WHERE conversationId = ? AND userId != ?', [conversationId, senderId]);
      }
    }

    const sender = get('SELECT fullName FROM users WHERE id = ?', [senderId]);

    // Send socket message FIRST (don't block on notifications)
    const io = req.app.get('io');
    if (io) {
      const fullMsg = get(`SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?`, [msgId]);
      if (isGeneral) io.emit('chat:message', fullMsg);
      else {
        io.to(`conv:${conversationId}`).emit('chat:message', fullMsg);
        // участникам, кто чат не открыл — чтобы список/бейдж обновились
        const recipients = conv.type === 'private'
          ? [conv.user1Id === senderId ? conv.user2Id : conv.user1Id]
          : query('SELECT userId FROM chat_group_members WHERE conversationId = ? AND userId != ?', [conversationId, senderId]).map((m: any) => m.userId);
        for (const uid of recipients) io.to(`user:${uid}`).emit('chat:message', fullMsg);
      }
    }

    res.json({ success: true, data: get(`SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?`, [msgId]) });

    // Notifications — fire and forget (don't block response)
    try {
      // не слать тем, кто замутил чат или скрыл его
      const skipUser = (uid: string) =>
        !!get('SELECT 1 FROM chat_user_mutes WHERE conversationId = ? AND userId = ?', [conversationId, uid]) ||
        !!get('SELECT 1 FROM chat_hidden WHERE conversationId = ? AND userId = ?', [conversationId, uid]);

      if (isGeneral) {
        const allUsers = query('SELECT id FROM users WHERE id != ?', [senderId]).filter((u: any) => !skipUser(u.id));
        const batch = allUsers.map((u: any) => ({ userId: u.id, type: 'chat_message', title: `Общий чат: ${sender?.fullName}`, body: preview, link: `/chat?conv=general`, relatedId: msgId, senderId }));
        createNotificationsBatch(batch);
        sendPushBatch(allUsers.map((u: any) => u.id), { title: `Общий чат: ${sender?.fullName}`, body: preview, tag: 'nexus-chat-general', link: `/chat?conv=general` }).catch(() => {});
      } else {
        const c = conv || get('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
        if (c?.type === 'private') {
          const recipientId = c.user1Id === senderId ? c.user2Id : c.user1Id;
          if (!skipUser(recipientId)) {
            createNotification({ userId: recipientId, type: 'chat_message', title: `Сообщение от ${sender?.fullName}`, body: preview, link: `/chat?conv=${conversationId}`, relatedId: msgId, senderId });
            sendPushNotification(recipientId, { title: `Сообщение от ${sender?.fullName}`, body: preview, tag: `nexus-chat-${conversationId}`, link: `/chat?conv=${conversationId}` }).catch(() => {});
          }
        } else if (c?.type === 'group') {
          const members = query('SELECT userId FROM chat_group_members WHERE conversationId = ? AND userId != ?', [conversationId, senderId])
            .filter((m: any) => !skipUser(m.userId));
          const batch = members.map((m: any) => ({ userId: m.userId, type: 'chat_message', title: `${c.name}: ${sender?.fullName}`, body: preview, link: `/chat?conv=${conversationId}`, relatedId: msgId, senderId }));
          createNotificationsBatch(batch);
          sendPushBatch(members.map((m: any) => m.userId), { title: `${c.name}: ${sender?.fullName}`, body: preview, tag: `nexus-chat-${conversationId}`, link: `/chat?conv=${conversationId}` }).catch(() => {});
        }
      }

    if (mentionedUserIds) {
      const ids = mentionedUserIds.split(',').filter((id: string) => id && id !== senderId);
      ids.forEach((uid: string) => createNotification({ userId: uid.trim(), type: 'mention', title: `Вас упомянули`, body: preview, link: `/chat?conv=${conversationId}`, relatedId: msgId, senderId }));
    }

    } catch (notifError) { console.error('Notification error (non-fatal):', notifError); }
  } catch (error) {
    console.error('SendMessage error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ─── Edit / Delete / Forward ───────────────────────────────────

export const editMessage = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const msg = get('SELECT * FROM chat_messages WHERE id = ?', [id]);
    if (!msg) return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    if (msg.senderId !== req.user!.id) return res.status(403).json({ success: false, error: 'Можно редактировать только свои сообщения' });
    run("UPDATE chat_messages SET content = ?, editedAt = datetime('now') WHERE id = ?", [content, id]);
    const updated = get(`SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?`, [id]);
    res.json({ success: true, data: updated });
    const io = req.app.get('io');
    if (io) {
      const payload = { id, content, editedAt: updated.editedAt };
      if (msg.conversationId === GENERAL_CHAT_ID) io.emit('chat:message-edit', payload);
      else io.to(`conv:${msg.conversationId}`).emit('chat:message-edit', payload);
    }
  } catch (error) { console.error('EditMessage error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const deleteMessage = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const msg = get('SELECT * FROM chat_messages WHERE id = ?', [id]);
    if (!msg) return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    if (msg.senderId !== req.user!.id && !isSuperUser(req)) return res.status(403).json({ success: false, error: 'Нет прав' });
    run('UPDATE chat_messages SET deleted = 1 WHERE id = ?', [id]);
    // Update conversation preview
    const lastMsg = get('SELECT content FROM chat_messages WHERE conversationId = ? AND deleted = 0 ORDER BY createdAt DESC LIMIT 1', [msg.conversationId]);
    run("UPDATE chat_conversations SET lastMessagePreview = ? WHERE id = ?", [lastMsg ? lastMsg.content.substring(0, 100) : '', msg.conversationId]);
    res.json({ success: true });
    const io = req.app.get('io');
    if (io) {
      if (msg.conversationId === GENERAL_CHAT_ID) io.emit('chat:message-delete', { id });
      else io.to(`conv:${msg.conversationId}`).emit('chat:message-delete', { id });
    }
  } catch (error) { console.error('DeleteMessage error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ─── Reactions ─────────────────────────────────────────────────

export const addReaction = (req: AuthRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user!.id;
    const msg0 = get('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
    if (!msg0) return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    const conv0 = get('SELECT * FROM chat_conversations WHERE id = ?', [msg0.conversationId]);
    if (!isChatMember(conv0, userId)) return res.status(403).json({ success: false, error: 'Нет доступа' });
    // Remove existing reaction from this user on this message
    run('DELETE FROM chat_reactions WHERE messageId = ? AND userId = ?', [messageId, userId]);
    run('INSERT INTO chat_reactions (id, messageId, userId, emoji) VALUES (?, ?, ?, ?)', [uuidv4(), messageId, userId, emoji]);
    const reactions = query('SELECT r.*, u.fullName as userName FROM chat_reactions r LEFT JOIN users u ON r.userId = u.id WHERE r.messageId = ?', [messageId]);
    res.json({ success: true, data: reactions });
    const convRow = get('SELECT conversationId FROM chat_messages WHERE id = ?', [messageId]);
    const io = req.app.get('io');
    if (io && convRow) {
      if (convRow.conversationId === GENERAL_CHAT_ID) io.emit('chat:reaction', { messageId, reactions });
      else io.to(`conv:${convRow.conversationId}`).emit('chat:reaction', { messageId, reactions });
    }
  } catch (error) { console.error('AddReaction error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const removeReaction = (req: AuthRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    run('DELETE FROM chat_reactions WHERE messageId = ? AND userId = ?', [messageId, req.user!.id]);
    const reactions = query('SELECT r.*, u.fullName as userName FROM chat_reactions r LEFT JOIN users u ON r.userId = u.id WHERE r.messageId = ?', [messageId]);
    res.json({ success: true, data: reactions });
    const convRow = get('SELECT conversationId FROM chat_messages WHERE id = ?', [messageId]);
    const io = req.app.get('io');
    if (io && convRow) {
      if (convRow.conversationId === GENERAL_CHAT_ID) io.emit('chat:reaction', { messageId, reactions });
      else io.to(`conv:${convRow.conversationId}`).emit('chat:reaction', { messageId, reactions });
    }
  } catch (error) { console.error('RemoveReaction error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ─── Pinned ────────────────────────────────────────────────────

export const pinMessage = (req: AuthRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    const msg = get('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
    if (!msg) return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [msg.conversationId]);
    if (!isChatMember(conv, req.user!.id)) return res.status(403).json({ success: false, error: 'Нет доступа' });
    const existing = get('SELECT * FROM chat_pinned WHERE conversationId = ? AND messageId = ?', [msg.conversationId, messageId]);
    if (existing) return res.json({ success: true });
    run('INSERT INTO chat_pinned (id, conversationId, messageId, pinnedBy) VALUES (?, ?, ?, ?)', [uuidv4(), msg.conversationId, messageId, req.user!.id]);
    res.json({ success: true });
  } catch (error) { console.error('PinMessage error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const unpinMessage = (req: AuthRequest, res: Response) => {
  try {
    run('DELETE FROM chat_pinned WHERE messageId = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) { console.error('UnpinMessage error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const getPinnedMessages = (req: AuthRequest, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const pinned = query(`
      SELECT p.*, m.content, m.type, m.senderId, m.createdAt as messageCreatedAt, u.fullName as senderName
      FROM chat_pinned p
      JOIN chat_messages m ON p.messageId = m.id
      LEFT JOIN users u ON m.senderId = u.id
      WHERE p.conversationId = ?
      ORDER BY p.createdAt DESC
    `, [conversationId]);
    res.json({ success: true, data: pinned });
  } catch (error) { console.error('GetPinnedMessages error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ─── Read receipts ─────────────────────────────────────────────

export const markConversationRead = (req: AuthRequest, res: Response) => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [convId]);
    if (conv && !isChatMember(conv, userId)) return res.status(403).json({ success: false, error: 'Нет доступа' });
    // per-user курсор прочтения — единственный источник истины для unread
    const existing = get('SELECT * FROM chat_reads WHERE conversationId = ? AND userId = ?', [convId, userId]);
    if (existing) run("UPDATE chat_reads SET lastReadAt = datetime('now') WHERE conversationId = ? AND userId = ?", [convId, userId]);
    else run("INSERT INTO chat_reads (id, conversationId, userId, lastReadAt) VALUES (?, ?, ?, datetime('now'))", [uuidv4(), convId, userId]);
    // ✓✓ для private: собеседник открыл — мои сообщения «прочитаны»
    if (conv?.type === 'private') {
      run('UPDATE chat_messages SET isRead = 1 WHERE conversationId = ? AND senderId != ? AND isRead = 0 AND deleted = 0', [convId, userId]);
    }
    res.json({ success: true });
  } catch (error) { console.error('MarkConversationRead error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const getReadReceipts = (req: AuthRequest, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const reads = query(`SELECT cr.*, u.fullName, u.avatar FROM chat_reads cr LEFT JOIN users u ON cr.userId = u.id WHERE cr.conversationId = ?`, [conversationId]);
    res.json({ success: true, data: reads });
  } catch (error) { console.error('GetReadReceipts error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ─── Typing ────────────────────────────────────────────────────

const typingUsers = new Map<string, { userId: string; name: string; until: number }>();

export const setTyping = (req: AuthRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const key = `${conversationId}:${req.user!.id}`;
  typingUsers.set(key, { userId: req.user!.id, name: req.user!.username, until: Date.now() + 3000 });
  const user = get('SELECT fullName FROM users WHERE id = ?', [req.user!.id]);
  const io = req.app.get('io');
  if (io) {
    const payload = { userId: req.user!.id, name: user?.fullName || req.user!.username };
    if (conversationId === GENERAL_CHAT_ID) io.emit('chat:typing', payload);
    else io.to(`conv:${conversationId}`).emit('chat:typing', payload);
  }
  res.json({ success: true });
};

export const getTyping = (req: AuthRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const now = Date.now();
  const typing = [];
  for (const [key, val] of typingUsers) {
    if (key.startsWith(conversationId + ':') && val.userId !== req.user!.id && val.until > now) typing.push(val);
    if (val.until <= now) typingUsers.delete(key);
  }
  res.json({ success: true, data: typing });
};

// ─── Upload / Unread ───────────────────────────────────────────

export const uploadChatFile = (req: AuthRequest, res: Response) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });
    const decodedName = file.decodedOriginalname || file.originalname;
    res.json({ success: true, data: { url: `/uploads/${file.filename}`, filename: decodedName, size: file.size, mimeType: file.mimetype } });
  } catch (error) { console.error('UploadChatFile error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const getChatUnreadCount = (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const unreadFor = (extraWhere: string, extraJoins: string, extraParams: any[]) => {
      const rows = query(`
        SELECT c.id FROM chat_conversations c ${extraJoins}
        WHERE ${extraWhere}
          AND NOT EXISTS (SELECT 1 FROM chat_hidden h WHERE h.conversationId = c.id AND h.userId = ?)
          AND EXISTS (
            SELECT 1 FROM chat_messages m
            WHERE m.conversationId = c.id AND m.senderId != ? AND m.deleted = 0
              AND m.createdAt > COALESCE((SELECT r.lastReadAt FROM chat_reads r WHERE r.conversationId = c.id AND r.userId = ?), '')
          )
      `, [...extraParams, userId, userId, userId]);
      return rows.length;
    };
    const privateCount = unreadFor('(c.user1Id = ? OR c.user2Id = ?) AND c.type = \'private\'', '', [userId, userId]);
    const groupCount = unreadFor("c.type = 'group'", 'JOIN chat_group_members gm ON c.id = gm.conversationId AND gm.userId = ?', [userId]);
    const generalCount = unreadFor("c.id = ?", '', [GENERAL_CHAT_ID]);
    res.json({ success: true, data: { count: privateCount + groupCount + generalCount } });
  } catch (error) { console.error('GetChatUnreadCount error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ── Hide / Delete / Leave ──

/** Hide conversation for current user only ("delete chat for me", like Telegram). */
export const hideConversation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify membership
    const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [id]);
    if (!conv) return res.status(404).json({ success: false, error: 'Чат не найден' });
    if (conv.type === 'general' || id === GENERAL_CHAT_ID) return res.status(400).json({ success: false, error: 'Общий чат нельзя удалить' });

    const isMember = conv.type === 'private'
      ? (conv.user1Id === userId || conv.user2Id === userId)
      : !!get('SELECT 1 FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, userId]);
    if (!isMember) return res.status(403).json({ success: false, error: 'Вы не участник этого чата' });

    run('INSERT OR IGNORE INTO chat_hidden (id, conversationId, userId) VALUES (?, ?, ?)', [uuidv4(), id, userId]);
    res.json({ success: true, message: 'Чат удалён' });
  } catch (error) {
    console.error('HideConversation error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

/** Unhide conversation (when a new message arrives or user reopens via profile). */
export const unhideConversation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    run('DELETE FROM chat_hidden WHERE conversationId = ? AND userId = ?', [id, req.user!.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('UnhideConversation error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// Note: getOrCreateConversation also un-hides when reopening a deleted private chat.

/** Permanently delete a group (admin only). Removes members, messages, reactions, etc. */
export const deleteGroup = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const conv = get("SELECT * FROM chat_conversations WHERE id = ? AND type = 'group'", [id]);
    if (!conv) return res.status(404).json({ success: false, error: 'Группа не найдена' });

    const membership = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, userId]);
    const isGroupAdmin = membership?.role === 'admin';
    // создатель группы (user1Id) тоже может удалить
    const isCreator = conv.user1Id === userId;
    if (!isGroupAdmin && !isSuperUser(req) && !isCreator) {
      return res.status(403).json({ success: false, error: 'Только админ группы может удалить её' });
    }

    transaction(() => purgeConversation(id));

    const io = req.app.get('io');
    if (io) io.emit('chat:conversation-deleted', { conversationId: id });

    res.json({ success: true, message: 'Группа удалена' });
  } catch (error) {
    console.error('DeleteGroup error:', error);
    res.status(500).json({ success: false, error: 'Не удалось удалить группу' });
  }
};

/** Leave a group (member removes self). */
export const leaveGroup = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const conv = get("SELECT * FROM chat_conversations WHERE id = ? AND type = 'group'", [id]);
    if (!conv) return res.status(404).json({ success: false, error: 'Группа не найдена' });

    const membership = get('SELECT * FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, userId]);
    if (!membership) return res.status(400).json({ success: false, error: 'Вы не состоите в этой группе' });

    // If last admin is leaving — promote another member or delete group
    const adminCount = get("SELECT COUNT(*) as count FROM chat_group_members WHERE conversationId = ? AND role = 'admin'", [id]);
    if (membership.role === 'admin' && adminCount?.count <= 1) {
      const other = get("SELECT userId FROM chat_group_members WHERE conversationId = ? AND userId != ? LIMIT 1", [id, userId]);
      if (other) {
        run("UPDATE chat_group_members SET role = 'admin' WHERE conversationId = ? AND userId = ?", [id, other.userId]);
      } else {
        // Last member leaving — delete group entirely (full cascade)
        transaction(() => purgeConversation(id));
        const io = req.app.get('io');
        if (io) io.emit('chat:conversation-deleted', { conversationId: id });
        return res.json({ success: true, message: 'Группа удалена' });
      }
    }

    run('DELETE FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, userId]);
    run('INSERT OR IGNORE INTO chat_hidden (id, conversationId, userId) VALUES (?, ?, ?)', [uuidv4(), id, userId]);

    const io = req.app.get('io');
    if (io) io.to(`conv:${id}`).emit('chat:member-left', { conversationId: id, userId });

    res.json({ success: true, message: 'Вы покинули группу' });
  } catch (error) {
    console.error('LeaveGroup error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Archive / Unarchive ──

export const archiveConversation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    upsertUserFlag(id, req.user!.id, 'archived', 1);
    res.json({ success: true });
  } catch (error) { console.error('ArchiveConversation error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const unarchiveConversation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    upsertUserFlag(id, req.user!.id, 'archived', 0);
    res.json({ success: true });
  } catch (error) { console.error('UnarchiveConversation error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ── Pin / Unpin conversation (per-user) ──

function upsertUserFlag(conversationId: string, userId: string, field: 'pinned' | 'archived', value: number) {
  const existing = get('SELECT id FROM chat_user_flags WHERE conversationId = ? AND userId = ?', [conversationId, userId]);
  if (existing) run(`UPDATE chat_user_flags SET ${field} = ? WHERE conversationId = ? AND userId = ?`, [value, conversationId, userId]);
  else run(`INSERT INTO chat_user_flags (id, conversationId, userId, pinned, archived) VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), conversationId, userId, field === 'pinned' ? value : 0, field === 'archived' ? value : 0]);
}

export const pinConversation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    upsertUserFlag(id, req.user!.id, 'pinned', 1);
    res.json({ success: true });
  } catch (error) { console.error('PinConversation error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const unpinConversation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    upsertUserFlag(id, req.user!.id, 'pinned', 0);
    res.json({ success: true });
  } catch (error) { console.error('UnpinConversation error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ── Favorites ──

export const addFavorite = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const existing = get('SELECT id FROM chat_favorites WHERE messageId = ? AND userId = ?', [id, userId]);
    if (existing) return res.json({ success: true });
    run('INSERT INTO chat_favorites (id, messageId, userId) VALUES (?, ?, ?)', [uuidv4(), id, userId]);
    res.json({ success: true });
  } catch (error) { console.error('AddFavorite error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const removeFavorite = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    run('DELETE FROM chat_favorites WHERE messageId = ? AND userId = ?', [id, userId]);
    res.json({ success: true });
  } catch (error) { console.error('RemoveFavorite error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const getFavorites = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const favorites = query(`
      SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition
      FROM chat_favorites f
      JOIN chat_messages m ON f.messageId = m.id
      LEFT JOIN users u ON m.senderId = u.id
      WHERE f.userId = ? AND m.conversationId = ?
      ORDER BY f.createdAt DESC
    `, [userId, id]);
    res.json({ success: true, data: favorites });
  } catch (error) { console.error('GetFavorites error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ── Polls ──

export const createPoll = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { question, options } = req.body;
    if (!question || !options || options.length < 2) return res.status(400).json({ success: false, error: 'Нужен вопрос и минимум 2 варианта' });

    const conv = get('SELECT id FROM chat_conversations WHERE id = ?', [id]);
    if (!conv && id !== GENERAL_CHAT_ID) return res.status(404).json({ success: false, error: 'Чат не найден' });
    const senderId = req.user!.id;
    const convFull = get('SELECT * FROM chat_conversations WHERE id = ?', [id]);
    if (convFull && !isChatMember(convFull, senderId)) return res.status(403).json({ success: false, error: 'Нет доступа' });

    const messageId = uuidv4();
    const pollId = uuidv4();

    // Create message of type 'poll' — content = pollId (used by frontend to fetch results)
    run('INSERT INTO chat_messages (id, conversationId, senderId, type, content) VALUES (?, ?, ?, ?, ?)',
      [messageId, id, senderId, 'poll', pollId]);

    // Create poll
    run('INSERT INTO chat_polls (id, messageId, question, createdBy) VALUES (?, ?, ?, ?)', [pollId, messageId, question, senderId]);

    // Create options
    for (let i = 0; i < options.length; i++) {
      run('INSERT INTO chat_poll_options (id, pollId, text, position) VALUES (?, ?, ?, ?)', [uuidv4(), pollId, options[i], i]);
    }

    // Update conversation last message
    run("UPDATE chat_conversations SET lastMessageAt = datetime('now'), lastMessagePreview = ? WHERE id = ?", [`📊 ${question}`, id]);

    // Update the message content to include question for preview (pollId is primary key)
    // Actually, let's keep pollId as content and use the preview separately
    const msg = get(`SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?`, [messageId]);

    // Emit socket
    const io = (req as any).app?.get('io');
    if (io) {
      if (id === GENERAL_CHAT_ID) io.emit('chat:message', msg);
      else io.to(`conv:${id}`).emit('chat:message', msg);
    }

    res.status(201).json({ success: true, data: msg });
  } catch (error) { console.error('CreatePoll error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const getPollResults = (req: AuthRequest, res: Response) => {
  try {
    const { pollId } = req.params;
    const poll = get('SELECT * FROM chat_polls WHERE id = ?', [pollId]);
    if (!poll) return res.status(404).json({ success: false, error: 'Опрос не найден' });

    const options = query('SELECT * FROM chat_poll_options WHERE pollId = ? ORDER BY position ASC', [pollId]);
    const votes = query('SELECT v.*, u.fullName as userName FROM chat_poll_votes v LEFT JOIN users u ON v.userId = u.id WHERE v.pollId = ?', [pollId]);

    const results = options.map(opt => ({
      ...opt,
      votes: votes.filter(v => v.optionId === opt.id),
      count: votes.filter(v => v.optionId === opt.id).length,
    }));

    res.json({ success: true, data: { poll, results, totalVotes: votes.length } });
  } catch (error) { console.error('GetPollResults error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const votePoll = (req: AuthRequest, res: Response) => {
  try {
    const { pollId } = req.params;
    const { optionId } = req.body;
    const userId = req.user!.id;

    const poll = get('SELECT * FROM chat_polls WHERE id = ?', [pollId]);
    if (!poll) return res.status(404).json({ success: false, error: 'Опрос не найден' });

    const option = get('SELECT id FROM chat_poll_options WHERE id = ? AND pollId = ?', [optionId, pollId]);
    if (!option) return res.status(400).json({ success: false, error: 'Неверный вариант' });

    // Upsert vote (delete existing, insert new)
    run('DELETE FROM chat_poll_votes WHERE pollId = ? AND userId = ?', [pollId, userId]);
    run('INSERT INTO chat_poll_votes (id, pollId, optionId, userId) VALUES (?, ?, ?, ?)', [uuidv4(), pollId, optionId, userId]);

    // Return updated results
    const options = query('SELECT * FROM chat_poll_options WHERE pollId = ? ORDER BY position ASC', [pollId]);
    const votes = query('SELECT * FROM chat_poll_votes WHERE pollId = ?', [pollId]);
    const results = options.map(opt => ({ ...opt, count: votes.filter(v => v.optionId === opt.id).length }));

    // Emit socket
    const msg = get('SELECT conversationId FROM chat_messages WHERE id = ?', [poll.messageId]);
    const io = (req as any).app?.get('io');
    if (io && msg) {
      const payload = { pollId, results };
      if (msg.conversationId === GENERAL_CHAT_ID) io.emit('chat:poll-vote', payload);
      else io.to(`conv:${msg.conversationId}`).emit('chat:poll-vote', payload);
    }

    res.json({ success: true, data: results });
  } catch (error) { console.error('VotePoll error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ── Mute member in group ──

export const muteMember = (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const { until } = req.body;
    const mutedBy = req.user!.id;

    // Check admin
    const membership = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, mutedBy]);
    if (membership?.role !== 'admin' && !isSuperUser(req)) return res.status(403).json({ success: false, error: 'Только админ может мутить' });

    run('DELETE FROM chat_muted WHERE conversationId = ? AND userId = ?', [id, userId]);
    run('INSERT INTO chat_muted (id, conversationId, userId, mutedBy, mutedUntil) VALUES (?, ?, ?, ?, ?)', [uuidv4(), id, userId, mutedBy, until || null]);

    res.json({ success: true });
  } catch (error) { console.error('MuteMember error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const unmuteMember = (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const membership = get('SELECT role FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, req.user!.id]);
    if (membership?.role !== 'admin' && !isSuperUser(req)) return res.status(403).json({ success: false, error: 'Только админ может размутить' });
    run('DELETE FROM chat_muted WHERE conversationId = ? AND userId = ?', [id, userId]);
    res.json({ success: true });
  } catch (error) { console.error('UnmuteMember error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ── Mute conversation notifications ──

export const muteConversation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { until } = req.body;
    const userId = req.user!.id;

    run('DELETE FROM chat_user_mutes WHERE conversationId = ? AND userId = ?', [id, userId]);
    run('INSERT INTO chat_user_mutes (id, conversationId, userId, until) VALUES (?, ?, ?, ?)', [uuidv4(), id, userId, until || null]);

    res.json({ success: true });
  } catch (error) { console.error('MuteConversation error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const unmuteConversation = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    run('DELETE FROM chat_user_mutes WHERE conversationId = ? AND userId = ?', [id, userId]);
    res.json({ success: true });
  } catch (error) { console.error('UnmuteConversation error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};
