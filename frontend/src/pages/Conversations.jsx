// =============================================================
// pages/Conversations.jsx — WhatsApp chat history viewer
//
// Two-panel layout:
//   Left panel  — list of all conversations (user phone + preview)
//   Right panel — chronological chat messages for selected conversation
//
// The admin can search by phone number and see the AI memory summary.
// =============================================================

import { useEffect, useState, useRef } from 'react'
import { Search, MessageCircle, Bot, User, Trash2 } from 'lucide-react'

export default function Conversations() {
  const [list, setList]           = useState([])
  const [selected, setSelected]   = useState(null)  // conversation object
  const [messages, setMessages]   = useState([])
  const [summary, setSummary]     = useState(null)
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const bottomRef = useRef(null)

  // Load conversation list on mount
  useEffect(() => {
    setLoading(true)
    fetch('/api/conversations')
      .then(r => r.json())
      .then(data => setList(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // When a conversation is selected, load its messages
  useEffect(() => {
    if (!selected) return
    setMsgLoading(true)
    fetch(`/api/conversations/${selected.id}/messages`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages || [])
        setSummary(data.summary)
      })
      .catch(console.error)
      .finally(() => setMsgLoading(false))
  }, [selected])

  // Auto-scroll to the newest message when messages load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const clearMessages = async () => {
    if (!window.confirm('Clear all messages in this conversation? This cannot be undone.')) return
    await fetch(`/api/conversations/${selected.id}/messages`, { method: 'DELETE' })
    setMessages([])
  }

  // Filter list by search query (phone or name)
  const filtered = list.filter(c => {
    const q = search.toLowerCase()
    return (
      c.user_phone?.includes(q) ||
      c.user_name?.toLowerCase().includes(q)
    )
  })

  const fmtTime = ts => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const fmtDate = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="flex h-screen">
      {/* ===== Left panel: conversation list ===== */}
      <div className="w-72 flex flex-col flex-shrink-0"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-card)' }}>

        {/* Search bar */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-bright)' }}>Chats</h1>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" color="var(--text-muted)" />
            <input
              className="field pl-8"
              placeholder="Search by phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              Loading chats…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No results found.' : 'No conversations yet.'}
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className="w-full text-left px-4 py-3 transition-all"
                style={{
                  background: selected?.id === conv.id ? 'var(--bg-elevated)' : 'transparent',
                  borderLeft: selected?.id === conv.id ? '2px solid var(--green)' : '2px solid transparent',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {/* Phone number */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium" style={{ color: 'var(--text-bright)' }}>
                    {conv.user_phone}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fmtDate(conv.updated_at)}
                  </span>
                </div>
                {/* Name + message count */}
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
                    {conv.last_message || 'No messages'}
                  </span>
                  <span className="font-mono text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                    {conv.message_count}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ===== Right panel: message thread ===== */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-surface)' }}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageCircle size={40} color="var(--text-muted)" strokeWidth={1.2} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Select a conversation to view messages
            </p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div>
                <p className="font-mono text-sm font-medium" style={{ color: 'var(--text-bright)' }}>
                  {selected.user_phone}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {messages.length} messages · joined {fmtDate(selected.user_joined || selected.updated_at)}
                </p>
              </div>
              <button onClick={clearMessages} className="btn-ghost px-2 py-1 text-xs"
                style={{ borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                <Trash2 size={12} /> Clear
              </button>
            </div>

            {/* AI summary banner (when present) */}
            {summary && (
              <div className="mx-5 mt-4 p-3 rounded-lg text-xs"
                style={{
                  background: 'rgba(37,211,102,0.05)',
                  border: '1px solid rgba(37,211,102,0.15)',
                  color: 'var(--text-muted)'
                }}>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>AI Memory Summary · </span>
                {summary}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {msgLoading ? (
                <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>Loading…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>No messages.</p>
              ) : (
                messages.map((msg, i) => {
                  const isBot = msg.role === 'assistant'
                  return (
                    <div key={i} className={`flex items-end gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
                      {/* Avatar */}
                      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{
                          background: isBot ? 'rgba(37,211,102,0.12)' : 'rgba(59,130,246,0.12)',
                          border: `1px solid ${isBot ? 'rgba(37,211,102,0.2)' : 'rgba(59,130,246,0.2)'}`,
                        }}>
                        {isBot
                          ? <Bot size={11} color="#25D366" />
                          : <User size={11} color="#3b82f6" />
                        }
                      </div>

                      {/* Bubble */}
                      <div
                        className="max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap"
                        style={{
                          background: isBot ? 'var(--bg-elevated)' : 'rgba(37,211,102,0.12)',
                          border: `1px solid ${isBot ? 'var(--border)' : 'rgba(37,211,102,0.2)'}`,
                          color: 'var(--text-base)',
                          borderBottomLeftRadius: isBot ? 4 : undefined,
                          borderBottomRightRadius: !isBot ? 4 : undefined,
                        }}
                      >
                        {msg.content}
                        <p className="text-right mt-1" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          {fmtTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
