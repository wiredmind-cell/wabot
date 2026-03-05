// =============================================================
// routes/invoices.js — REST endpoints for invoice management
//
// GET /api/invoices                      — list all invoices
// GET /api/invoices/:id                  — single invoice details
// GET /api/invoices/download/:number     — stream the PDF file
// POST /api/invoices/generate/:orderId   — manually trigger PDF generation
// =============================================================

import { Router } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { query } from '../db.js';
import { generateInvoicePDF, INVOICE_DIR } from '../pdfGenerator.js';

const router = Router();

// --- GET /api/invoices ---
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { rows } = await query(
      `SELECT i.*, o.status as order_status, u.phone as user_phone, u.name as user_name
       FROM invoices i
       LEFT JOIN orders o ON o.id = i.order_id
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY i.issued_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/invoices/:id ---
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.*, o.status as order_status, o.notes,
              u.phone as user_phone, u.name as user_name
       FROM invoices i
       LEFT JOIN orders o ON o.id = i.order_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Invoice not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/invoices/download/:number ---
// Streams the PDF file from disk to the client.
// The invoice number (e.g. INV-1720000000000-42) is the filename without .pdf
router.get('/download/:number', (req, res) => {
  const filename = `${req.params.number}.pdf`;
  const filePath = join(INVOICE_DIR, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Invoice PDF not found on disk' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  createReadStream(filePath).pipe(res);
});

// --- POST /api/invoices/generate/:orderId ---
// Manually regenerate (or generate for the first time) a PDF invoice
// for a given order. Useful when triggering from the admin dashboard.
router.post('/generate/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Load order data
    const orderRes = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!orderRes.rows[0]) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    const itemsRes = await query(
      `SELECT oi.quantity, oi.unit_price, p.name as product_name, oi.product_id
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    const userRes = await query('SELECT * FROM users WHERE id = $1', [order.user_id]);
    const user = userRes.rows[0] || { phone: 'N/A' };

    const invoiceNumber = `INV-${Date.now()}-${orderId}`;
    const pdfPath = await generateInvoicePDF({
      order,
      items: itemsRes.rows,
      invoiceNumber,
      user,
    });

    // Upsert the invoice record
    const { rows } = await query(
      `INSERT INTO invoices (order_id, invoice_number, pdf_url, total)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (invoice_number) DO UPDATE
         SET pdf_url = EXCLUDED.pdf_url, issued_at = NOW()
       RETURNING *`,
      [orderId, invoiceNumber, `/api/invoices/download/${invoiceNumber}`, order.total]
    );

    res.json({ invoice: rows[0], pdfPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
