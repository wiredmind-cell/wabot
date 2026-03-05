// =============================================================
// ai.js — OpenAI integration
//
// Responsibilities:
//   1. Build the system prompt (injecting product catalog + summary)
//   2. Send conversation history to GPT and get a reply
//   3. Parse structured actions from AI replies (e.g. create_order)
//   4. Summarize old message batches to keep the context window lean
//
// The AI is instructed to reply in one of two shapes:
//   a) Plain text — a conversational reply to the customer
//   b) JSON action — when it needs to create an order or invoice
//      e.g. { "action": "create_order", "items": [...] }
// =============================================================

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// The model used for all completions.
// Switch to 'gpt-4o' for better reasoning if budget allows.
const MODEL = 'gpt-4o-mini';

// =============================================================
// buildSystemPrompt
// Constructs the full system instruction given the product list
// and an optional rolling summary of older messages.
// =============================================================
function buildSystemPrompt(products, summary = null) {
  const productList = products
    .filter(p => p.active)
    .map(p =>
      `- [ID:${p.id}] ${p.name} — $${parseFloat(p.price).toFixed(2)} (stock: ${p.stock})${p.description ? ` | ${p.description}` : ''}`
    )
    .join('\n');

  const summaryBlock = summary
    ? `\n\nPREVIOUS CONVERSATION SUMMARY (use this as background context):\n${summary}`
    : '';

  return `You are a helpful, friendly sales assistant for ${process.env.BUSINESS_NAME || 'our store'}.
Your job is to help customers browse products, answer questions, and confirm orders over WhatsApp.

RULES:
1. Only reference products from the catalog below. NEVER invent products, prices, or discounts.
2. Be concise — WhatsApp messages should be short and easy to read. Use line breaks and emojis sparingly.
3. When a customer clearly wants to place an order (they've confirmed items and quantities), respond with a JSON action instead of plain text.
4. JSON action format (respond ONLY with this JSON, nothing else):
   {
     "action": "create_order",
     "items": [
       { "product_id": <number>, "quantity": <number>, "product_name": "<name>", "unit_price": <number> }
     ],
     "message": "<friendly confirmation message to send the customer>"
   }
5. If a product is out of stock (stock = 0), tell the customer it's unavailable and suggest alternatives if any exist.
6. Do not discuss payment processing details — just say an invoice will be sent.
7. Keep replies under 200 words unless the customer asks for detailed info.

PRODUCT CATALOG:
${productList}${summaryBlock}`;
}

// =============================================================
// getAIResponse
// Main function called by botLogic.js for every incoming message.
//
// @param messages   Array of { role, content } — last N messages
// @param products   Array of product rows from DB
// @param summary    Optional string — the rolling conversation summary
// @returns          { text, action } — text is the reply to send,
//                   action is a parsed order object or null
// =============================================================
export async function getAIResponse(messages, products, summary = null) {
  const systemPrompt = buildSystemPrompt(products, summary);

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.6,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });

  const rawContent = response.choices[0]?.message?.content?.trim() || '';

  // Try to parse as a JSON action first.
  // The AI is instructed to reply with raw JSON when creating an order.
  const parsed = tryParseAction(rawContent);

  if (parsed) {
    return { text: parsed.message || 'Order received! Your invoice will follow shortly.', action: parsed };
  }

  // Otherwise it's a plain conversational reply
  return { text: rawContent, action: null };
}

// =============================================================
// summarizeMessages
// Called when the conversation has more than 10 messages.
// Produces a concise summary of the older messages so we can
// compress them into the conversation.summary field in the DB
// and avoid hitting the context window limit.
// =============================================================
export async function summarizeMessages(messages) {
  const transcript = messages
    .map(m => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.content}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 250,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content:
          'You are a conversation summarizer. Given a WhatsApp sales chat transcript, produce a brief factual summary (max 150 words) covering: what products were discussed, any quotes given, and the current stage of the conversation (browsing / negotiating / ready to order / ordered).',
      },
      { role: 'user', content: transcript },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || '';
}

// =============================================================
// tryParseAction (private helper)
// Safely attempts to parse the AI reply as JSON.
// Returns the parsed object if it has an "action" field, else null.
// =============================================================
function tryParseAction(text) {
  // Strip markdown code fences if the model wraps JSON in them
  const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && obj.action) return obj;
    return null;
  } catch {
    return null;
  }
}
