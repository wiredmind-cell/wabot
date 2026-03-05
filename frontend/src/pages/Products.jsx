// =============================================================
// pages/Products.jsx — Product catalog management
//
// Features:
//   • View all products in a filterable grid
//   • Add new products via a slide-in modal
//   • Edit product details inline (price, stock, description)
//   • Soft-delete (deactivate) products
//   • Toggle "show inactive products"
// =============================================================

import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, X, Package, AlertCircle } from 'lucide-react'

const EMPTY_FORM = {
  name: '', description: '', price: '', stock: '', category: '', sku: '', active: true
}

export default function Products() {
  const [products, setProducts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal]           = useState(false)  // true = open
  const [form, setForm]             = useState(EMPTY_FORM)
  const [editId, setEditId]         = useState(null)   // null = creating new
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)

  const load = () => {
    setLoading(true)
    const url = `/api/products?includeInactive=${showInactive}`
    fetch(url)
      .then(r => r.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [showInactive])

  const openCreate = () => {
    setEditId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setModal(true)
  }

  const openEdit = product => {
    setEditId(product.id)
    setForm({
      name:        product.name,
      description: product.description || '',
      price:       product.price,
      stock:       product.stock,
      category:    product.category || '',
      sku:         product.sku || '',
      active:      product.active,
    })
    setError(null)
    setModal(true)
  }

  const handleSubmit = async () => {
    setError(null)
    if (!form.name || form.price === '') {
      return setError('Product name and price are required.')
    }

    setSaving(true)
    try {
      const url    = editId ? `/api/products/${editId}` : '/api/products'
      const method = editId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: parseFloat(form.price), stock: parseInt(form.stock) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Save failed')
      setModal(false)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async id => {
    if (!window.confirm('Deactivate this product? It will be hidden from the bot.')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    load()
  }

  const fmt = n => `$${parseFloat(n || 0).toFixed(2)}`

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between animate-enter">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-bright)' }}>Products</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {products.length} products in catalog
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="accent-wa-400"
            />
            Show inactive
          </label>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      {/* Products table */}
      <div className="card overflow-hidden animate-enter" style={{ animationDelay: '0.1s' }}>
        {loading ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading products…
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center">
            <Package size={32} color="var(--text-muted)" className="mx-auto mb-3" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No products yet. Add your first product to get started.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-bright)' }}>{p.name}</p>
                    {p.description && (
                      <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>
                        {p.description}
                      </p>
                    )}
                  </td>
                  <td className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{p.sku || '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.category || '—'}</td>
                  <td className="font-mono text-xs font-medium" style={{ color: 'var(--green)' }}>
                    {fmt(p.price)}
                  </td>
                  <td>
                    <span className={p.stock === 0 ? 'badge-red' : p.stock < 10 ? 'badge-yellow' : 'badge-green'}>
                      {p.stock}
                    </span>
                  </td>
                  <td>
                    <span className={p.active ? 'badge-green' : 'badge-gray'}>
                      {p.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)} className="btn-ghost px-2 py-1 text-xs">
                        <Edit2 size={12} /> Edit
                      </button>
                      {p.active && (
                        <button
                          onClick={() => deactivate(p.id)}
                          className="btn-ghost px-2 py-1 text-xs"
                          style={{ borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* === Add / Edit Modal === */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}
        >
          <div className="card w-full max-w-lg mx-4 animate-enter" style={{ maxHeight: '90vh', overflow: 'auto' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 pb-4"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>
                {editId ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Form fields */}
            <div className="p-5 space-y-3">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-xs"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              <Field label="Product Name *" value={form.name}
                onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Classic White T-Shirt" />

              <Field label="Description" value={form.description}
                onChange={v => setForm(p => ({ ...p, description: v }))}
                placeholder="Short product description" multiline />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price ($) *" value={form.price} type="number"
                  onChange={v => setForm(p => ({ ...p, price: v }))} placeholder="0.00" />
                <Field label="Stock" value={form.stock} type="number"
                  onChange={v => setForm(p => ({ ...p, stock: v }))} placeholder="0" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category" value={form.category}
                  onChange={v => setForm(p => ({ ...p, category: v }))} placeholder="e.g. Apparel" />
                <Field label="SKU" value={form.sku}
                  onChange={v => setForm(p => ({ ...p, sku: v }))} placeholder="e.g. APP-001" />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-base)' }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                  className="accent-wa-400"
                />
                Active (visible to bot)
              </label>
            </div>

            {/* Modal footer */}
            <div className="p-5 pt-0 flex justify-end gap-3">
              <button onClick={() => setModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary" style={saving ? { opacity: 0.6 } : {}}>
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Small reusable form field component
function Field({ label, value, onChange, type = 'text', placeholder, multiline }) {
  const props = {
    className: 'field',
    value,
    onChange: e => onChange(e.target.value),
    placeholder,
    type: multiline ? undefined : type,
  }

  return (
    <div>
      <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {multiline
        ? <textarea {...props} rows={3} style={{ resize: 'vertical' }} />
        : <input {...props} />
      }
    </div>
  )
}
