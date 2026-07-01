// Plain Node test (no test framework needed): `npm test`
import { calcMonthlyCharges, applyPayment, outstandingForTenant, recalcInvoice } from './billing.js';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) { console.log('   got :', JSON.stringify(got)); console.log('   want:', JSON.stringify(want)); fail++; } else pass++;
};

// --- monthly charges ---
const c = calcMonthlyCharges({ baseRent: 15000, prevMeter: 1100, newMeter: 1200, electricityRate: 8, waterBill: 200, otherCharges: 0 });
eq('monthly charges total', c.charges, 16000);
eq('units used', c.unitsUsed, 100);
eq('electricity bill', c.electricityBill, 800);
eq('meter going down -> error', !!calcMonthlyCharges({ prevMeter: 1200, newMeter: 1100, electricityRate: 8 }).error, true);
eq('empty meter -> error', !!calcMonthlyCharges({ prevMeter: 0, newMeter: '', electricityRate: 8 }).error, true);

// --- payments: the previously-broken 2nd partial payment ---
let inv = { totalAmount: 16000, amountPaid: 0 };
const p1 = applyPayment(inv, 10000);
eq('1st partial paid', p1.amountPaid, 10000);
eq('1st partial carry', p1.previousPendingCarry, 6000);
eq('1st partial status', p1.status, 'partially_paid');

inv = { ...inv, ...p1 };            // landlord accepted 1st payment
const p2 = applyPayment(inv, 6000); // tenant pays the remaining 6000
eq('2nd partial cumulative paid', p2.amountPaid, 16000);
eq('2nd partial carry is ZERO (was the bug)', p2.previousPendingCarry, 0);
eq('2nd partial status paid', p2.status, 'paid');

// --- overpay is clamped ---
const o = applyPayment({ totalAmount: 1000, amountPaid: 0 }, 5000);
eq('overpay clamps paid', o.amountPaid, 1000);
eq('overpay carry 0', o.previousPendingCarry, 0);

// --- outstanding balance only counts open invoices ---
const invs = [
  { tenantId: 't1', status: 'paid', previousPendingCarry: 0 },
  { tenantId: 't1', status: 'rolled_over', previousPendingCarry: 5000 },
  { tenantId: 't1', status: 'partially_paid', previousPendingCarry: 6000 },
  { tenantId: 't1', status: 'void', previousPendingCarry: 9999 },
  { tenantId: 't2', status: 'pending', previousPendingCarry: 1000 },
];
eq('outstanding sums only open for tenant', outstandingForTenant(invs, 't1'), 6000);
eq('outstanding ignores other tenants', outstandingForTenant(invs, 't2'), 1000);

// --- editing an invoice re-derives electricity and preserves payments ---
const orig = {
  tenantId: 't1', baseRent: 15000, previousMeter: 1100, currentMeter: 1200,
  unitsUsed: 100, electricityBill: 800, waterBill: 200, otherCharges: 0,
  previousPending: 500, totalAmount: 16500, amountPaid: 6500,
  previousPendingCarry: 10000, status: 'partially_paid',
};
const edited = recalcInvoice(orig, { currentMeter: 1250, waterBill: 300 }, 8);
eq('edit re-derives units', edited.unitsUsed, 150);
eq('edit re-derives electricity', edited.electricityBill, 1200);
eq('edit recomputes total (rent+elec+water+prevPending)', edited.totalAmount, 17000);
eq('edit preserves amountPaid', edited.amountPaid, 6500);
eq('edit recomputes carry', edited.previousPendingCarry, 10500);
eq('edit meter below previous -> error', !!recalcInvoice(orig, { currentMeter: 1000 }, 8).error, true);

// editing an UNPAID invoice must stay 'pending', not flip to partially_paid
const unpaid = { ...orig, amountPaid: 0 };
eq('edit unpaid stays pending', recalcInvoice(unpaid, { waterBill: 300 }, 8).status, 'pending');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
