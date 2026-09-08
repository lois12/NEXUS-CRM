import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, run, get } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { createNotification, createNotificationsBatch } from './notificationController';
import { sendPushNotification, sendPushBatch } from '../utils/push';

const GENERAL_CHAT_ID = 'general';

// ─── Conversations ─────────────────────────────────────────────

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
        (SELECT COUNT(*) FROM chat_messages m WHERE m.conversationId = c.id AND m.senderId != ? AND m.isRead = 0 AND m.deleted = 0) as unreadCount
      FROM chat_conversations c
      LEFT JOIN users u1 ON c.user1Id = u1.id
      LEFT JOIN users u2 ON c.user2Id = u2.id
      WHERE (c.user1Id = ? OR c.user2Id = ?) AND c.type = 'private'
      ORDER BY c.lastMessageAt DESC
    `, [userId, userId, userId, userId, userId, userId, userId, userId]);

    const groupConvs = query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.conversationId = c.id AND m.senderId != ? AND m.isRead = 0 AND m.deleted = 0) as unreadCount,
        (SELECT COUNT(*) FROM chat_group_members gm WHERE gm.conversationId = c.id) as memberCount
      FROM chat_conversations c
      JOIN chat_group_members gm ON c.id = gm.conversationId AND gm.userId = ?
      WHERE c.type = 'group'
      ORDER BY c.lastMessageAt DESC
    `, [userId, userId]);

    const generalLast = get(`SELECT content, createdAt FROM chat_messages WHERE conversationId = ? AND deleted = 0 ORDER BY createdAt DESC LIMIT 1`, [GENERAL_CHAT_ID]);
    const generalUnread = get(`SELECT COUNT(*) as count FROM chat_messages WHERE conversationId = ? AND senderId != ? AND isRead = 0 AND deleted = 0`, [GENERAL_CHAT_ID, userId]);

    const generalConv = {
      id: GENERAL_CHAT_ID, type: 'general', name: 'Общий чат', avatar: '', description: '', inviteLink: '',
      user1Id: '', user2Id: '', otherName: 'Общий чат', otherAvatar: null,
      otherPosition: 'Все сотрудники', otherId: null,
      lastMessageAt: generalLast?.createdAt || null,
      lastMessagePreview: generalLast?.content?.substring(0, 100) || 'Нет сообщений',
      unreadCount: generalUnread?.count || 0, isGeneral: true, createdAt: '',
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
    run('INSERT INTO chat_conversations (id, type, name, user1Id, user2Id, inviteLink) VALUES (?, ?, ?, ?, ?, ?)', [id, 'group', name, userId, userId, inviteLink]);
    run('INSERT INTO chat_group_members (id, conversationId, userId, role) VALUES (?, ?, ?, ?)', [uuidv4(), id, userId, 'admin']);

    const uniqueMembers = [...new Set(memberIds)].filter(uid => uid !== userId);
    for (const uid of uniqueMembers) {
      run('INSERT INTO chat_group_members (id, conversationId, userId) VALUES (?, ?, ?)', [uuidv4(), id, uid]);
      createNotification({ userId: uid, type: 'chat_message', title: `Добавлены в группу "${name}"`, body: `${req.user!.username} добавил вас`, link: `/chat?conv=${id}`, senderId: userId });
    }

    const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: conv });
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
    const existing = get('SELECT * FROM chat_group_members WHERE conversationId = ? AND userId = ?', [id, newMemberId]);
    if (existing) return res.status(400).json({ success: false, error: 'Уже в группе' });
    run('INSERT INTO chat_group_members (id, conversationId, userId) VALUES (?, ?, ?)', [uuidv4(), id, newMemberId]);
    res.json({ success: true });
  } catch (error) { console.error('AddGroupMember error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const removeGroupMember = (req: AuthRequest, res: Response) => {
  try {
    run('DELETE FROM chat_group_members WHERE conversationId = ? AND userId = ?', [req.params.id, req.params.userId]);
    res.json({ success: true });
  } catch (error) { console.error('RemoveGroupMember error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
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
    if (existing) return res.json({ success: true, data: conv });
    run('INSERT INTO chat_group_members (id, conversationId, userId) VALUES (?, ?, ?)', [uuidv4(), conv.id, req.user!.id]);
    res.json({ success: true, data: conv });
  } catch (error) { console.error('JoinByInvite error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ─── Messages ──────────────────────────────────────────────────

export const getMessages = (req: AuthRequest, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user?.id;
    const after = req.query.after as string;
    const limit = parseInt(req.query.limit as string) || 50;

    // Verify user is a member of this conversation
    const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
    if (!conv) return res.status(404).json({ success: false, error: 'Чат не найден' });

    if (conv.type !== 'general') {
      const isMember = conv.user1Id === userId || conv.user2Id === userId ||
        (conv.type === 'group' && !!get('SELECT 1 FROM chat_group_members WHERE conversationId = ? AND userId = ?', [conversationId, userId]));
      if (!isMember) return res.status(403).json({ success: false, error: 'Нет доступа' });
    }

    let sql = `SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition
               FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id
               WHERE m.conversationId = ? AND m.deleted = 0`;
    const params: any[] = [conversationId];
    if (after) { sql += ' AND m.createdAt > ?'; params.push(after); }
    sql += ' ORDER BY m.createdAt ASC LIMIT ?';
    params.push(limit);

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

    if (!isGeneral) {
      const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
      if (!conv) return res.status(404).json({ success: false, error: 'Диалог не найден' });
      if (conv.type === 'private' && conv.user1Id !== senderId && conv.user2Id !== senderId) return res.status(403).json({ success: false, error: 'Нет доступа' });
      if (conv.type === 'group' && !get('SELECT id FROM chat_group_members WHERE conversationId = ? AND userId = ?', [conversationId, senderId])) return res.status(403).json({ success: false, error: 'Нет доступа к группе' });
    }

    let replyToContent = '', replyToSenderName = '';
    if (replyToId) {
      const replyMsg = get('SELECT m.content, u.fullName FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?', [replyToId]);
      if (replyMsg) { replyToContent = (replyMsg.content || '').substring(0, 200); replyToSenderName = replyMsg.fullName || ''; }
    }

    const msgId = uuidv4();
    run(`INSERT INTO chat_messages (id, conversationId, senderId, type, content, replyToId, replyToContent, replyToSenderName, mentionedUserIds, forwardedFrom, caption)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msgId, conversationId, senderId, type, content, replyToId || null, replyToContent, replyToSenderName, mentionedUserIds || '', forwardedFrom || '', caption || '']);

    const preview = type === 'text' ? content.substring(0, 100) : (caption ? caption.substring(0, 100) : `[${type}]`);
    if (!isGeneral) run("UPDATE chat_conversations SET lastMessageAt = datetime('now'), lastMessagePreview = ? WHERE id = ?", [preview, conversationId]);

    const sender = get('SELECT fullName FROM users WHERE id = ?', [senderId]);

    // Send socket message FIRST (don't block on notifications)
    const io = req.app.get('io');
    if (io && !isGeneral) {
      const fullMsg = get(`SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?`, [msgId]);
      io.to(`conv:${conversationId}`).emit('chat:message', fullMsg);
    }

    res.json({ success: true, data: get(`SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?`, [msgId]) });

    // Notifications — fire and forget (don't block response)
    try {
      if (isGeneral) {
      const allUsers = query('SELECT id FROM users WHERE id != ?', [senderId]);
      const batch = allUsers.map((u: any) => ({ userId: u.id, type: 'chat_message', title: `Общий чат: ${sender?.fullName}`, body: preview, link: `/chat?conv=general`, relatedId: msgId, senderId }));
      createNotificationsBatch(batch);
      sendPushBatch(allUsers.map((u: any) => u.id), { title: `Общий чат: ${sender?.fullName}`, body: preview, tag: 'nexus-chat-general', link: `/chat?conv=general` }).catch(() => {});
    } else {
      const conv = get('SELECT * FROM chat_conversations WHERE id = ?', [conversationId]);
      if (conv.type === 'private') {
        const recipientId = conv.user1Id === senderId ? conv.user2Id : conv.user1Id;
        createNotification({ userId: recipientId, type: 'chat_message', title: `Сообщение от ${sender?.fullName}`, body: preview, link: `/chat?conv=${conversationId}`, relatedId: msgId, senderId });
        sendPushNotification(recipientId, { title: `Сообщение от ${sender?.fullName}`, body: preview, tag: `nexus-chat-${conversationId}`, link: `/chat?conv=${conversationId}` }).catch(() => {});
      } else if (conv.type === 'group') {
        const members = query('SELECT userId FROM chat_group_members WHERE conversationId = ? AND userId != ?', [conversationId, senderId]);
        const batch = members.map((m: any) => ({ userId: m.userId, type: 'chat_message', title: `${conv.name}: ${sender?.fullName}`, body: preview, link: `/chat?conv=${conversationId}`, relatedId: msgId, senderId }));
        createNotificationsBatch(batch);
        sendPushBatch(members.map((m: any) => m.userId), { title: `${conv.name}: ${sender?.fullName}`, body: preview, tag: `nexus-chat-${conversationId}`, link: `/chat?conv=${conversationId}` }).catch(() => {});
      }
    }

    if (mentionedUserIds) {
      const ids = mentionedUserIds.split(',').filter((id: string) => id && id !== senderId);
      ids.forEach((uid: string) => createNotification({ userId: uid.trim(), type: 'mention', title: `Вас упомянули`, body: preview, link: `/chat?conv=${conversationId}`, relatedId: msgId, senderId }));
    }

    // Emit general chat to all
    if (isGeneral && io) {
      const fullMsg = get(`SELECT m.*, u.fullName as senderName, u.avatar as senderAvatar, u.position as senderPosition FROM chat_messages m LEFT JOIN users u ON m.senderId = u.id WHERE m.id = ?`, [msgId]);
      io.emit('chat:message', fullMsg);
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
    if (io) io.to(`conv:${msg.conversationId}`).emit('chat:message-edit', { id, content, editedAt: updated.editedAt });
  } catch (error) { console.error('EditMessage error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

export const deleteMessage = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const msg = get('SELECT * FROM chat_messages WHERE id = ?', [id]);
    if (!msg) return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    if (msg.senderId !== req.user!.id && !(req.user!.roles || [req.user!.role]).includes('super_admin')) return res.status(403).json({ success: false, error: 'Нет прав' });
    run('UPDATE chat_messages SET deleted = 1 WHERE id = ?', [id]);
    // Update conversation preview
    const lastMsg = get('SELECT content FROM chat_messages WHERE conversationId = ? AND deleted = 0 ORDER BY createdAt DESC LIMIT 1', [msg.conversationId]);
    run("UPDATE chat_conversations SET lastMessagePreview = ? WHERE id = ?", [lastMsg ? lastMsg.content.substring(0, 100) : '', msg.conversationId]);
    res.json({ success: true });
    const io = req.app.get('io');
    if (io) io.to(`conv:${msg.conversationId}`).emit('chat:message-delete', { id });
  } catch (error) { console.error('DeleteMessage error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ─── Reactions ─────────────────────────────────────────────────

export const addReaction = (req: AuthRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user!.id;
    // Remove existing reaction from this user on this message
    run('DELETE FROM chat_reactions WHERE messageId = ? AND userId = ?', [messageId, userId]);
    run('INSERT INTO chat_reactions (id, messageId, userId, emoji) VALUES (?, ?, ?, ?)', [uuidv4(), messageId, userId, emoji]);
    const reactions = query('SELECT r.*, u.fullName as userName FROM chat_reactions r LEFT JOIN users u ON r.userId = u.id WHERE r.messageId = ?', [messageId]);
    res.json({ success: true, data: reactions });
    const convRow = get('SELECT conversationId FROM chat_messages WHERE id = ?', [messageId]);
    const io = req.app.get('io');
    if (io && convRow) io.to(`conv:${convRow.conversationId}`).emit('chat:reaction', { messageId, reactions });
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
    if (io && convRow) io.to(`conv:${convRow.conversationId}`).emit('chat:reaction', { messageId, reactions });
  } catch (error) { console.error('RemoveReaction error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};

// ─── Pinned ────────────────────────────────────────────────────

export const pinMessage = (req: AuthRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    const msg = get('SELECT * FROM chat_messages WHERE id = ?', [messageId]);
    if (!msg) return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
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
    run('UPDATE chat_messages SET isRead = 1 WHERE conversationId = ? AND senderId != ? AND isRead = 0 AND deleted = 0', [convId, userId]);
    // Upsert read receipt
    const existing = get('SELECT * FROM chat_reads WHERE conversationId = ? AND userId = ?', [convId, userId]);
    if (existing) run("UPDATE chat_reads SET lastReadAt = datetime('now') WHERE conversationId = ? AND userId = ?", [convId, userId]);
    else run("INSERT INTO chat_reads (id, conversationId, userId, lastReadAt) VALUES (?, ?, ?, datetime('now'))", [uuidv4(), convId, userId]);
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
  if (io) io.to(`conv:${conversationId}`).emit('chat:typing', { userId: req.user!.id, name: user?.fullName || req.user!.username });
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
    const privateUnread = get(`SELECT COUNT(*) as count FROM chat_messages m JOIN chat_conversations c ON m.conversationId = c.id WHERE (c.user1Id = ? OR c.user2Id = ?) AND c.type = 'private' AND m.senderId != ? AND m.isRead = 0 AND m.deleted = 0`, [userId, userId, userId]);
    const groupUnread = get(`SELECT COUNT(*) as count FROM chat_messages m JOIN chat_conversations c ON m.conversationId = c.id JOIN chat_group_members gm ON c.id = gm.conversationId AND gm.userId = ? WHERE c.type = 'group' AND m.senderId != ? AND m.isRead = 0 AND m.deleted = 0`, [userId, userId]);
    const generalUnread = get(`SELECT COUNT(*) as count FROM chat_messages WHERE conversationId = ? AND senderId != ? AND isRead = 0 AND deleted = 0`, [GENERAL_CHAT_ID, userId]);
    res.json({ success: true, data: { count: (privateUnread?.count || 0) + (groupUnread?.count || 0) + (generalUnread?.count || 0) } });
  } catch (error) { console.error('GetChatUnreadCount error:', error); res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
};
