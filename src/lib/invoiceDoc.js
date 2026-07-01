// Open a clean, printable invoice in a new window. The user can then
// "Save as PDF" from the browser print dialog — no PDF library needed, so no
// added bundle weight. Works for both monthly bills and final settlements.
import { formatMoney, formatDate } from './format';

const row = (label, value, opts = {}) => `
  <tr>
    <td style="padding:8px 0;color:#334155;${opts.strong ? 'font-weight:700;' : ''}">${label}</td>
    <td style="padding:8px 0;text-align:right;${opts.color ? `color:${opts.color};` : ''}${opts.strong ? 'font-weight:700;' : ''}">${value}</td>
  </tr>`;

export function invoiceHTML(invoice, tenant, room, building, landlordName = 'Landlord') {
  const title = invoice.isFinalBill ? 'FINAL SETTLEMENT' : `${invoice.month} ${invoice.year}`;
  const paidBadge =
    invoice.status === 'paid'
      ? '<span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;">PAID</span>'
      : invoice.status === 'partially_paid'
        ? '<span style="background:#fef9c3;color:#854d0e;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;">PARTIALLY PAID</span>'
        : '<span style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;">DUE</span>';

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <title>Invoice ${title} — ${tenant?.name || ''}</title>
  <style>
    * { box-sizing:border-box; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
    body { margin:0; padding:32px; color:#0f172a; background:#fff; }
    .sheet { max-width:640px; margin:0 auto; }
    h1 { font-size:22px; margin:0; }
    .muted { color:#64748b; font-size:13px; }
    table { width:100%; border-collapse:collapse; }
    .divider { border-top:2px solid #0f172a; margin:16px 0 4px; }
    @media print { body { padding:0; } .noprint { display:none; } }
  </style></head><body>
  <div class="sheet">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        <h1>Rent Invoice</h1>
        <div class="muted">${landlordName}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:700;">${title}</div>
        <div class="muted">Issued: ${formatDate(invoice.createdAt) || '—'}</div>
        ${invoice.dueDate ? `<div class="muted">Due: ${formatDate(invoice.dueDate)}</div>` : ''}
        <div style="margin-top:6px;">${paidBadge}</div>
      </div>
    </div>

    <div style="display:flex;gap:32px;margin-bottom:16px;font-size:14px;">
      <div>
        <div class="muted">Billed to</div>
        <div style="font-weight:600;">${tenant?.name || '—'}</div>
        <div class="muted">${tenant?.phone || ''}</div>
      </div>
      <div>
        <div class="muted">Property</div>
        <div style="font-weight:600;">Room ${room?.roomNumber || '—'}</div>
        <div class="muted">${building?.name || ''}</div>
      </div>
    </div>

    <table>
      ${row('Base Rent', formatMoney(invoice.baseRent))}
      ${row(`Electricity (${invoice.unitsUsed} units @ meter ${invoice.currentMeter})`, formatMoney(invoice.electricityBill))}
      ${Number(invoice.waterBill) ? row('Water', formatMoney(invoice.waterBill)) : ''}
      ${Number(invoice.otherCharges) ? row('Other Charges', formatMoney(invoice.otherCharges)) : ''}
      ${Number(invoice.previousPending) ? row('Previous Pending', formatMoney(invoice.previousPending), { color: '#b91c1c' }) : ''}
    </table>
    <div class="divider"></div>
    <table>
      ${row('Total', formatMoney(invoice.totalAmount), { strong: true })}
      ${row('Amount Paid', formatMoney(invoice.amountPaid), { color: '#15803d' })}
      ${row('Balance Due', formatMoney(invoice.previousPendingCarry), { strong: true, color: '#b91c1c' })}
    </table>

    <p class="muted" style="margin-top:32px;">This is a system-generated invoice from the Rent Management CMS.</p>
    <button class="noprint" onclick="window.print()" style="margin-top:16px;padding:10px 20px;background:#4F46E5;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;">Print / Save as PDF</button>
  </div>
  </body></html>`;
}

export function openInvoicePrint(invoice, tenant, room, building, landlordName) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup blocked. Please allow popups for this site to print the bill.');
    return;
  }
  w.document.write(invoiceHTML(invoice, tenant, room, building, landlordName));
  w.document.close();
  w.focus();
}
