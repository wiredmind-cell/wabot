// =============================================================
// routes/orders.js — REST endpoints for order management
//
// GET  /api/orders              — list all orders (with user info)
// GET  /api/orders/:id          — single order with items
// POST /api/orders              — manually create an order (admin)
// PUT  /api/orders/:id/status   — update order status
// =============================================================

import { Router } from 'express';
import { query } from '../db.js';
import { generateInvoicePDF } from '../pdfGenerator.js';

const router = Router();

// --- GET /api/orders ---
// Returns a list of all orders joined with basic user info.
// Supports optional ?status= filter and ?limit= / ?offset= pagination.
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT
        o.*,
        u.phone as user_phone,
        u.name as user_name,
        i.invoice_number,
        i.pdf_url
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN invoices i ON i.order_id = o.id
    `;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` WHERE o.status = $${params.length}`;
    }

    sql += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/orders/:id ---
// Returns a single order plus its line items (with product info).
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const orderRes = await query(
      `SELECT o.*, u.phone as user_phone, u.name as user_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [id]
    );

    if (!orderRes.rows[0]) return res.status(404).json({ error: 'Order not found' });

    const itemsRes = await query(
      `SELECT oi.*, p.name as product_name, p.sku
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id]
    );

    const invoiceRes = await query(
      'SELECT * FROM invoices WHERE order_id = $1',
      [id]
    );

    res.json({
      ...orderRes.rows[0],
      items: itemsRes.rows,
      invoice: invoiceRes.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PUT /api/orders/:id/status ---
// Update the status of an order (pending → confirmed → paid → cancelled).
// When status is set to "paid", automatically generates an invoice if one
// doesn't already exist.
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const allowed = ['pending', 'confirmed', 'paid', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }

    const { rows } = await query(
      `UPDATE orders
       SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, notes, id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Order not found' });

    const order = rows[0];

    // Auto-generate invoice on payment confirmation if not already created
    if (status === 'paid') {
      const existing = await query('SELECT id FROM invoices WHERE order_id = $1', [id]);
      if (!existing.rows[0]) {
        const itemsRes = await query(
          `SELECT oi.quantity, oi.unit_price, p.name as product_name, oi.product_id
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
           WHERE oi.order_id = $1`,
          [id]
        );
        const userRes = await query('SELECT * FROM users WHERE id = $1', [order.user_id]);

        const invoiceNumber = `INV-${Date.now()}-${id}`;
        await generateInvoicePDF({
          order,
          items: itemsRes.rows,
          invoiceNumber,
          user: userRes.rows[0] || { phone: 'N/A' },
        });

        await query(
          `INSERT INTO invoices (order_id, invoice_number, pdf_url, total)
           VALUES ($1, $2, $3, $4)`,
          [id, invoiceNumber, `/api/invoices/download/${invoiceNumber}`, order.total]
        );
      }
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/orders ---
// Manually create an order from the admin dashboard.
router.post('/', async (req, res) => {
  try {
    const { user_phone, items, notes } = req.body;

    if (!user_phone || !items?.length) {
      return res.status(400).json({ error: 'user_phone and items are required' });
    }

    // Get or create user
    const { rows: userRows } = await query(
      `INSERT INTO users (phone) VALUES ($1)
       ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING *`,
      [user_phone]
    );
    const user = userRows[0];

    // Validate products and calculate total
    let total = 0;
    const validatedItems = [];
    for (const item of items) {
      const { rows } = await query('SELECT * FROM products WHERE id = $1 AND active = TRUE', [item.product_id]);
      if (!rows[0]) return res.status(400).json({ error: `Product ID ${item.product_id} not found` });
      const unitPrice = parseFloat(rows[0].price);
      total += unitPrice * item.quantity;
      validatedItems.push({ ...item, unit_price: unitPrice, product_name: rows[0].name });
    }

    const { rows: orderRows } = await query(
      `INSERT INTO orders (user_id, status, total, notes) VALUES ($1, 'confirmed', $2, $3) RETURNING *`,
      [user.id, total.toFixed(2), notes || null]
    );
    const order = orderRows[0];

    for (const item of validatedItems) {
      await query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.unit_price]
      );
    }

    res.status(201).json({ ...order, items: validatedItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
