// =============================================================
// db.js — Neon Postgres connection pool + schema initialization
//
// Neon uses the standard `pg` driver over SSL. We export both
// the pool (for raw queries) and an initDB() function that
// creates all tables if they don't already exist, so you can
// safely call it on every server startup.
// =============================================================

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Single connection pool shared across the entire app.
// Neon requires SSL; rejectUnauthorized: false is safe for Neon's
// managed certificates but you can tighten this in production.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,                  // max concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Helper: run a query and automatically release the connection
export async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// =============================================================
// Schema — called once on server startup
// All CREATE TABLE statements are idempotent (IF NOT EXISTS).
// =============================================================
export async function initDB() {
  const client = await pool.connect();
  try {
    // Users: one row per WhatsApp phone number
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           SERIAL PRIMARY KEY,
        phone        VARCHAR(30) UNIQUE NOT NULL,
        name         VARCHAR(100),
        created_at   TIMESTAMP DEFAULT NOW()
      );
    `);

    // Conversations: one per user — tracks AI memory summary
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
        summary     TEXT,           -- AI-generated rolling summary of old messages
        updated_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)             -- one active conversation per user
      );
    `);

    // Messages: individual chat turns stored for AI context
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id               SERIAL PRIMARY KEY,
        conversation_id  INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        role             VARCHAR(15) NOT NULL CHECK (role IN ('user','assistant','system')),
        content          TEXT NOT NULL,
        created_at       TIMESTAMP DEFAULT NOW()
      );
    `);

    // Products: the catalog the AI references when answering questions
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(100) NOT NULL,
        description  TEXT,
        price        NUMERIC(10,2) NOT NULL,
        stock        INTEGER DEFAULT 0,
        category     VARCHAR(50),
        sku          VARCHAR(50) UNIQUE,
        active       BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMP DEFAULT NOW()
      );
    `);

    // Orders: one order per conversation checkout
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        status      VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','paid','cancelled')),
        total       NUMERIC(10,2),
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    // Order items: line items for each order
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id          SERIAL PRIMARY KEY,
        order_id    INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id  INTEGER REFERENCES products(id),
        quantity    INTEGER NOT NULL CHECK (quantity > 0),
        unit_price  NUMERIC(10,2) NOT NULL
      );
    `);

    // Invoices: generated PDFs linked to orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id              SERIAL PRIMARY KEY,
        order_id        INTEGER REFERENCES orders(id),
        invoice_number  VARCHAR(50) UNIQUE NOT NULL,
        pdf_url         TEXT,
        total           NUMERIC(10,2),
        issued_at       TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Database schema ready');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}
