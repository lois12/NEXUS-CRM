import { Router } from 'express';
import { getConversations, getOrCreateConversation, createGroup, updateGroup, addGroupMember, removeGroupMember, getGroupMembers, joinByInvite, getMessages, sendMessage, editMessage, deleteMessage, addReaction, removeReaction, pinMessage, unpinMessage, getPinnedMessages, getReadReceipts, setTyping, getTyping, uploadChatFile, markConversationRead, getChatUnreadCount, archiveConversation, unarchiveConversation, pinConversation, unpinConversation, addFavorite, removeFavorite, getFavorites, createPoll, getPollResults, votePoll, muteMember, unmuteMember, muteConversation, unmuteConversation } from '../controllers/chatController';
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

// Pinned messages
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

// Archive
router.put('/conversations/:id/archive', archiveConversation);
router.delete('/conversations/:id/archive', unarchiveConversation);

// Pin conversation
router.put('/conversations/:id/pin-conv', pinConversation);
router.delete('/conversations/:id/pin-conv', unpinConversation);

// Favorites
router.post('/messages/:id/favorite', addFavorite);
router.delete('/messages/:id/favorite', removeFavorite);
router.get('/conversations/:id/favorites', getFavorites);

// Polls
router.post('/conversations/:id/polls', createPoll);
router.get('/polls/:pollId', getPollResults);
router.post('/polls/:pollId/vote', votePoll);

// Mute member in group
router.post('/groups/:id/mute/:userId', muteMember);
router.delete('/groups/:id/mute/:userId', unmuteMember);

// Mute conversation notifications
router.put('/conversations/:id/mute', muteConversation);
router.delete('/conversations/:id/mute', unmuteConversation);

export default router;
