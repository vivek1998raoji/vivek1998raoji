import React, { createContext, useState, useEffect } from 'react';

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
    { id: 't1', roomId: 'r1', name: 'Michael Smith', fatherName: 'Robert Smith', phone: '9876543210', whatsapp: '9876543210', password: '3210', docs: ['aadhar.pdf'], notes: 'Initial tenant', isActive: true, balancePending: 500 }
  ]));

  const [invoices, setInvoices] = useState(loadState('invoices', [
    { id: 'inv1', tenantId: 't1', roomId: 'r1', month: 'March', year: 2026, baseRent: 15000, previousMeter: 1100, currentMeter: 1200, unitsUsed: 100, electricityBill: 800, waterBill: 200, otherCharges: 0, previousPending: 0, totalAmount: 16000, amountPaid: 15500, previousPendingCarry: 500, status: 'partially_paid', paymentMethod: 'UPI' }
  ]));

  // Save to local storage on change
  // Removed currentUser auto-sync to avoid Vite ghost module memory leak
  useEffect(() => localStorage.setItem('buildings', JSON.stringify(buildings)), [buildings]);
  useEffect(() => localStorage.setItem('rooms', JSON.stringify(rooms)), [rooms]);
  useEffect(() => localStorage.setItem('tenants', JSON.stringify(tenants)), [tenants]);
  useEffect(() => localStorage.setItem('invoices', JSON.stringify(invoices)), [invoices]);

  // Actions
  const login = (phone, password) => {
    if (phone === 'landlord' && password === '123456') {
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

  const generateInvoice = (roomId, newMeterReading, waterBill, otherCharges, month, year) => {
    const room = rooms.find(r => r.id === roomId);
    const building = buildings.find(b => b.id === room.buildingId);
    const tenant = tenants.find(t => t.roomId === roomId && t.isActive);

    if (!room || !tenant) return null;

    const currentM = Number(newMeterReading) || 0;
    const prevM = Number(room.currentMeterReading) || 0;
    const unitsUsed = currentM - prevM;
    const elecRate = Number(building.electricityRate) || 0;
    
    const electricityBill = unitsUsed * elecRate;
    const wBill = Number(waterBill) || 0;
    const oCharges = Number(otherCharges) || 0;
    const prevPen = Number(tenant.balancePending) || 0;
    const baseRent = Number(room.rentAmount) || 0;

    // Proper math execution
    const totalAmount = baseRent + electricityBill + wBill + oCharges + prevPen;

    const invoice = {
      id: `inv${Date.now()}`,
      tenantId: tenant.id,
      roomId: room.id,
      month, year,
      baseRent,
      previousMeter: prevM,
      currentMeter: currentM,
      unitsUsed,
      electricityBill,
      waterBill: wBill,
      otherCharges: oCharges,
      previousPending: prevPen,
      totalAmount,
      amountPaid: 0,
      previousPendingCarry: totalAmount, // Initial carry is total unpaid
      status: 'pending' 
    };

    setInvoices([...invoices, invoice]);
    setRooms(rooms.map(r => r.id === roomId ? { ...r, currentMeterReading: currentM } : r));
    setTenants(tenants.map(t => t.id === tenant.id ? { ...t, balancePending: invoice.previousPendingCarry } : t));
  };

  const submitPaymentRequest = (invoiceId, amount, method, screenshot = 'attached_receipt.jpg') => {
    setInvoices(invoices.map(inv => {
      if (inv.id !== invoiceId) return inv;
      return { ...inv, status: 'payment_requested', requestedAmount: Number(amount), paymentMethod: method, paymentScreenshot: screenshot };
    }));
  };

  const acceptPayment = (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;

    const paidAmount = Number(invoice.requestedAmount);
    let newCarry = Math.round((Number(invoice.totalAmount) - paidAmount) * 100) / 100;
    if (newCarry < 0.01) newCarry = 0; // Absolute clamp
    
    // Update invoice
    const updatedInvoices = invoices.map(inv => {
      if (inv.id === invoiceId) {
        return { 
          ...inv, 
          amountPaid: paidAmount, 
          previousPendingCarry: newCarry,
          status: newCarry > 0 ? 'partially_paid' : 'paid' 
        };
      }
      return inv;
    });

    setInvoices(updatedInvoices);
    setTenants(tenants.map(t => t.id === invoice.tenantId ? { ...t, balancePending: newCarry } : t));
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
      const electricityBill = unitsUsed * elecRate;
      const oCharges = Number(additionalCharges) || 0;
      const prevPen = Number(tenant.balancePending) || 0;
      
      totalAmount = electricityBill + oCharges + prevPen;

      if (totalAmount > 0 || unitsUsed > 0) {
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
          isFinalBill: true
        };
        setInvoices(prev => [...prev, invoice]);
      }
      setRooms(rooms.map(r => r.id === room.id ? { ...r, status: 'vacant', currentMeterReading: currentM } : r));
    }

    setTenants(tenants.map(t => t.id === tenantId ? { ...t, isActive: false, leaveDate, balancePending: totalAmount } : t));
  };

  return (
    <AppContext.Provider value={{
      currentUser, login, logout,
      buildings, addBuilding, updateBuilding,
      rooms, addRoom, updateRoom,
      tenants, addTenant, updateTenant, updateTenantPassword, deactivateTenant,
      invoices, generateInvoice, submitPaymentRequest, acceptPayment
    }}>
      {children}
    </AppContext.Provider>
  );
};
