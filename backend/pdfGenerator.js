// =============================================================
// pdfGenerator.js — PDF invoice generation with pdf-lib
//
// pdf-lib is a pure-JS PDF creation library that runs in Node
// without any browser or Chromium dependency. We build the
// invoice by drawing rectangles, lines, and text onto a PDF page.
//
// The generated file is saved to the INVOICE_DIR directory and
// the local file path is returned so it can be served via the API.
// =============================================================

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure the invoice output directory exists
const INVOICE_DIR = process.env.INVOICE_DIR
  ? join(process.cwd(), process.env.INVOICE_DIR)
  : join(__dirname, 'invoices');

if (!existsSync(INVOICE_DIR)) {
  mkdirSync(INVOICE_DIR, { recursive: true });
}

// =============================================================
// generateInvoicePDF
//
// @param order         Order row from DB { id, total, created_at }
// @param items         Array of { product_name, quantity, unit_price }
// @param invoiceNumber e.g. "INV-1720000000000-42"
// @param user          User row from DB { phone, name }
// @returns             File path of the saved PDF
// =============================================================
export async function generateInvoicePDF({ order, items, invoiceNumber, user }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size in points

  // Embed standard fonts (no external font files needed)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();

  // ---- Colour palette ----
  const colorGreen = rgb(0.07, 0.53, 0.4);   // WhatsApp green
  const colorDark = rgb(0.1, 0.1, 0.1);
  const colorGray = rgb(0.5, 0.5, 0.5);
  const colorLight = rgb(0.95, 0.95, 0.95);
  const colorWhite = rgb(1, 1, 1);

  // ---- Header bar ----
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: colorGreen,
  });

  page.drawText(process.env.BUSINESS_NAME || 'My Business', {
    x: 40,
    y: height - 45,
    size: 24,
    font: fontBold,
    color: colorWhite,
  });

  page.drawText('INVOICE', {
    x: width - 130,
    y: height - 45,
    size: 22,
    font: fontBold,
    color: colorWhite,
  });

  // ---- Business info ----
  let y = height - 110;
  const businessLines = [
    process.env.BUSINESS_ADDRESS || '',
    process.env.BUSINESS_PHONE || '',
    process.env.BUSINESS_EMAIL || '',
  ].filter(Boolean);

  for (const line of businessLines) {
    page.drawText(line, { x: 40, y, size: 9, font: fontRegular, color: colorGray });
    y -= 13;
  }

  // ---- Invoice meta (right side) ----
  const metaX = width - 220;
  let metaY = height - 110;

  const metaPairs = [
    ['Invoice #', invoiceNumber],
    ['Date', new Date(order.created_at || Date.now()).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    })],
    ['Order ID', `#${order.id}`],
    ['Status', (order.status || 'confirmed').toUpperCase()],
  ];

  for (const [label, value] of metaPairs) {
    page.drawText(label + ':', { x: metaX, y: metaY, size: 9, font: fontBold, color: colorGray });
    page.drawText(value, { x: metaX + 75, y: metaY, size: 9, font: fontRegular, color: colorDark });
    metaY -= 16;
  }

  // ---- Bill To section ----
  y -= 15;
  page.drawText('BILL TO', { x: 40, y, size: 9, font: fontBold, color: colorGray });
  y -= 14;
  page.drawText(user.name || 'Customer', { x: 40, y, size: 11, font: fontBold, color: colorDark });
  y -= 14;
  page.drawText(`WhatsApp: ${user.phone}`, { x: 40, y, size: 9, font: fontRegular, color: colorGray });

  // ---- Table header ----
  y -= 30;
  page.drawRectangle({ x: 30, y: y - 4, width: width - 60, height: 22, color: colorLight });

  const colX = { item: 40, qty: 320, unitPrice: 400, total: 490 };

  page.drawText('ITEM', { x: colX.item, y: y + 5, size: 9, font: fontBold, color: colorDark });
  page.drawText('QTY', { x: colX.qty, y: y + 5, size: 9, font: fontBold, color: colorDark });
  page.drawText('UNIT PRICE', { x: colX.unitPrice, y: y + 5, size: 9, font: fontBold, color: colorDark });
  page.drawText('TOTAL', { x: colX.total, y: y + 5, size: 9, font: fontBold, color: colorDark });

  // ---- Line items ----
  y -= 24;
  let subtotal = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const lineTotal = item.unit_price * item.quantity;
    subtotal += lineTotal;

    // Alternate row shading for readability
    if (i % 2 === 0) {
      page.drawRectangle({ x: 30, y: y - 6, width: width - 60, height: 20, color: rgb(0.98, 0.98, 0.98) });
    }

    page.drawText(item.product_name || `Product #${item.product_id}`, {
      x: colX.item, y, size: 9, font: fontRegular, color: colorDark,
    });
    page.drawText(String(item.quantity), { x: colX.qty, y, size: 9, font: fontRegular, color: colorDark });
    page.drawText(`$${parseFloat(item.unit_price).toFixed(2)}`, { x: colX.unitPrice, y, size: 9, font: fontRegular, color: colorDark });
    page.drawText(`$${lineTotal.toFixed(2)}`, { x: colX.total, y, size: 9, font: fontRegular, color: colorDark });

    y -= 22;
  }

  // ---- Separator line ----
  y -= 10;
  page.drawLine({ start: { x: 30, y }, end: { x: width - 30, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

  // ---- Totals block ----
  y -= 20;
  const totalsX = width - 180;

  const drawTotalRow = (label, value, bold = false) => {
    page.drawText(label, { x: totalsX, y, size: 10, font: bold ? fontBold : fontRegular, color: colorGray });
    page.drawText(value, { x: totalsX + 90, y, size: 10, font: bold ? fontBold : fontRegular, color: bold ? colorGreen : colorDark });
    y -= 18;
  };

  drawTotalRow('Subtotal:', `$${subtotal.toFixed(2)}`);
  drawTotalRow('Tax (0%):', '$0.00');

  // TOTAL row with highlight
  y -= 4;
  page.drawRectangle({ x: totalsX - 10, y: y - 6, width: 170, height: 24, color: colorGreen });
  page.drawText('TOTAL:', { x: totalsX, y: y + 3, size: 11, font: fontBold, color: colorWhite });
  page.drawText(`$${parseFloat(order.total || subtotal).toFixed(2)}`, { x: totalsX + 90, y: y + 3, size: 11, font: fontBold, color: colorWhite });

  // ---- Payment instructions ----
  y -= 50;
  if (process.env.PAYMENT_LINK) {
    page.drawText('Payment', { x: 40, y, size: 10, font: fontBold, color: colorDark });
    y -= 15;
    page.drawText(`Pay online: ${process.env.PAYMENT_LINK}`, { x: 40, y, size: 9, font: fontRegular, color: colorGray });
    y -= 13;
  }

  // ---- Footer ----
  page.drawRectangle({ x: 0, y: 0, width, height: 35, color: colorGreen });
  page.drawText('Thank you for your business!', {
    x: width / 2 - 75,
    y: 13,
    size: 10,
    font: fontBold,
    color: colorWhite,
  });

  // ---- Save PDF ----
  const pdfBytes = await pdfDoc.save();
  const filename = `${invoiceNumber}.pdf`;
  const filePath = join(INVOICE_DIR, filename);
  writeFileSync(filePath, pdfBytes);

  console.log(`📄 Invoice generated: ${filePath}`);
  return filePath;
}

// Expose the invoice directory so server.js can serve it statically
export { INVOICE_DIR };
