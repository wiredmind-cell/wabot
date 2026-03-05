<div align="center">

<img src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
<img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" />

<br /><br />

# 💬 WhatsApp Business Bot MVP

**A fully autonomous WhatsApp sales agent — handles conversations, closes orders, and generates invoices — with a real-time React admin dashboard.**

*Built with Baileys · OpenAI GPT-4o-mini · Neon Postgres · pdf-lib · Tailwind CSS*

<br />

</div>

---

## What It Does

This bot connects to WhatsApp as a linked device (no Business API subscription required) and acts as an AI-powered sales representative for your store. Customers message your WhatsApp number in plain English — the bot answers product questions, checks stock, closes deals, and emails a PDF invoice, all without any human involvement.

The admin dashboard gives you a live view of every order, chat history, and revenue metric, with full control over the product catalog and order statuses.

---

## Features

**Bot capabilities** — the bot handles the entire sales funnel autonomously. It browses the product catalog with customers, answers questions about specs and availability, confirms orders when intent is clear, validates stock before committing, and generates a branded PDF invoice the moment an order is placed. It never invents products or prices — everything is grounded in your database.

**AI memory management** — to keep API costs predictable, the bot compresses older messages into a rolling summary stored in Postgres. Only the last 10 messages are sent to OpenAI verbatim; everything older is represented as a short paragraph of context. This means conversations can run indefinitely without ever hitting the context window limit or generating runaway token bills.

**Structured order detection** — rather than relying on brittle keyword matching, the bot uses GPT's reasoning to decide when a customer is ready to order. When it's confident, it responds with a JSON action instead of plain text. The backend detects this, runs stock validation, writes the order to the database, and immediately generates the PDF — all in the same message handler.

**Admin dashboard** — a dark-themed React SPA with five views: a live KPI dashboard with a 7-day revenue chart, an order manager with expandable rows and inline status updates, a product catalog editor with add/edit modals, an invoice list with one-click PDF download, and a two-panel chat history viewer with AI memory summaries displayed per conversation.

---

## Architecture

```
┌─────────────────┐     WhatsApp Message      ┌─────────────────────┐
│  Customer Phone  │ ────────────────────────▶ │     server.js        │
└─────────────────┘                            │  (Baileys socket)    │
                                               └────────┬────────────┘
                                                        │
                                               ┌────────▼────────────┐
                                               │    botLogic.js       │
                                               │  1. upsert user      │
                                               │  2. load last 10 msgs│
                                               │  3. call AI          │
                                               │  4. detect order?    │
                                               │  5. save + reply     │
                                               └────────┬────────────┘
                                          ┌─────────────┼─────────────┐
                                          │             │             │
                               ┌──────────▼──┐  ┌───────▼────┐  ┌────▼──────────┐
                               │    ai.js     │  │    db.js    │  │pdfGenerator.js│
                               │  OpenAI API  │  │Neon Postgres│  │  pdf-lib PDF  │
                               └─────────────┘  └────────────┘  └───────────────┘
```

```
whatsapp-bot/
├── backend/
│   ├── server.js               # Express API + Baileys startup + QR login
│   ├── db.js                   # Connection pool + schema init (idempotent)
│   ├── ai.js                   # GPT completions + rolling memory summarizer
│   ├── botLogic.js             # Full message pipeline (the brain)
│   ├── pdfGenerator.js         # Branded A4 invoice via pdf-lib
│   ├── products.json           # 10 sample products — auto-seeded on first run
│   └── routes/
│       ├── orders.js           # CRUD + status transitions
│       ├── products.js         # Catalog management
│       ├── invoices.js         # List + PDF streaming
│       └── conversations.js    # Chat history + summary access
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx   # KPIs + 7-day revenue chart (Recharts)
        │   ├── Orders.jsx      # Expandable order table + status editor
        │   ├── Products.jsx    # Catalog grid + add/edit modal
        │   ├── Invoices.jsx    # Invoice list + PDF download
        │   └── Conversations.jsx  # Two-panel chat viewer
        └── components/
            ├── Sidebar.jsx     # Nav + live backend health indicator
            └── StatsCard.jsx   # Reusable KPI card
```

---

## Prerequisites

You need three things before running this project.

