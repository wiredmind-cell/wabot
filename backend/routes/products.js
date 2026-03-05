// =============================================================
// routes/products.js — REST endpoints for the product catalog
//
// GET    /api/products       — list all products
// GET    /api/products/:id   — single product
// POST   /api/products       — create a new product
// PUT    /api/products/:id   — update a product
// DELETE /api/products/:id   — soft-delete (sets active = false)
// =============================================================

import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// --- GET /api/products ---
// Supports ?category= filter and ?includeInactive=true for admin views
router.get('/', async (req, res) => {
  try {
    const { category, includeInactive } = req.query;
    const params = [];
    let sql = 'SELECT * FROM products';
    const conditions = [];

    if (!includeInactive) {
      conditions.push('active = TRUE');
    }

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY category, name';

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/products/:id ---
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/products ---
router.post('/', async (req, res) => {
  try {
    const { name, description, price, stock, category, sku } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    const { rows } = await query(
      `INSERT INTO products (name, description, price, stock, category, sku)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description || null, price, stock || 0, category || null, sku || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'SKU already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// --- PUT /api/products/:id ---
router.put('/:id', async (req, res) => {
  try {
    const { name, description, price, stock, category, sku, active } = req.body;
    const { id } = req.params;

    const { rows } = await query(
      `UPDATE products
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           price       = COALESCE($3, price),
           stock       = COALESCE($4, stock),
           category    = COALESCE($5, category),
           sku         = COALESCE($6, sku),
           active      = COALESCE($7, active)
       WHERE id = $8
       RETURNING *`,
      [name, description, price, stock, category, sku, active, id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE /api/products/:id ---
// Soft-delete: sets active = false instead of removing the row.
// This preserves order history integrity.
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      'UPDATE products SET active = FALSE WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: `Product "${rows[0].name}" deactivated`, id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
