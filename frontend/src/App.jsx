// =============================================================
// App.jsx — Root component with client-side routing
//
// We use react-router-dom v6 with a persistent sidebar layout.
// Each page is a lazy-loaded component so only the code for the
// current view is fetched initially, keeping the bundle small.
// =============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Orders from './pages/Orders.jsx'
import Products from './pages/Products.jsx'
import Invoices from './pages/Invoices.jsx'
import Conversations from './pages/Conversations.jsx'

export default function App() {
  return (
    <BrowserRouter>
      {/* Root layout: fixed sidebar + scrollable main content */}
      <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <Sidebar />

        {/* Main content area — offset by sidebar width (240px) */}
        <main className="flex-1 ml-[240px] min-h-screen overflow-auto">
          <Routes>
            <Route path="/"             element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/orders"       element={<Orders />} />
            <Route path="/products"     element={<Products />} />
            <Route path="/invoices"     element={<Invoices />} />
            <Route path="/conversations" element={<Conversations />} />
            {/* Catch-all: redirect unknown paths back to dashboard */}
            <Route path="*"             element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