**[Neon Postgres](https://neon.tech)** — create a free project and copy the connection string from the dashboard. It will look like `postgresql://user:pass@host.neon.tech/db?sslmode=require`. Neon's free tier is more than enough for an MVP.

**[OpenAI API Key](https://platform.openai.com/api-keys)** — the bot uses `gpt-4o-mini` by default, which is very cost-effective. You can switch to `gpt-4o` in `backend/ai.js` for stronger reasoning if needed.

**A dedicated WhatsApp number** — Baileys connects as a regular WhatsApp account via QR code scan. Use a phone number dedicated to the business, not your personal account.

---

## Quick Start

### Backend

```bash
cd backend
npm install

# Set up environment variables
cp .env.example .env
# → Open .env and fill in DATABASE_URL, OPENAI_API_KEY, and business details

npm run dev
```

On first launch, three things happen automatically: the full Postgres schema is created in Neon, the 10 sample products from `products.json` are seeded, and Baileys prints a QR code in your terminal. Scan it from your phone under **WhatsApp → Settings → Linked Devices → Link a Device**.

Your session is saved in `./sessions/` — you won't need to scan again on subsequent restarts.

### Frontend

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

Vite's dev proxy automatically forwards all `/api/*` requests to `localhost:3001`, so no CORS configuration is needed during development.

### Try It Out

Send any of these messages to your linked WhatsApp number from another phone:

```
"What do you have in stock?"
"Tell me about the wireless earbuds"
"I want to order 2 white t-shirts and a hoodie"
"Yes, confirm my order"
```

When the AI detects a confirmed order, it creates it in the database, decrements stock, generates a PDF invoice, and sends a confirmation message with a payment link — all in the same reply.

---

## Environment Variables

```env
# ── Neon Postgres ──────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host.neon.tech/db?sslmode=require

# ── OpenAI ─────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Server ─────────────────────────────────────────────────────────
PORT=3001
FRONTEND_URL=http://localhost:5173

# ── Business Info (shown on PDF invoices) ──────────────────────────
BUSINESS_NAME=My Store
BUSINESS_ADDRESS=123 Main Street, City, Country
BUSINESS_PHONE=+1234567890
BUSINESS_EMAIL=hello@mystore.com

# ── Optional: Payment link shown in WhatsApp message + invoice ─────
PAYMENT_LINK=https://pay.stripe.com/your-link

# ── File paths ─────────────────────────────────────────────────────
INVOICE_DIR=./invoices
SESSION_DIR=./sessions
```

---

## How the AI Memory System Works

Every conversation in the database has a `summary` text field alongside its list of individual messages. After a user accumulates more than 10 messages, the bot calls GPT with a summarization prompt and stores the result in `conversations.summary`. On every subsequent message, the summary is injected at the top of the system prompt as background context, while only the 10 most recent messages are included verbatim.

This two-layer approach is what allows the bot to remember that a customer asked about the blue hoodie three days ago, or that they were waiting on a restock — without paying for 200 tokens of chat history on every single message.

---

## How Order Creation Works

The system prompt instructs the AI to respond in one of two formats depending on the situation. For general conversation it responds with plain text. When a customer has clearly confirmed what they want to buy (specific products, quantities, and a clear intent to proceed), it responds with raw JSON instead:

```json
{
  "action": "create_order",
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "product_name": "Classic White T-Shirt",
      "unit_price": 19.99
    }
  ],
  "message": "Perfect! I've placed your order. Your invoice is on its way."
}
```

`botLogic.js` detects this response, validates that each product has sufficient stock, inserts the order and line items into Postgres, decrements stock counts, generates the PDF invoice, saves an invoice record, and sends the `message` field back to the customer — all before the next message can arrive.

---

## API Reference

All endpoints are served from `http://localhost:3001`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Dashboard KPIs |
| `GET` | `/api/stats/revenue-chart` | 7-day revenue + order count |
| `GET` | `/api/orders` | List orders (`?status=pending`) |
| `GET` | `/api/orders/:id` | Order details with line items |
| `PUT` | `/api/orders/:id/status` | Update status (triggers invoice on `paid`) |
| `POST` | `/api/orders` | Manually create an order |
| `GET` | `/api/products` | List active products |
| `POST` | `/api/products` | Create a product |
| `PUT` | `/api/products/:id` | Update a product |
| `DELETE` | `/api/products/:id` | Soft-deactivate a product |
| `GET` | `/api/invoices` | List all invoices |
| `GET` | `/api/invoices/download/:number` | Stream PDF to browser |
| `POST` | `/api/invoices/generate/:orderId` | Manually generate PDF |
| `GET` | `/api/conversations` | List all conversations |
| `GET` | `/api/conversations/:id/messages` | Messages + AI summary |
| `DELETE` | `/api/conversations/:id/messages` | Clear chat history |

---

## Database Schema

```sql
users           -- one row per WhatsApp phone number
conversations   -- one per user, stores the AI memory summary
messages        -- individual chat turns (role: user | assistant)
products        -- the catalog the AI references
orders          -- one per checkout (status: pending → confirmed → paid)
order_items     -- line items linking orders to products
invoices        -- generated PDFs linked to orders
```

---

## Production Considerations

**WhatsApp session persistence** — Baileys stores auth credentials as JSON files in `./sessions/`. In a containerised deployment, mount this as a persistent volume to survive restarts without re-scanning the QR code.

**PDF storage** — invoices are currently written to the local `./invoices/` directory and served as static files. For production, upload the generated PDF bytes to S3 (or any object storage) and store the public URL in the `invoices.pdf_url` column instead.

**Payments** — the `PAYMENT_LINK` env variable is a static URL appended to the confirmation message and invoice. To collect real payments, integrate Stripe by creating a Payment Intent in `botLogic.js` after the order is committed, and include the resulting checkout URL in the reply.

**Group messages** — the bot ignores group chats by default (JIDs ending in `@g.us`). Remove or modify that check in `botLogic.js` to enable group support.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| WhatsApp connectivity | `@whiskeysockets/baileys` |
| AI | OpenAI `gpt-4o-mini` |
| Backend runtime | Node.js 20 + Express |
| Database | Neon Postgres (serverless) |
| PDF generation | `pdf-lib` |
| Frontend framework | React 18 + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |

---

## License

MIT — do whatever you like with it.
