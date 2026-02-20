import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Church,
  Heart,
  Coins,
  Plus,
  Trash2,
  TrendingDown,
  PiggyBank,
  ArrowRight,
  Calculator,
  History,
  Check,
  RefreshCw,
  Cloud,
  Download
} from 'lucide-react';

import { storage } from './utils/storage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import InstallPrompt from './components/InstallPrompt';

const App = () => {
  // --- App State ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [data, setData] = useState({
    incomes: [],
    containers: [],
    expenses: []
  });

  // Derived state
  const incomes = data.incomes || [];
  const containers = data.containers || [];
  const expenses = data.expenses || [];

  // Form States
  const [newContainerName, setNewContainerName] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [allocationAmount, setAllocationAmount] = useState({});

  // Income Form States
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');

  // --- Initialization & Listeners ---
  useEffect(() => {
    // Initial load
    setData(storage.getData());

    // Subscribe to changes
    const unsubscribe = storage.subscribe((newData) => {
      setData(newData);
    });

    return () => unsubscribe();
  }, []);

  // --- Writers ---
  const addIncome = async (e) => {
    e.preventDefault();
    const amount = parseFloat(incomeAmount);
    if (!incomeSource || isNaN(amount)) return;

    setIsSyncing(true);
    try {
      await storage.addIncome({
        source: incomeSource,
        amount: amount,
        date: new Date().toLocaleDateString()
      });
      setIncomeSource('');
      setIncomeAmount('');
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteIncome = async (id) => {
    setIsSyncing(true);
    try {
      await storage.deleteIncome(id);
    } finally {
      setIsSyncing(false);
    }
  };

  const addContainer = async () => {
    if (!newContainerName.trim()) return;
    setIsSyncing(true);
    try {
      await storage.addContainer({
        name: newContainerName,
        balance: 0
      });
      setNewContainerName('');
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteContainer = async (id) => {
    setIsSyncing(true);
    try {
      await storage.deleteContainer(id);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateContainerBalance = async (id, amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return;

    setIsSyncing(true);
    try {
      const current = containers.find(c => c.id === id);
      await storage.updateContainer(id, {
        balance: (current?.balance || 0) + numAmount
      });
      setAllocationAmount(prev => ({ ...prev, [id]: '' }));
    } finally {
      setIsSyncing(false);
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (!expenseDesc || isNaN(amount)) return;

    setIsSyncing(true);
    try {
      await storage.addExpense({
        description: expenseDesc,
        amount: amount,
        date: new Date().toLocaleDateString()
      });
      setExpenseDesc('');
      setExpenseAmount('');
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteExpense = async (id) => {
    setIsSyncing(true);
    try {
      await storage.deleteExpense(id);
    } finally {
      setIsSyncing(false);
    }
  };

  const clearDeduction = async (type, amount) => {
    if (amount <= 0) return;
    setIsSyncing(true);
    try {
      const currentTithe = data.clearedTithe || 0;
      const currentOffering = data.clearedOffering || 0;
      const currentCharity = data.clearedCharity || 0;

      if (type === 'tithe') {
        await storage.updateClearedDeductions({ clearedTithe: currentTithe + amount });
      } else if (type === 'offering') {
        await storage.updateClearedDeductions({ clearedOffering: currentOffering + amount });
      } else if (type === 'charity') {
        await storage.updateClearedDeductions({ clearedCharity: currentCharity + amount });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // --- Calculations ---
  const totalIncome = useMemo(() =>
    incomes.reduce((acc, curr) => acc + curr.amount, 0),
    [incomes]);

  const totalTitheOwed = totalIncome * 0.10;
  const totalOfferingOwed = totalIncome * 0.10;
  const totalCharityOwed = totalIncome * 0.10;

  const tithe = Math.max(0, totalTitheOwed - (data.clearedTithe || 0));
  const offering = Math.max(0, totalOfferingOwed - (data.clearedOffering || 0));
  const charity = Math.max(0, totalCharityOwed - (data.clearedCharity || 0));

  const totalDeductions = totalTitheOwed + totalOfferingOwed + totalCharityOwed;

  const totalInContainers = useMemo(() =>
    containers.reduce((acc, curr) => acc + curr.balance, 0),
    [containers]);

  const totalExpenses = useMemo(() =>
    expenses.reduce((acc, curr) => acc + curr.amount, 0),
    [expenses]);

  const availableRemainder = totalIncome - totalDeductions - totalInContainers - totalExpenses;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val);
  };



  // ... (inside the App component)

  // --- Export Report ---
  const generateReport = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();

    // Title
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text("FundFlow Financial Report", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${date}`, 14, 28);

    // Summary Section
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Summary", 14, 40);

    autoTable(doc, {
      startY: 45,
      head: [['Category', 'Amount']],
      body: [
        ['Total Income', formatCurrency(totalIncome)],
        ['Total Expenses', formatCurrency(totalExpenses)],
        ['Savings Allocated', formatCurrency(totalInContainers)],
        ['Available Remainder', formatCurrency(availableRemainder)]
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Income Breakdown
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Income Breakdown", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Source', 'Amount']],
      body: incomes.length > 0
        ? incomes.map(inc => [inc.date, inc.source, formatCurrency(inc.amount)])
        : [['-', 'No income recorded', '-']],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] } // Emerald
    });

    // Savings Buckets
    finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Savings Buckets", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Bucket', 'Balance']],
      body: containers.length > 0
        ? containers.map(con => [con.name, formatCurrency(con.balance)])
        : [['-', 'No savings buckets', '-']],
      theme: 'striped',
      headStyles: { fillColor: [236, 72, 153] } // Pink
    });

    // Expenses
    finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Expense History", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Description', 'Amount']],
      body: expenses.length > 0
        ? expenses.sort((a, b) => b.createdAt - a.createdAt).map(exp => [exp.date, exp.description, `-${formatCurrency(exp.amount)}`])
        : [['-', 'No expenses recorded', '-']],
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] } // Red
    });

    // Save
    doc.save(`fundflow-report-${date.replace(/\//g, '-')}.pdf`);
  };




  // --- Backup & Restore ---
  const handleBackup = () => {
    const json = storage.exportData();
    const date = new Date().toLocaleDateString().replace(/\//g, '-');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fundflow-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const success = await storage.importData(event.target.result);
      if (success) {
        alert("Data restored successfully!");
        setData(storage.getData()); // Force refresh
      } else {
        alert("Failed to restore data. Invalid file format.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                FundFlow
              </h1>
              {isSyncing ? (
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> SAVING
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <Check className="w-3 h-3" /> SAVED LOCALLY
                </div>
              )}
              <InstallPrompt />
            </div>
            <p className="text-slate-500 text-sm mt-1">Local-first financial manager</p>
          </div>
          <div className="flex items-center gap-3 bg-blue-50 px-4 py-3 rounded-xl border border-blue-100">
            <Wallet className="text-blue-600 w-6 h-6" />
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Available Remainder</p>
              <p className={`text-xl font-bold ${availableRemainder < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {formatCurrency(availableRemainder)}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Column 1: Income & Mandatory Deductions */}
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-indigo-500" />
                <h2 className="font-bold text-lg text-slate-800">Income Entry</h2>
              </div>

              <form onSubmit={addIncome} className="space-y-3 mb-6">
                <input
                  type="text"
                  required
                  placeholder="Source (e.g. Salary, Freelance)"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={incomeSource}
                  onChange={(e) => setIncomeSource(e.target.value)}
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                    <input
                      type="number"
                      required
                      placeholder="Amount"
                      className="w-full pl-7 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={incomeAmount}
                      onChange={(e) => setIncomeAmount(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="px-4 py-2 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-600 transition-colors text-sm disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </form>

              {/* Income List */}
              <div className="space-y-2 mb-6 max-h-[150px] overflow-y-auto">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
                  <span>Source</span>
                  <span>Amount</span>
                </div>
                {incomes.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-2">No income logged yet.</p>
                )}
                {incomes.map(inc => (
                  <div key={inc.id} className="group flex justify-between items-center py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => deleteIncome(inc.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                        title="Delete income entry"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <span className="font-medium text-slate-700">{inc.source || 'Income'}</span>
                    </div>
                    <span className="font-bold text-slate-600">{formatCurrency(inc.amount)}</span>
                  </div>
                ))}

                {incomes.length > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-2">
                    <span className="text-sm font-bold text-slate-800">Total Income</span>
                    <span className="text-sm font-bold text-indigo-600">{formatCurrency(totalIncome)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-900">
                  <div className="flex items-center gap-2">
                    <Church className="w-4 h-4" />
                    <span className="text-sm font-medium">Tithe (10%)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{formatCurrency(tithe)}</span>
                    {tithe > 0 && (
                      <button onClick={() => clearDeduction('tithe', tithe)} disabled={isSyncing} className="text-xs font-bold text-amber-600 hover:text-amber-800 underline disabled:opacity-50">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-900">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    <span className="text-sm font-medium">Offering (10%)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{formatCurrency(offering)}</span>
                    {offering > 0 && (
                      <button onClick={() => clearDeduction('offering', offering)} disabled={isSyncing} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 underline disabled:opacity-50">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-900">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm font-medium">Charity (10%)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{formatCurrency(charity)}</span>
                    {charity > 0 && (
                      <button onClick={() => clearDeduction('charity', charity)} disabled={isSyncing} className="text-xs font-bold text-rose-600 hover:text-rose-800 underline disabled:opacity-50">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Stats */}
            <section className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white">
              <h3 className="text-indigo-100 text-sm font-semibold uppercase tracking-wider mb-4">Breakdown Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-indigo-500/50 pb-2">
                  <span className="text-sm">Mandatory Deductions</span>
                  <span className="font-semibold text-lg">{formatCurrency(totalDeductions)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-indigo-500/50 pb-2">
                  <span className="text-sm">Total Savings Allocated</span>
                  <span className="font-semibold text-lg">{formatCurrency(totalInContainers)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-indigo-500/50 pb-2">
                  <span className="text-sm">Total Expenses</span>
                  <span className="font-semibold text-lg">{formatCurrency(totalExpenses)}</span>
                </div>
              </div>
            </section>
          </div>

          {/* Column 2: Savings Containers */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-pink-500" />
                  <h2 className="font-bold text-lg text-slate-800">Savings Buckets</h2>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newContainerName}
                  onChange={(e) => setNewContainerName(e.target.value)}
                  placeholder="Bucket name (e.g. Car)"
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none text-sm"
                />
                <button
                  onClick={addContainer}
                  disabled={isSyncing}
                  className="p-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2">
                {containers.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm">No containers created yet.</p>
                  </div>
                )}
                {containers.map(container => (
                  <div key={container.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-slate-700">{container.name}</h4>
                        <p className="text-lg font-black text-pink-600">{formatCurrency(container.balance)}</p>
                      </div>
                      <button
                        onClick={() => deleteContainer(container.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-1 focus:ring-pink-400 outline-none"
                        value={allocationAmount[container.id] || ''}
                        onChange={(e) => setAllocationAmount({ ...allocationAmount, [container.id]: e.target.value })}
                      />
                      <button
                        onClick={() => updateContainerBalance(container.id, allocationAmount[container.id])}
                        disabled={isSyncing}
                        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        Add <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Column 3: Expense Tracker */}
          <div className="lg:col-span-1 space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <h2 className="font-bold text-lg text-slate-800">Expense Tracker</h2>
              </div>

              <form onSubmit={addExpense} className="space-y-3 mb-6">
                <input
                  type="text"
                  required
                  placeholder="What did you spend on?"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    placeholder="Amount"
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors text-sm disabled:opacity-50"
                  >
                    Log
                  </button>
                </div>
              </form>

              <div className="flex-1 overflow-y-auto max-h-[500px] pr-2">
                <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-bold uppercase tracking-widest">
                  <History className="w-3 h-3" />
                  Recent History
                </div>
                {expenses.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm">No expenses logged.</p>
                  </div>
                )}
                <div className="space-y-2">
                  {expenses.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(expense => (
                    <div key={expense.id} className="group flex justify-between items-center p-3 rounded-xl hover:bg-red-50 transition-all border border-transparent hover:border-red-100">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-700">{expense.description}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{expense.date}</p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className="font-bold text-red-600">-{formatCurrency(expense.amount)}</span>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

        </div>

        {/* Footer with Backup/Restore */}
        <footer className="text-center text-slate-400 text-sm py-8 space-y-4 border-t border-slate-200 mt-12 pt-8">
          <div className="flex items-center justify-center gap-2">
            <Cloud className="w-3 h-3" />
            <span>Local Storage Active</span>
          </div>
          <p className="font-medium">
            Data is saved to your browser's local storage.
            If you clear cookies or switch devices, data will be lost unless you back it up.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={generateReport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export PDF Report
            </button>

            <button
              onClick={handleBackup}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              Backup Data (JSON)
            </button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleRestore}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors pointer-events-none"
              >
                <RefreshCw className="w-4 h-4" />
                Restore Backup
              </button>
            </div>
          </div>

          <div className="text-[10px] text-slate-300 max-w-md mx-auto">
            <p>Note: Vercel Preview URLs (ending in .vercel.app) have separate storage from your main domain. Always use your production URL.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
