// =============================================================
// server.js — Express API server + Baileys WhatsApp bot startup
//
// This file does two things in parallel:
//   1. Starts an Express REST API for the React dashboard
//   2. Initializes the Baileys WhatsApp connection (QR code login)
//
// On first run, Baileys will print a QR code to your terminal.
// Scan it with your WhatsApp account (Settings → Linked Devices).
// After that, the session is saved in SESSION_DIR so you won't
// need to scan again unless you delete that folder.
// =============================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// --- Internal modules ---
import { initDB, query } from './db.js';
import { handleIncomingMessage } from './botLogic.js';
import { INVOICE_DIR } from './pdfGenerator.js';
import ordersRouter from './routes/orders.js';
import productsRouter from './routes/products.js';
import invoicesRouter from './routes/invoices.js';
import conversationsRouter from './routes/conversations.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// =============================================================
// Express setup
// =============================================================
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Serve generated PDF invoices as static files
// e.g. GET /invoices/INV-1720000000000-42.pdf
app.use('/invoices', express.static(INVOICE_DIR));

// --- API routes ---
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/conversations', conversationsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard summary stats (used by the React dashboard home page)
app.get('/api/stats', async (req, res) => {
  try {
    const [ordersRes, revenueRes, productsRes, usersRes] = await Promise.all([
      query(`SELECT COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid
             FROM orders`),
      query(`SELECT COALESCE(SUM(total), 0) as total_revenue FROM orders WHERE status = 'paid'`),
      query(`SELECT COUNT(*) as total FROM products WHERE active = TRUE`),
      query(`SELECT COUNT(*) as total FROM users`),
    ]);

    res.json({
      orders: ordersRes.rows[0],
      revenue: revenueRes.rows[0].total_revenue,
      products: productsRes.rows[0].total,
      users: usersRes.rows[0].total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revenue chart data for the last 7 days
app.get('/api/stats/revenue-chart', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(total), 0) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================
// Seed products from products.json on first run
// Only inserts if the products table is empty.
// =============================================================
async function seedProducts() {
  const { rows } = await query('SELECT COUNT(*) as count FROM products');
  if (parseInt(rows[0].count, 10) > 0) return; // already seeded

  const { default: products } = await import('./products.json', { assert: { type: 'json' } });

  for (const p of products) {
    await query(
      `INSERT INTO products (name, description, price, stock, category, sku)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (sku) DO NOTHING`,
      [p.name, p.description, p.price, p.stock, p.category, p.sku]
    );
  }
  console.log(`🌱 Seeded ${products.length} products from products.json`);
}

// =============================================================
// Baileys WhatsApp bot initialization
//
// Baileys uses a "state" object to persist auth credentials
// across restarts. We load/save it from SESSION_DIR.
// The makeWASocket function returns a socket with event emitters.
// =============================================================
async function startWhatsAppBot() {
  // Baileys is a CommonJS-compatible ESM package — dynamic import
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } =
    await import('@whiskeysockets/baileys');

  const SESSION_DIR = process.env.SESSION_DIR || './sessions';
  if (!existsSync(SESSION_DIR)) mkdirSync(SESSION_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,   // Prints QR to terminal on first run
    logger: { level: 'silent' }, // Suppress Baileys debug logs
  });

  // Save updated credentials whenever they change
  sock.ev.on('creds.update', saveCreds);

  // Handle connection state changes
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Scan the QR code above with WhatsApp (Settings → Linked Devices)\n');
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp bot connected!');
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log('🔌 WhatsApp connection closed. Reconnect:', shouldReconnect);

      if (shouldReconnect) {
        // Wait 5 seconds before reconnecting to avoid hammering the server
        setTimeout(() => startWhatsAppBot(), 5000);
      }
    }
  });

  // Handle all incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return; // 'notify' = new messages, not history sync

    for (const msg of messages) {
      await handleIncomingMessage(sock, msg);
    }
  });

  return sock;
}

// =============================================================
// Main startup sequence
// =============================================================
async function main() {
  try {
    // 1. Initialize and verify the database schema
    await initDB();

    // 2. Seed product catalog if empty
    await seedProducts();

    // 3. Start the Express API server
    app.listen(PORT, () => {
      console.log(`🚀 API server running at http://localhost:${PORT}`);
    });

    // 4. Start the WhatsApp bot
    await startWhatsAppBot();
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
}

main();
