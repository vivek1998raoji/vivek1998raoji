// Build a WhatsApp "click to chat" deep link with a pre-filled bill message.
// Nothing is sent automatically — this just opens WhatsApp with the text
// drafted, and the landlord presses send.
import { formatMoney, formatDate } from './format';

// Normalise a phone number to wa.me form (digits only, default +91 for
// bare 10-digit Indian numbers).
export const sanitizePhone = (num) => {
  const digits = String(num || '').replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  return digits;
};

export function buildBillMessage(invoice, tenant, room, building) {
  const lines = [
    `Hello ${tenant?.name || ''},`,
    ``,
    `Here is your rent bill for *${invoice.month} ${invoice.year}*:`,
    `Room: ${room?.roomNumber || '-'}${building ? ` (${building.name})` : ''}`,
    ``,
    `Rent: ${formatMoney(invoice.baseRent)}`,
    `Electricity (${invoice.unitsUsed} units): ${formatMoney(invoice.electricityBill)}`,
  ];
  if (Number(invoice.waterBill)) lines.push(`Water: ${formatMoney(invoice.waterBill)}`);
  if (Number(invoice.otherCharges)) lines.push(`Other: ${formatMoney(invoice.otherCharges)}`);
  if (Number(invoice.previousPending)) lines.push(`Previous pending: ${formatMoney(invoice.previousPending)}`);
  lines.push(
    `------------------------`,
    `*TOTAL: ${formatMoney(invoice.totalAmount)}*`,
  );
  if (Number(invoice.amountPaid)) lines.push(`Paid: ${formatMoney(invoice.amountPaid)}`);
  lines.push(`Balance due: ${formatMoney(invoice.previousPendingCarry)}`);
  if (invoice.dueDate) lines.push(``, `Due date: ${formatDate(invoice.dueDate)}`);
  lines.push(``, `Please pay via the tenant portal. Thank you!`);
  return lines.join('\n');
}

export function waLink(number, text) {
  return `https://wa.me/${sanitizePhone(number)}?text=${encodeURIComponent(text)}`;
}
