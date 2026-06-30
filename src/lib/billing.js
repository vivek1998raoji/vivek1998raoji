// Pure billing/payment math. No React, no storage — easy to test and to
// reuse on the backend later. All money is rounded to 2 decimals.

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const STATUS = {
  PENDING: 'pending',
  PARTIAL: 'partially_paid',
  PAID: 'paid',
  ROLLED_OVER: 'rolled_over', // balance folded into a newer invoice
};

export const OPEN_STATUSES = [STATUS.PENDING, STATUS.PARTIAL];

// An invoice is "open" (still owed) only while pending or partially paid.
// Rolled-over and paid invoices must NOT count toward outstanding balance.
export const isOpenInvoice = (inv) => OPEN_STATUSES.includes(inv?.status);

/**
 * Compute the charge fields for a monthly invoice (excludes any previous
 * pending balance). Returns { error } when the meter reading is invalid.
 */
export function calcMonthlyCharges({
  baseRent,
  prevMeter,
  newMeter,
  electricityRate,
  waterBill = 0,
  otherCharges = 0,
}) {
  const prevM = Number(prevMeter) || 0;

  if (newMeter === '' || newMeter === null || newMeter === undefined) {
    return { error: 'Please enter the new meter reading.' };
  }
  const currM = Number(newMeter);
  if (!Number.isFinite(currM)) {
    return { error: 'Please enter a valid meter reading.' };
  }
  if (currM < prevM) {
    return {
      error: `New meter reading (${currM}) cannot be less than the previous reading (${prevM}).`,
    };
  }

  const water = Math.max(0, Number(waterBill) || 0);
  const other = Math.max(0, Number(otherCharges) || 0);
  const rent = Math.max(0, Number(baseRent) || 0);
  const unitsUsed = currM - prevM;
  const electricityBill = round2(unitsUsed * Math.max(0, Number(electricityRate) || 0));
  const charges = round2(rent + electricityBill + water + other);

  return {
    unitsUsed,
    electricityBill,
    waterBill: water,
    otherCharges: other,
    baseRent: rent,
    prevMeter: prevM,
    currentMeter: currM,
    charges, // rent + electricity + water + other (no previous pending)
  };
}

/**
 * Apply a payment of `amount` to `invoice`, accumulating onto any amount
 * already paid. Fixes the bug where a second partial payment recomputed the
 * balance from the original total and lost the earlier payment.
 */
export function applyPayment(invoice, amount) {
  const total = round2(invoice?.totalAmount);
  const alreadyPaid = round2(invoice?.amountPaid);
  const thisPayment = Math.max(0, round2(amount));

  let amountPaid = round2(alreadyPaid + thisPayment);
  if (amountPaid > total) amountPaid = total; // never over-pay an invoice

  let carry = round2(total - amountPaid);
  if (carry < 0.01) carry = 0; // clamp floating dust

  return {
    amountPaid,
    previousPendingCarry: carry,
    status: carry > 0 ? STATUS.PARTIAL : STATUS.PAID,
  };
}

export { STATUS };
