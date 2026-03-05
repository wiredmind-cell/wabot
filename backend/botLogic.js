// =============================================================
// botLogic.js — WhatsApp message processing pipeline
//
// This is the brain of the bot. For every incoming WhatsApp message:
//   1. Identify or create the user in the DB (by phone number)
//   2. Get or create their conversation record
//   3. Load the last 10 messages (and summary for older context)
//   4. Call the AI, get a reply or an order action
//   5. If it's an order action → create order in DB + generate invoice
//   6. Save the assistant's reply to the DB
//   7. Send the reply back via Baileys
// =============================================================

import { query } from './db.js';
import { getAIResponse, summarizeMessages } from './ai.js';
import { generateInvoicePDF } from './pdfGenerator.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));

// How many recent messages to feed into the AI context window.
// Older messages are compressed into a rolling summary.
const CONTEXT_WINDOW = 10;

// =============================================================
// handleIncomingMessage — entry point called by server.js
//
// @param sock   Baileys socket (used to send replies)
// @param msg    Baileys message object
// =============================================================
export async function handleIncomingMessage(sock, msg) {
  // Ignore messages sent by ourselves (echo prevention)
  if (msg.key.fromMe) return;

  // Extract phone number (strip the "@s.whatsapp.net" suffix)
  const jid = msg.key.remoteJid;
  if (!jid || jid.endsWith('@g.us')) return; // skip group messages for now

  const phone = jid.split('@')[0];

  // Extract text content from the message
  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    null;

  if (!text) return; // ignore non-text messages (stickers, audio, etc.)

  console.log(`📩 Message from ${phone}: ${text}`);

  try {
    // --- Step 1: Upsert user ---
    const user = await getOrCreateUser(phone);

    // --- Step 2: Upsert conversation ---
    const conversation = await getOrCreateConversation(user.id);

    // --- Step 3: Save incoming user message ---
    await saveMessage(conversation.id, 'user', text);

    // --- Step 4: Load recent messages + summary for AI context ---
    const recentMessages = await getRecentMessages(conversation.id, CONTEXT_WINDOW);
    const products = await getActiveProducts();

    // Check if we need to summarize older messages
    const totalCount = await getMessageCount(conversation.id);
    if (totalCount > CONTEXT_WINDOW + 5) {
      await maybeUpdateSummary(conversation.id, conversation.summary);
    }

    // --- Step 5: Call AI ---
    const { text: aiReply, action } = await getAIResponse(
      recentMessages,
      products,
      conversation.summary
    );

    // --- Step 6: If AI returned an order action, process it ---
    let replyText = aiReply;
    if (action?.action === 'create_order') {
      try {
        replyText = await processOrderAction(action, user, phone, sock);
      } catch (orderErr) {
        console.error('Order processing error:', orderErr.message);
        replyText = 'Sorry, there was a problem creating your order. Please try again.';
      }
    }

    // --- Step 7: Save AI reply and send it ---
    await saveMessage(conversation.id, 'assistant', replyText);
    await sendWhatsAppMessage(sock, jid, replyText);

    console.log(`📤 Reply to ${phone}: ${replyText.substring(0, 80)}...`);
  } catch (err) {
    console.error(`❌ Error handling message from ${phone}:`, err.message);
    await sendWhatsAppMessage(
      sock,
      jid,
      "I'm sorry, something went wrong on our end. Please try again in a moment."
    );
  }
}

