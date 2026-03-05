// =============================================================
// pages/Invoices.jsx — Invoice list with PDF download links
//
// Displays all generated invoices in a table and lets the admin:
//   • View invoice details (order, customer, total, date)
//   • Download or preview the PDF in a new tab
//   • Manually trigger invoice generation for any order
// =============================================================

import { useEffect, useState } from 'react'
import { FileText, Download, RefreshCw, ExternalLink } from 'lucide-react'

const fmt = n => `$${parseFloat(n || 0).toFixed(2)}`

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/invoices')
      .then(r => r.json())
      .then(data => setInvoices(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="animate-enter flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-bright)' }}>Invoices</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} generated
          </p>
        </div>
        <button onClick={load} className="btn-ghost">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden animate-enter" style={{ animationDelay: '0.1s' }}>
        {loading ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading invoices…
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-16 text-center">
            <FileText size={32} color="var(--text-muted)" className="mx-auto mb-3" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No invoices yet. They're auto-generated when an order is confirmed or paid.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Order Status</th>
                <th>Issued</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>
                      {inv.invoice_number}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      #{String(inv.order_id).padStart(4, '0')}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-base)' }}>
                    {inv.user_name || inv.user_phone || '—'}
                  </td>
                  <td className="font-mono text-xs font-medium" style={{ color: 'var(--text-bright)' }}>
                    {fmt(inv.total)}
                  </td>
                  <td>
                    <span className={
                      inv.order_status === 'paid'      ? 'badge-green'  :
                      inv.order_status === 'confirmed' ? 'badge-blue'   :
                      inv.order_status === 'cancelled' ? 'badge-red'    : 'badge-yellow'
                    }>
                      {inv.order_status || '—'}
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(inv.issued_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </td>
                  <td>
                    {inv.pdf_url ? (
                      <a
                        href={inv.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost px-2 py-1 text-xs"
                        style={{ display: 'inline-flex' }}
                      >
                        <Download size={12} /> PDF
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Not available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info box */}
      <div className="p-4 rounded-lg text-xs animate-enter" style={{
        background: 'rgba(37,211,102,0.05)',
        border: '1px solid rgba(37,211,102,0.15)',
        color: 'var(--text-muted)',
        animationDelay: '0.15s'
      }}>
        <span style={{ color: 'var(--green)', fontWeight: 600 }}>How invoices work: </span>
        Invoices are auto-generated when the bot confirms an order via WhatsApp, and again when you mark
        an order as "paid" from the Orders page. You can also trigger manual generation from the Orders view.
        PDF files are stored in the <code className="font-mono" style={{ color: 'var(--text-base)' }}>/backend/invoices/</code> directory on your server.
      </div>
    </div>
  )
}
