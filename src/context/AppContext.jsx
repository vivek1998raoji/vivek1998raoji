import React, { createContext, useState, useEffect } from 'react';
import {
  calcMonthlyCharges,
  applyPayment,
  isOpenInvoice,
  outstandingForTenant,
  recalcInvoice,
  round2,
} from '../lib/billing';
import { todayISO, addDays } from '../lib/format';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Try to load from local storage or use defaults
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem(key);
      if (saved && saved !== 'undefined' && saved !== 'null') {
         const parsed = JSON.parse(saved);
         return parsed || defaultVal;
      }
    } catch (e) {
      console.warn("Error parsing localStorage key:", key, e);
    }
    return defaultVal;
  };

  const [currentUser, setCurrentUser] = useState(loadState('currentUser', null));

  const [buildings, setBuildings] = useState(loadState('buildings', [
    { id: 'b1', name: 'Sunset Apartments', electricityRate: 8 }
  ]));

  const [rooms, setRooms] = useState(loadState('rooms', [
    { id: 'r1', buildingId: 'b1', roomNumber: '101', rentAmount: 15000, hasKitchen: true, status: 'occupied', currentMeterReading: 1200 },
    { id: 'r2', buildingId: 'b1', roomNumber: '102', rentAmount: 14000, hasKitchen: false, status: 'vacant', currentMeterReading: 800 }
  ]));

  const [tenants, setTenants] = useState(loadState('tenants', [
    { id: 't1', roomId: 'r1', name: 'Michael Smith', fatherName: 'Robert Smith', phone: '9876543210', whatsapp: '9876543210', password: '3210', docs: ['aadhar.pdf'], notes: 'Initial tenant', isActive: true, balancePending: 500, joinDate: '2026-01-15' }
  ]));

  const [invoices, setInvoices] = useState(loadState('invoices', [
    { id: 'inv1', tenantId: 't1', roomId: 'r1', month: 'March', year: 2026, baseRent: 15000, previousMeter: 1100, currentMeter: 1200, unitsUsed: 100, electricityBill: 800, waterBill: 200, otherCharges: 0, previousPending: 0, totalAmount: 16000, amountPaid: 15500, previousPendingCarry: 500, status: 'partially_paid', paymentMethod: 'UPI', createdAt: '2026-03-01', dueDate: '2026-03-08', payments: [{ amount: 15500, date: '2026-03-03', method: 'UPI' }] }
  ]));

  // Tenant-reported maintenance issues.
  const [maintenanceRequests, setMaintenanceRequests] = useState(loadState('maintenanceRequests', []));

  // Landlord sign-in details (changeable in Settings). Defaults to the
  // original hardcoded login until the landlord changes them.
  const [landlordCreds, setLandlordCreds] = useState(loadState('landlordCreds', { username: 'landlord', password: '123456' }));

  // Save to local storage on change
  // Removed currentUser auto-sync to avoid Vite ghost module memory leak
  useEffect(() => localStorage.setItem('buildings', JSON.stringify(buildings)), [buildings]);
  useEffect(() => localStorage.setItem('rooms', JSON.stringify(rooms)), [rooms]);
  useEffect(() => localStorage.setItem('tenants', JSON.stringify(tenants)), [tenants]);
  useEffect(() => localStorage.setItem('invoices', JSON.stringify(invoices)), [invoices]);
  useEffect(() => localStorage.setItem('maintenanceRequests', JSON.stringify(maintenanceRequests)), [maintenanceRequests]);
  useEffect(() => localStorage.setItem('landlordCreds', JSON.stringify(landlordCreds)), [landlordCreds]);

  // Actions
  const login = (phone, password) => {
    if (phone === landlordCreds.username && password === landlordCreds.password) {
      const u = { role: 'landlord', id: 'admin' };
      localStorage.setItem('currentUser', JSON.stringify(u));
      setCurrentUser(u);
      return u;
    }
    const tenant = tenants.find(t => t?.phone === phone && t?.password === password && t?.isActive);
    if (tenant) {
      const u = { role: 'tenant', id: tenant.id };
      localStorage.setItem('currentUser', JSON.stringify(u));
      setCurrentUser(u);
      return u;
    }
    return null;
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  // Change the landlord's own sign-in username and/or password.
  const updateLandlordCredentials = (username, password) => {
    setLandlordCreds({ username: String(username).trim(), password });
  };

  const addBuilding = (b) => {
    setBuildings([...buildings, { ...b, id: `b${Date.now()}`, electricityRate: Number(b.electricityRate) }]);
  };

  const updateBuilding = (id, updatedData) => {
    setBuildings(buildings.map(b => b.id === id ? { ...b, ...updatedData } : b));
  };

  const addRoom = (r) => {
    setRooms([...rooms, { ...r, id: `r${Date.now()}`, status: 'vacant', currentMeterReading: Number(r.currentMeterReading) || 0, rentAmount: Number(r.rentAmount) }]);
  };

  const updateRoom = (id, updatedData) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, ...updatedData } : r));
  };

  const addTenant = (t) => {
    // Generate Password: exactly the phone number
    const generatedPassword = t.phone;

    // Update old tenant if room was occupied
    const activeTenantInRoom = tenants.find(x => x.roomId === t.roomId && x.isActive);
    let updatedTenants = [...tenants];

    if (activeTenantInRoom) {
       updatedTenants = updatedTenants.map(x => x.id === activeTenantInRoom.id ? { ...x, isActive: false } : x);
    }

    const newTenant = {
      docs: [],
      ...t,
      id: `t${Date.now()}`,
      password: generatedPassword,
      isActive: true,
      balancePending: 0,
    };

    setTenants([...updatedTenants, newTenant]);
    setRooms(rooms.map(r => r.id === t.roomId ? { ...r, status: 'occupied' } : r));
  };

  const updateTenant = (id, updatedData) => {
    setTenants(tenants.map(t => t.id === id ? { ...t, ...updatedData } : t));
  };

  const updateTenantPassword = (id, newPassword) => {
    setTenants(tenants.map(t => t.id === id ? { ...t, password: newPassword } : t));
  };

  // Append uploaded document descriptors ({ name, dataUrl }) to a tenant.
  const addTenantDocs = (id, newDocs) => {
    if (!newDocs || newDocs.length === 0) return;
    setTenants(tenants.map(t =>
      t.id === id ? { ...t, docs: [...(t.docs || []), ...newDocs] } : t
    ));
  };

  const generateInvoice = (roomId, newMeterReading, waterBill, otherCharges, month, year) => {
    const room = rooms.find(r => r.id === roomId);
    const tenant = tenants.find(t => t.roomId === roomId && t.isActive);

    if (!room || !tenant) {
      return { error: 'No active tenant found for this room.' };
    }
    if (!month || String(month).trim() === '') {
      return { error: 'Please enter the billing month.' };
    }
    // Guard against issuing two invoices for the same tenant + month/year.
    const dupe = invoices.find(i =>
      i.tenantId === tenant.id && i.month === month && Number(i.year) === Number(year) &&
      i.status !== 'void' && i.status !== 'rolled_over'
    );
    if (dupe) {
      return { error: `An invoice for ${month} ${year} already exists for ${tenant.name}.` };
    }
    const building = buildings.find(b => b.id === room.buildingId);

    // Validated, pure charge calculation (excludes previous pending).
    const calc = calcMonthlyCharges({
      baseRent: room.rentAmount,
      prevMeter: room.currentMeterReading,
      newMeter: newMeterReading,
      electricityRate: building?.electricityRate,
      waterBill,
      otherCharges,
    });
    if (calc.error) return { error: calc.error };

    const prevPen = round2(tenant.balancePending);
    const totalAmount = round2(calc.charges + prevPen);
    const issued = todayISO();

    const invoice = {
      id: `inv${Date.now()}`,
      tenantId: tenant.id,
      roomId: room.id,
      month, year,
      baseRent: calc.baseRent,
      previousMeter: calc.prevMeter,
      currentMeter: calc.currentMeter,
      unitsUsed: calc.unitsUsed,
      electricityBill: calc.electricityBill,
      waterBill: calc.waterBill,
      otherCharges: calc.otherCharges,
      previousPending: prevPen,
      totalAmount,
      amountPaid: 0,
      previousPendingCarry: totalAmount, // Initial carry is total unpaid
      status: 'pending',
      createdAt: issued,
      dueDate: addDays(issued, 7),
      payments: [],
    };

    // Any of this tenant's still-open invoices have now been folded into the
    // new invoice's "previousPending", so close them out as rolled_over to
    // avoid double-counting the same debt across two invoices.
    setInvoices([
      ...invoices.map(inv =>
        inv.tenantId === tenant.id && isOpenInvoice(inv)
          ? { ...inv, status: 'rolled_over' }
          : inv
      ),
      invoice,
    ]);
    setRooms(rooms.map(r => r.id === roomId ? { ...r, currentMeterReading: calc.currentMeter } : r));
    setTenants(tenants.map(t => t.id === tenant.id ? { ...t, balancePending: invoice.previousPendingCarry } : t));
    return { invoice };
  };

  const submitPaymentRequest = (invoiceId, amount, method, screenshot = null) => {
    setInvoices(invoices.map(inv => {
      if (inv.id !== invoiceId) return inv;
      return { ...inv, status: 'payment_requested', requestedAmount: Number(amount), paymentMethod: method, paymentScreenshot: screenshot };
    }));
  };

  const acceptPayment = (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    // Accumulate this payment onto whatever was already paid (fixes losing an
    // earlier partial payment on the second installment).
    const result = applyPayment(invoice, invoice.requestedAmount);

    // Record this installment in the invoice's payment ledger, with a date.
    const ledgerEntry = {
      amount: round2(invoice.requestedAmount),
      date: todayISO(),
      method: invoice.paymentMethod || 'Cash',
    };

    const updatedInvoices = invoices.map(inv => {
      if (inv.id === invoiceId) {
        const { requestedAmount, ...rest } = inv; // clear the handled request
        return { ...rest, ...result, payments: [...(inv.payments || []), ledgerEntry] };
      }
      return inv;
    });

    setInvoices(updatedInvoices);
    setTenants(tenants.map(t => t.id === invoice.tenantId ? { ...t, balancePending: result.previousPendingCarry } : t));
  };

  // --- Landlord invoice corrections -----------------------------------

  // Edit the charge inputs of an existing invoice and re-derive its totals.
  const updateInvoice = (invoiceId, patch) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return { error: 'Invoice not found.' };
    const room = rooms.find(r => r.id === invoice.roomId);
    const building = buildings.find(b => b.id === room?.buildingId);

    const recomputed = recalcInvoice(invoice, patch, building?.electricityRate);
    if (recomputed.error) return { error: recomputed.error };

    const nextInvoices = invoices.map(i => i.id === invoiceId ? recomputed : i);
    setInvoices(nextInvoices);
    // If this is the tenant's open invoice, keep their carried balance in sync.
    if (isOpenInvoice(recomputed)) {
      setTenants(tenants.map(t => t.id === invoice.tenantId
        ? { ...t, balancePending: outstandingForTenant(nextInvoices, invoice.tenantId) }
        : t));
    }
    return { invoice: recomputed };
  };

  // Cancel an invoice without deleting the record (kept for audit).
  const voidInvoice = (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;
    const nextInvoices = invoices.map(i => i.id === invoiceId ? { ...i, status: 'void' } : i);
    setInvoices(nextInvoices);
    setTenants(tenants.map(t => t.id === invoice.tenantId
      ? { ...t, balancePending: outstandingForTenant(nextInvoices, invoice.tenantId) }
      : t));
  };

  // Permanently remove an invoice record.
  const deleteInvoice = (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;
    const nextInvoices = invoices.filter(i => i.id !== invoiceId);
    setInvoices(nextInvoices);
    setTenants(tenants.map(t => t.id === invoice.tenantId
      ? { ...t, balancePending: outstandingForTenant(nextInvoices, invoice.tenantId) }
      : t));
  };

  // --- Maintenance requests -------------------------------------------

  const addMaintenanceRequest = (tenantId, description) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant || !description || !String(description).trim()) return;
    const req = {
      id: `mr${Date.now()}`,
      tenantId,
      roomId: tenant.roomId,
      description: String(description).trim(),
      status: 'open',
      createdAt: todayISO(),
    };
    setMaintenanceRequests([req, ...maintenanceRequests]);
  };

  const updateMaintenanceRequest = (id, status) => {
    setMaintenanceRequests(maintenanceRequests.map(m => m.id === id ? { ...m, status } : m));
  };

  const deactivateTenant = (tenantId, leaveDate, finalMeter, additionalCharges) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;
    const room = rooms.find(r => r.id === tenant.roomId);

    let totalAmount = Number(tenant.balancePending) || 0;
    let currentM = Number(room?.currentMeterReading) || 0;

    if (room) {
      const building = buildings.find(b => b.id === room.buildingId);
      const elecRate = Number(building?.electricityRate) || 0;

      const prevM = Number(room.currentMeterReading) || 0;
      currentM = Number(finalMeter) > prevM ? Number(finalMeter) : prevM;
      const unitsUsed = currentM - prevM;
      const electricityBill = round2(unitsUsed * elecRate);
      const oCharges = Number(additionalCharges) || 0;
      const prevPen = Number(tenant.balancePending) || 0;

      totalAmount = round2(electricityBill + oCharges + prevPen);

      if (totalAmount > 0 || unitsUsed > 0) {
        const issued = todayISO();
        const invoice = {
          id: `inv${Date.now()}`,
          tenantId: tenant.id,
          roomId: room.id,
          month: 'FINAL', year: new Date().getFullYear(),
          baseRent: 0,
          previousMeter: prevM, currentMeter: currentM, unitsUsed,
          electricityBill, waterBill: 0, otherCharges: oCharges,
          previousPending: prevPen, totalAmount, amountPaid: 0,
          previousPendingCarry: totalAmount, status: 'pending',
          isFinalBill: true,
          createdAt: issued, dueDate: addDays(issued, 7), payments: [],
        };
        // Fold any still-open invoices into this final bill.
        setInvoices(prev => [
          ...prev.map(inv =>
            inv.tenantId === tenant.id && isOpenInvoice(inv)
              ? { ...inv, status: 'rolled_over' }
              : inv
          ),
          invoice,
        ]);
      }
      setRooms(rooms.map(r => r.id === room.id ? { ...r, status: 'vacant', currentMeterReading: currentM } : r));
    }

    setTenants(tenants.map(t => t.id === tenantId ? { ...t, isActive: false, leaveDate, balancePending: totalAmount } : t));
  };

  return (
    <AppContext.Provider value={{
      currentUser, login, logout,
      landlordCreds, updateLandlordCredentials,
      buildings, addBuilding, updateBuilding,
      rooms, addRoom, updateRoom,
      tenants, addTenant, updateTenant, updateTenantPassword, addTenantDocs, deactivateTenant,
      invoices, generateInvoice, submitPaymentRequest, acceptPayment,
      updateInvoice, voidInvoice, deleteInvoice,
      maintenanceRequests, addMaintenanceRequest, updateMaintenanceRequest,
    }}>
      {children}
    </AppContext.Provider>
  );
};
