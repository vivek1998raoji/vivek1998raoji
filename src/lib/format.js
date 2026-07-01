// Small formatting / date helpers shared across the UI. Kept separate from
// billing.js so the billing math stays pure and framework-free.

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ₹ with Indian digit grouping, always 2 decimals.
export const formatMoney = (n) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Today as an ISO date string (YYYY-MM-DD), local time.
export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().split('T')[0];
};

// ISO date/datetime -> "01 Mar 2026". Returns the raw value if unparseable.
export const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const currentMonthName = () => MONTHS[new Date().getMonth()];
export const currentYear = () => new Date().getFullYear();

// Plain-English labels for invoice statuses (no jargon like "rolled over").
export const STATUS_LABELS = {
  pending: 'Not Paid',
  partially_paid: 'Part Paid',
  paid: 'Paid',
  payment_requested: 'Payment Claimed',
  rolled_over: 'Moved to New Bill',
  void: 'Cancelled',
};
export const statusLabel = (s) =>
  STATUS_LABELS[s] || String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Add N days to an ISO date, return ISO date string.
export const addDays = (iso, days) => {
  const d = iso ? new Date(iso) : new Date();
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().split('T')[0];
};

// Whole days between two dates (b - a), floored. Positive if b is later.
export const daysBetween = (aISO, bISO) => {
  const a = new Date(aISO);
  const b = bISO ? new Date(bISO) : new Date();
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
};
