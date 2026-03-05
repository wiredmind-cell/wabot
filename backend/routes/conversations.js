// =============================================================
// routes/conversations.js — REST endpoints for chat history
//
// GET /api/conversations                    — list all conversations
// GET /api/conversations/:id/messages       — get messages for a conversation
// GET /api/conversations/user/:phone        — find conversation by phone number
// DELETE /api/conversations/:id/messages    — clear chat history (keeps summary)
// =============================================================

import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// --- GET /api/conversations ---
// Returns a list of all conversations sorted by most recently active,
// joined with the user's phone number.
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { rows } = await query(
      `SELECT
         c.*,
         u.phone as user_phone,
         u.name as user_name,
         u.created_at as user_joined,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
         (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM conversations c
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY c.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/conversations/:id/messages ---
// Returns paginated messages for a specific conversation in chronological order.
router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const { rows } = await query(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    // Also include the summary so the dashboard can display context
    const convRes = await query(
      'SELECT summary FROM conversations WHERE id = $1',
      [id]
    );

    res.json({
      messages: rows,
      summary: convRes.rows[0]?.summary || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/conversations/user/:phone ---
// Looks up a conversation by the user's phone number.
// Useful for the admin "search by phone" feature on the dashboard.
router.get('/user/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { rows } = await query(
      `SELECT c.*, u.phone as user_phone, u.name as user_name
       FROM conversations c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE u.phone = $1`,
      [phone]
    );

    if (!rows[0]) return res.status(404).json({ error: 'No conversation found for this phone number' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE /api/conversations/:id/messages ---
// Clears the message history for a conversation without deleting the
// conversation record itself or the AI summary. This gives the bot
// a "fresh start" with a user while preserving the summary context.
router.delete('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await query(
      'DELETE FROM messages WHERE conversation_id = $1',
      [id]
    );
    res.json({ message: `Deleted ${rowCount} messages from conversation ${id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
