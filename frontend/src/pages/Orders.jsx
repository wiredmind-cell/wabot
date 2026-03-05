// =============================================================
// pages/Orders.jsx — Full order list with status filtering
//
// Features:
//   • Filter by status (all / pending / confirmed / paid / cancelled)
//   • Click a row to expand and see order line items
//   • Update status from the detail panel
//   • Trigger invoice generation for any order
// =============================================================

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, FileText } from 'lucide-react'

const STATUS_BADGE = {
  pending:   'badge-yellow',
  confirmed: 'badge-blue',
  paid:      'badge-green',
  cancelled: 'badge-red',
}

const STATUSES = ['all', 'pending', 'confirmed', 'paid', 'cancelled']

const fmt = n => `$${parseFloat(n || 0).toFixed(2)}`

export default function Orders() {
  const [orders, setOrders]       = useState([])
  const [filter, setFilter]       = useState('all')
  const [expanded, setExpanded]   = useState(null)
  const [detail, setDetail]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [updating, setUpdating]   = useState(false)

  // Load orders whenever the status filter changes
  useEffect(() => {
    setLoading(true)
    const url = filter === 'all' ? '/api/orders' : `/api/orders?status=${filter}`
    fetch(url)
      .then(r => r.json())
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  // Load detail for the expanded row
  useEffect(() => {
    if (!expanded) { setDetail(null); return }
    fetch(`/api/orders/${expanded}`)
      .then(r => r.json())
      .then(setDetail)
      .catch(console.error)
  }, [expanded])

  const toggleRow = id => setExpanded(prev => prev === id ? null : id)

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        // Refresh the order list and the expanded detail
        const updated = await res.json()
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: updated.status } : o))
        setDetail(prev => prev ? { ...prev, status: updated.status } : null)
      }
    } catch (e) { console.error(e) }
    finally { setUpdating(false) }
  }

  const generateInvoice = async orderId => {
    const res = await fetch(`/api/invoices/generate/${orderId}`, { method: 'POST' })
    const data = await res.json()
    if (data.invoice?.pdf_url) {
      window.open(data.invoice.pdf_url, '_blank')
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="animate-enter flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-bright)' }}>Orders</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {orders.length} {filter === 'all' ? 'total' : filter} orders
          </p>
        </div>
        <button onClick={() => setFilter(f => f)} className="btn-ghost">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 animate-enter" style={{ animationDelay: '0.05s' }}>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-all ${
              filter === s
                ? 'text-black font-semibold'
                : 'text-ink-muted hover:text-ink-base border border-transparent hover:border-white/10'
            }`}
            style={filter === s ? { background: 'var(--green)' } : {}}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="card animate-enter overflow-hidden" style={{ animationDelay: '0.1s' }}>
        {loading ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No {filter === 'all' ? '' : filter} orders found.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th>Date</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <>
                  {/* Summary row */}
                  <tr
                    key={order.id}
                    onClick={() => toggleRow(order.id)}
                    className="cursor-pointer"
                  >
                    <td>
                      {expanded === order.id
                        ? <ChevronDown size={13} color="var(--text-muted)" />
                        : <ChevronRight size={13} color="var(--text-muted)" />
                      }
                    </td>
                    <td>
                      <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>
                        #{String(order.id).padStart(4, '0')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-base)' }}>
                      {order.user_name || order.user_phone || '—'}
                    </td>
                    <td><span className={STATUS_BADGE[order.status] || 'badge-gray'}>{order.status}</span></td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-bright)' }}>
                      {fmt(order.total)}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {order.invoice_number ? (
                        <a
                          href={`/api/invoices/download/${order.invoice_number}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs flex items-center gap-1"
                          style={{ color: 'var(--green)' }}
                        >
                          <FileText size={12} /> View
                        </a>
                      ) : (
                        <button
                          onClick={() => generateInvoice(order.id)}
                          className="text-xs"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Generate
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === order.id && detail && (
                    <tr key={`detail-${order.id}`}>
                      <td colSpan={7} style={{ background: 'var(--bg-elevated)', padding: '16px 24px' }}>
                        <div className="grid grid-cols-2 gap-6">
                          {/* Line items */}
                          <div>
                            <p className="text-xs font-mono uppercase tracking-widest mb-3"
                              style={{ color: 'var(--text-muted)' }}>Items</p>
                            <div className="space-y-2">
                              {(detail.items || []).map((item, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span style={{ color: 'var(--text-base)' }}>
                                    {item.product_name} × {item.quantity}
                                  </span>
                                  <span className="font-mono text-xs" style={{ color: 'var(--text-bright)' }}>
                                    {fmt(item.unit_price * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between mt-3 pt-3"
                              style={{ borderTop: '1px solid var(--border)' }}>
                              <span className="text-xs font-semibold" style={{ color: 'var(--text-bright)' }}>Total</span>
                              <span className="font-mono text-sm" style={{ color: 'var(--green)' }}>
                                {fmt(detail.total)}
                              </span>
                            </div>
                          </div>

                          {/* Status update */}
                          <div>
                            <p className="text-xs font-mono uppercase tracking-widest mb-3"
                              style={{ color: 'var(--text-muted)' }}>Update Status</p>
                            <div className="flex flex-wrap gap-2">
                              {['pending','confirmed','paid','cancelled'].map(s => (
                                <button
                                  key={s}
                                  disabled={detail.status === s || updating}
                                  onClick={() => updateStatus(order.id, s)}
                                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all border ${
                                    detail.status === s
                                      ? 'opacity-100 font-semibold'
                                      : 'opacity-50 hover:opacity-80'
                                  }`}
                                  style={detail.status === s
                                    ? { background: 'var(--green)', color: '#000', borderColor: 'var(--green)' }
                                    : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                                  }
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                            {detail.notes && (
                              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                                Note: {detail.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
