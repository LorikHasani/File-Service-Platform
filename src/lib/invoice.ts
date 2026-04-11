import { jsPDF } from 'jspdf';
import type { Transaction } from '@/types/database';

// ---------------------------------------------------------------------------
// Company constants — update here to re-brand invoices across the app.
// ---------------------------------------------------------------------------
export const INVOICE_COMPANY = {
  name: 'ChipTuneFiles',
  email: 'kikzaperformance@gmail.com',
  phone: '+383 44 955 389',
  address: 'Worldwide',
  logoUrl: '/logo.png',
} as const;

// Shape of the client data we need on the invoice. Deliberately loose so the
// function works with both the current user's profile and the joined client
// record on admin transactions.
export interface InvoiceClient {
  contact_name: string;
  company_name?: string | null;
  country?: string | null;
  email?: string | null;
}

// ---------------------------------------------------------------------------
// Invoice number — derived deterministically from the transaction uuid so
// the same purchase always produces the same 4-digit invoice reference.
// ---------------------------------------------------------------------------
export function formatInvoiceNumber(tx: Pick<Transaction, 'id'>): string {
  const hex = tx.id.replace(/-/g, '').slice(0, 8);
  const num = parseInt(hex, 16);
  if (Number.isNaN(num)) return tx.id.slice(0, 4).toUpperCase();
  return String(num % 10000).padStart(4, '0');
}

// Pull out the Stripe identifier embedded in the transaction description, if
// any. Webhook descriptions look like:
//   "Purchased Gold Package (100 credits) — Stripe cs_live_xxxxx"
function extractStripeId(tx: Transaction): string {
  if (!tx.description) return tx.id;
  const match = tx.description.match(/Stripe\s+(\S+)/i);
  return match?.[1] || tx.id;
}

// Load the public logo as a data URL so jsPDF can embed it. We cache the
// promise so generating a batch of invoices only fetches the asset once.
let logoPromise: Promise<string | null> | null = null;
function loadLogo(): Promise<string | null> {
  if (logoPromise) return logoPromise;
  logoPromise = (async () => {
    try {
      const resp = await fetch(INVOICE_COMPANY.logoUrl);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  })();
  return logoPromise;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTime(d: Date): string {
  const h24 = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

// ---------------------------------------------------------------------------
// Main entry: generate a PDF invoice for a single credit-purchase transaction
// and trigger a browser download. Safe to call from any page that has the
// transaction and the client's basic profile info.
// ---------------------------------------------------------------------------
export async function generateInvoicePDF(
  tx: Transaction,
  client: InvoiceClient,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginLeft = 15;
  const marginRight = 15;
  const contentWidth = pageWidth - marginLeft - marginRight; // 180

  const invoiceNumber = formatInvoiceNumber(tx);
  const txDate = new Date(tx.created_at);
  const dateStr = formatDate(txDate);
  const timeStr = formatTime(txDate);
  const amount = Number(tx.amount) || 0;
  const amountStr = `€${amount.toFixed(0)}`;
  const stripeId = extractStripeId(tx);
  const billName = client.company_name?.trim() || client.contact_name;
  const billCountry = client.country?.trim() || '';

  // ── Header: logo (left) + company block (right) ─────────────────────────
  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', marginLeft, 15, 40, 22);
    } catch {
      // Ignore — logo load succeeded but addImage can fail on weird formats
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(INVOICE_COMPANY.name, pageWidth - marginRight, 20, { align: 'right' });
  doc.text(INVOICE_COMPANY.email, pageWidth - marginRight, 26, { align: 'right' });
  doc.text(`Tel: ${INVOICE_COMPANY.phone}`, pageWidth - marginRight, 32, { align: 'right' });
  doc.text(`Location: ${INVOICE_COMPANY.address}`, pageWidth - marginRight, 38, { align: 'right' });

  // ── "Invoice" label strip ────────────────────────────────────────────────
  const labelY = 50;
  doc.setFillColor(30, 30, 30);
  doc.rect(marginLeft, labelY, 60, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Invoice', marginLeft + 4, labelY + 7);

  // ── Bill-to (left) and invoice info (right) gray blocks ─────────────────
  const blockY = 65;
  const blockH = 28;
  const halfW = (contentWidth - 10) / 2; // two side-by-side with 10mm gap

  doc.setFillColor(235, 235, 235);
  doc.rect(marginLeft, blockY, halfW, blockH, 'F');
  doc.rect(marginLeft + halfW + 10, blockY, halfW, blockH, 'F');

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(billName, marginLeft + 4, blockY + 8);
  if (billCountry) {
    doc.text(billCountry, marginLeft + 4, blockY + 15);
  }

  doc.setFontSize(10);
  const rightBlockX = marginLeft + halfW + 10 + 4;
  doc.text(`Invoice number: ${invoiceNumber}`, rightBlockX, blockY + 8);
  doc.text(`Invoice date: ${dateStr}`, rightBlockX, blockY + 15);
  doc.text(`Due date: ${dateStr}`, rightBlockX, blockY + 22);

  // ── Items header strip ──────────────────────────────────────────────────
  const itemsHeaderY = 105;
  doc.setFillColor(220, 220, 220);
  doc.rect(marginLeft, itemsHeaderY, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('Items:', marginLeft + 4, itemsHeaderY + 5.5);

  // Item row (plain)
  const itemRowY = itemsHeaderY + 8;
  doc.setFillColor(250, 250, 250);
  doc.rect(marginLeft, itemRowY, contentWidth, 10, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Tuning file credits', marginLeft + 4, itemRowY + 6.5);

  // ── Totals rows on the right ────────────────────────────────────────────
  const totalsX = marginLeft + contentWidth / 2;
  const totalsW = contentWidth / 2;
  const subTotalY = itemRowY + 12;
  doc.setFillColor(235, 235, 235);
  doc.rect(totalsX, subTotalY, totalsW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Sub Total:', totalsX + 4, subTotalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(amountStr, totalsX + totalsW - 4, subTotalY + 6, { align: 'right' });

  const totalY = subTotalY + 9;
  doc.setFillColor(215, 215, 215);
  doc.rect(totalsX, totalY, totalsW, 11, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total:', totalsX + 4, totalY + 7);
  doc.text(amountStr, totalsX + totalsW - 4, totalY + 7, { align: 'right' });

  // ── Paid banner + transaction id ────────────────────────────────────────
  const paidY = totalY + 20;
  doc.setFillColor(38, 197, 182); // teal
  doc.rect(marginLeft, paidY, contentWidth, 11, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Paid: ${timeStr} ${dateStr}`, pageWidth / 2, paidY + 7, { align: 'center' });

  const txIdY = paidY + 11;
  doc.setFillColor(250, 250, 250);
  doc.rect(marginLeft, txIdY, contentWidth, 10, 'F');
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Transaction ID: ${stripeId}`, pageWidth / 2, txIdY + 6.5, { align: 'center' });

  // ── Footer address ──────────────────────────────────────────────────────
  doc.setTextColor(90, 90, 90);
  doc.setFontSize(9);
  doc.text(INVOICE_COMPANY.address, pageWidth / 2, 285, { align: 'center' });

  doc.save(`invoice-${invoiceNumber}.pdf`);
}