// =============================================================
// processOrderAction
// Called when the AI determines the customer wants to place an order.
// Creates the order + items in DB, generates a PDF invoice, and
// returns a formatted confirmation message.
// =============================================================
async function processOrderAction(action, user, phone, sock) {
  const items = action.items;
  if (!items || items.length === 0) {
    return "I couldn't process your order because no items were specified. Could you clarify what you'd like?";
  }

  // Validate stock before creating the order
  for (const item of items) {
    const { rows } = await query(
      'SELECT stock, name FROM products WHERE id = $1 AND active = TRUE',
      [item.product_id]
    );
    if (!rows[0]) return `Sorry, product "${item.product_name}" is not available.`;
    if (rows[0].stock < item.quantity) {
      return `Sorry, we only have ${rows[0].stock} units of "${rows[0].name}" in stock. Would you like to adjust your order?`;
    }
  }

  // Calculate total
  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  // Insert order
  const orderRes = await query(
    `INSERT INTO orders (user_id, status, total, notes)
     VALUES ($1, 'confirmed', $2, $3) RETURNING *`,
    [user.id, total.toFixed(2), `WhatsApp order from ${phone}`]
  );
  const order = orderRes.rows[0];

  // Insert order items and decrement stock
  for (const item of items) {
    await query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       VALUES ($1, $2, $3, $4)`,
      [order.id, item.product_id, item.quantity, item.unit_price]
    );
    await query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2',
      [item.quantity, item.product_id]
    );
  }

  // Generate PDF invoice
  const invoiceNumber = `INV-${Date.now()}-${order.id}`;
  const pdfPath = await generateInvoicePDF({
    order,
    items,
    invoiceNumber,
    user,
  });

  // Save invoice record
  const invoiceUrl = `/api/invoices/download/${invoiceNumber}`;
  await query(
    `INSERT INTO invoices (order_id, invoice_number, pdf_url, total)
     VALUES ($1, $2, $3, $4)`,
    [order.id, invoiceNumber, invoiceUrl, total.toFixed(2)]
  );

  // Build confirmation message
  const itemLines = items
    .map(i => `• ${i.product_name} x${i.quantity} — $${(i.unit_price * i.quantity).toFixed(2)}`)
    .join('\n');

  const paymentMsg = process.env.PAYMENT_LINK
    ? `\n\n💳 *Pay here:* ${process.env.PAYMENT_LINK}`
    : '';

  return (
    `✅ *Order Confirmed!* (${invoiceNumber})\n\n` +
    `${itemLines}\n\n` +
    `*Total: $${total.toFixed(2)}*` +
    paymentMsg +
    `\n\nYour invoice has been generated. Type "invoice" to receive it.`
  );
}

// =============================================================
// DB helpers
// =============================================================

async function getOrCreateUser(phone) {
  const { rows } = await query(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING *`,
    [phone]
  );
  return rows[0];
}

async function getOrCreateConversation(userId) {
  const { rows } = await query(
    `INSERT INTO conversations (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [userId]
  );
  return rows[0];
}

async function saveMessage(conversationId, role, content) {
  await query(
    `INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
    [conversationId, role, content]
  );
}

async function getRecentMessages(conversationId, limit) {
  const { rows } = await query(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );
  // Reverse so oldest is first (chronological order for AI context)
  return rows.reverse().map(r => ({ role: r.role, content: r.content }));
}

async function getMessageCount(conversationId) {
  const { rows } = await query(
    'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
    [conversationId]
  );
  return parseInt(rows[0].count, 10);
}

async function getActiveProducts() {
  const { rows } = await query(
    'SELECT * FROM products WHERE active = TRUE ORDER BY category, name'
  );
  return rows;
}

// Summarize messages that fall outside the context window and
// store the result in conversations.summary to save tokens.
async function maybeUpdateSummary(conversationId, existingSummary) {
  // Get all messages OLDER than the last CONTEXT_WINDOW messages
  const { rows: oldMessages } = await query(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT 100 OFFSET 0`,
    [conversationId]
  );

  const toSummarize = oldMessages.slice(0, Math.max(0, oldMessages.length - CONTEXT_WINDOW));
  if (toSummarize.length < 5) return; // not enough to summarize yet

  const summary = await summarizeMessages(toSummarize);
  await query(
    `UPDATE conversations SET summary = $1, updated_at = NOW()
     WHERE id = $2`,
    [summary, conversationId]
  );
}

// =============================================================
// sendWhatsAppMessage — thin wrapper around Baileys sock.sendMessage
// =============================================================
async function sendWhatsAppMessage(sock, jid, text) {
  try {
    await sock.sendMessage(jid, { text });
  } catch (err) {
    console.error(`Failed to send WhatsApp message to ${jid}:`, err.message);
  }
}
