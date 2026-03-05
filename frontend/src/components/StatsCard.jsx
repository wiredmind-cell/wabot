// =============================================================
// StatsCard.jsx — Reusable KPI metric card
//
// Accepts a label, value, icon, trend (optional), and colour.
// Used on the Dashboard page to display key business metrics.
// =============================================================

export default function StatsCard({ label, value, icon: Icon, trend, color = '#25D366', loading = false }) {
  return (
    <div className="card card-hover p-5 animate-enter">
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={15} color={color} />
        </div>
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-8 w-24 rounded-md animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
      ) : (
        <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-bright)' }}>
          {value}
        </p>
      )}

      {/* Optional trend label (e.g. "+12% this week") */}
      {trend && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{trend}</p>
      )}
    </div>
  )
}
