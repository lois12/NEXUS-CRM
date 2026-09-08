import { Router } from 'express';
import { getConversations, getOrCreateConversation, createGroup, updateGroup, addGroupMember, removeGroupMember, getGroupMembers, joinByInvite, getMessages, sendMessage, editMessage, deleteMessage, addReaction, removeReaction, pinMessage, unpinMessage, getPinnedMessages, getReadReceipts, setTyping, getTyping, uploadChatFile, markConversationRead, getChatUnreadCount } from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
router.use(authenticateToken);

// Conversations
router.get('/conversations', getConversations);
router.post('/conversations', getOrCreateConversation);

// Groups
router.post('/groups', createGroup);
router.put('/groups/:id', updateGroup);
router.get('/groups/:id/members', getGroupMembers);
router.post('/groups/:id/members', addGroupMember);
router.delete('/groups/:id/members/:userId', removeGroupMember);
router.post('/invite/:link', joinByInvite);

// Messages
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.put('/messages/:id', editMessage);
router.delete('/messages/:id', deleteMessage);

// Reactions
router.post('/messages/:id/reactions', addReaction);
router.delete('/messages/:id/reactions', removeReaction);

// Pinned
router.post('/messages/:id/pin', pinMessage);
router.delete('/messages/:id/pin', unpinMessage);
router.get('/conversations/:id/pinned', getPinnedMessages);

// Read receipts
router.get('/conversations/:id/reads', getReadReceipts);

// Typing
router.post('/conversations/:id/typing', setTyping);
router.get('/conversations/:id/typing', getTyping);

// Upload / Read / Unread
router.post('/conversations/:id/upload', upload.single('file'), uploadChatFile);
router.put('/conversations/:id/read', markConversationRead);
router.get('/unread-count', getChatUnreadCount);

export default router;
