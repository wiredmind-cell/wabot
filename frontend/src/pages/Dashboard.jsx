// =============================================================
// pages/Dashboard.jsx — Main analytics overview
//
// Shows:
//   • 4 KPI stat cards (total orders, revenue, products, users)
//   • A 7-day revenue + order volume area chart (recharts)
//   • A "recent orders" table with status badges
// =============================================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'
import {
  ShoppingCart, DollarSign, Package, Users,
  ArrowRight, TrendingUp
} from 'lucide-react'
import StatsCard from '../components/StatsCard.jsx'

// Map order status → badge CSS class
const STATUS_BADGE = {
  pending:   'badge-yellow',
  confirmed: 'badge-blue',
  paid:      'badge-green',
  cancelled: 'badge-red',
}

export default function Dashboard() {
  const [stats, setStats]       = useState(null)
  const [chart, setChart]       = useState([])
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // Fetch all data in parallel on mount
    Promise.all([
      fetch('/api/stats').then(r => r.json()),
      fetch('/api/stats/revenue-chart').then(r => r.json()),
      fetch('/api/orders?limit=8').then(r => r.json()),
    ])
      .then(([statsData, chartData, ordersData]) => {
        setStats(statsData)
        setChart(chartData)
        setOrders(Array.isArray(ordersData) ? ordersData : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Format currency
  const fmt = n => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  // Format date for chart x-axis
  const fmtDate = d => {
    const date = new Date(d)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return (
    <div className="p-6 space-y-6">
      {/* ---- Page header ---- */}
      <div className="animate-enter">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-bright)' }}>Overview</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Real-time metrics from your WhatsApp sales bot
        </p>
      </div>

      {/* ---- KPI cards ---- */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          label="Total Orders"
          value={stats ? stats.orders?.total || 0 : '—'}
          icon={ShoppingCart}
          trend={`${stats?.orders?.pending || 0} pending · ${stats?.orders?.paid || 0} paid`}
          loading={loading}
        />
        <StatsCard
          label="Revenue"
          value={stats ? fmt(stats.revenue) : '—'}
          icon={DollarSign}
          trend="From paid orders"
          color="#3b82f6"
          loading={loading}
        />
        <StatsCard
          label="Products"
          value={stats ? stats.products : '—'}
          icon={Package}
          trend="Active in catalog"
          color="#a78bfa"
          loading={loading}
        />
        <StatsCard
          label="Customers"
          value={stats ? stats.users : '—'}
          icon={Users}
          trend="Unique WhatsApp users"
          color="#fb923c"
          loading={loading}
        />
      </div>

      {/* ---- Revenue chart ---- */}
      <div className="card p-5 animate-enter" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>
              Revenue — Last 7 Days
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Daily revenue and order count</p>
          </div>
          <TrendingUp size={16} color="var(--text-muted)" />
        </div>

        {chart.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No revenue data yet — orders will appear here once placed.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#25D366" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#25D366" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickFormatter={fmtDate} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} yAxisId="rev" orientation="left" tickFormatter={v => `$${v}`} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} yAxisId="ord" orientation="right" />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: 'var(--text-bright)', marginBottom: 4 }}
                formatter={(value, name) => [
                  name === 'revenue' ? `$${parseFloat(value).toFixed(2)}` : value,
                  name === 'revenue' ? 'Revenue' : 'Orders'
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#25D366" strokeWidth={2} fill="url(#revGrad)" name="revenue" />
              <Area yAxisId="ord" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} fill="url(#ordGrad)" name="orders" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ---- Recent orders ---- */}
      <div className="card animate-enter" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>Recent Orders</h2>
          <Link to="/orders" className="text-xs flex items-center gap-1" style={{ color: 'var(--green)' }}>
            View all <ArrowRight size={12} />
          </Link>
        </div>

        <div className="mt-3 overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                    No orders yet. Once customers place orders via WhatsApp they'll appear here.
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>
                        #{String(order.id).padStart(4, '0')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-base)' }}>
                      {order.user_name || order.user_phone || '—'}
                    </td>
                    <td>
                      <span className={STATUS_BADGE[order.status] || 'badge-gray'}>
                        {order.status}
                      </span>
                    </td>
                    <td className="font-mono text-xs" style={{ color: 'var(--text-bright)' }}>
                      {fmt(order.total)}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
