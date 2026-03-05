// =============================================================
// Sidebar.jsx — Left navigation panel
//
// A fixed-width (240px) sidebar that persists across all pages.
// The active route is highlighted with a green accent treatment.
// We use lucide-react for consistent iconography.
// =============================================================

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  MessageCircle,
  Zap,
  Circle,
} from 'lucide-react'

// Navigation items — each maps to a route + icon
const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders',        icon: ShoppingCart,    label: 'Orders' },
  { to: '/products',      icon: Package,         label: 'Products' },
  { to: '/invoices',      icon: FileText,        label: 'Invoices' },
  { to: '/conversations', icon: MessageCircle,   label: 'Chats' },
]

export default function Sidebar() {
  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[240px] flex flex-col z-50"
      style={{
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* ---- Branding ---- */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3">
        {/* Animated green dot — indicates the bot is running */}
        <div className="relative w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)' }}>
          <Zap size={16} color="#25D366" />
          {/* Outer pulse ring */}
          <span className="absolute inset-0 rounded-lg animate-ping opacity-25"
            style={{ background: 'rgba(37,211,102,0.3)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text-bright)' }}>WA Bot</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Admin Panel</p>
        </div>
      </div>

      {/* ---- Divider ---- */}
      <div className="mx-4 mb-4" style={{ height: '1px', background: 'var(--border)' }} />

      {/* ---- Bot status indicator ---- */}
      <BotStatus />

      {/* ---- Navigation links ---- */}
      <nav className="flex-1 px-3 space-y-1 mt-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'text-wa-400 bg-wa-400/10 border border-wa-400/20'
                  : 'text-ink-soft hover:text-ink-bright hover:bg-white/5 border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} color={isActive ? '#25D366' : undefined} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ---- Footer ---- */}
      <div className="p-4 mx-3 mb-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          API: <span style={{ color: 'var(--green)' }}>localhost:3001</span>
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Powered by Baileys + GPT
        </p>
      </div>
    </aside>
  )
}

// Small inline component that polls /api/health every 30s
// to show whether the backend is online or offline.
function BotStatus() {
  const [online, setOnline] = React.useState(null)

  React.useEffect(() => {
    const check = () =>
      fetch('/api/health')
        .then(r => r.ok ? setOnline(true) : setOnline(false))
        .catch(() => setOnline(false))

    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  if (online === null) return null

  return (
    <div className="mx-3 mb-3 px-3 py-2 rounded-lg flex items-center gap-2"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <Circle
        size={7}
        fill={online ? '#25D366' : '#ef4444'}
        color={online ? '#25D366' : '#ef4444'}
        className={online ? 'animate-pulse-slow' : ''}
      />
      <span className="text-xs font-mono" style={{ color: online ? '#25D366' : '#ef4444' }}>
        {online ? 'Backend online' : 'Backend offline'}
      </span>
    </div>
  )
}

// Need React in scope for the BotStatus hook
import React from 'react'
