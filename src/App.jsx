import React, { useState, useEffect, useMemo } from 'react';
import {
  House,
  ArrowDownLeft,
  PiggyBank,
  Receipt,
  HandHeart,
  Church,
  Coins,
  Heart,
  Plus,
  Minus,
  Trash2,
  Check,
  Download,
  Upload,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Plane,
  ArrowLeftRight
} from 'lucide-react';

import { storage } from './utils/storage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import InstallPrompt from './components/InstallPrompt';

const TABS = [
  { id: 'home', label: 'Overview', icon: House },
  { id: 'income', label: 'Income', icon: ArrowDownLeft },
  { id: 'buckets', label: 'Buckets', icon: PiggyBank },
  { id: 'spending', label: 'Spending', icon: Receipt }
];

// Currencies a travel wallet can hold (USD is the home currency)
const TRAVEL_CURRENCIES = [
  { code: 'ZAR', name: 'South African rand' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'BWP', name: 'Botswana pula' },
  { code: 'ZMW', name: 'Zambian kwacha' },
  { code: 'MZN', name: 'Mozambican metical' },
  { code: 'KES', name: 'Kenyan shilling' },
  { code: 'NGN', name: 'Nigerian naira' },
  { code: 'AED', name: 'UAE dirham' }
];

const formatMoney = (val, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol'
  }).format(val);

const currencySymbol = (currency) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0)
    .find(part => part.type === 'currency').value;

const fieldClass =
  'w-full h-12 px-4 bg-sunken border border-transparent rounded-xl text-base text-ink placeholder:text-faint outline-none focus:border-brand focus:bg-surface transition-colors';

const primaryButtonClass =
  'h-12 px-5 shrink-0 rounded-xl bg-brand text-on-brand text-sm font-semibold active:scale-[.97] transition-transform disabled:opacity-50';

// Two-tap button for actions that can't be undone: first tap arms, second confirms
const ConfirmButton = ({ onConfirm, armedLabel, className, armedClassName, disabled, children, ...rest }) => {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
      className={armed ? armedClassName : className}
      {...rest}
    >
      {armed ? armedLabel : children}
    </button>
  );
};

const DeleteButton = ({ onConfirm, label }) => (
  <ConfirmButton
    onConfirm={onConfirm}
    aria-label={label}
    armedLabel="Delete?"
    className="h-10 w-10 shrink-0 grid place-items-center rounded-full text-faint hover:text-spend active:bg-sunken transition-colors"
    armedClassName="h-8 px-3 shrink-0 rounded-full bg-spend text-canvas text-xs font-semibold"
  >
    <Trash2 className="w-4 h-4" />
  </ConfirmButton>
);

const SectionHeader = ({ icon: Icon, tone, title, children }) => (
  <div className="flex items-center justify-between gap-3 mb-5">
    <div className="flex items-center gap-3 min-w-0">
      <span className={`h-9 w-9 shrink-0 grid place-items-center rounded-full ${tone}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <h2 className="font-display text-xl text-ink truncate">{title}</h2>
    </div>
    {children}
  </div>
);

const MoneyInput = ({ className = '', symbol = '$', ...props }) => (
  <div className={`relative flex-1 min-w-0 ${className}`}>
    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none">{symbol}</span>
    <input
      type="number"
      inputMode="decimal"
      step="any"
      placeholder="0.00"
      className={`${fieldClass} ${symbol.length > 1 ? 'pl-14' : 'pl-8'} tnum`}
      {...props}
    />
  </div>
);

const EmptyState = ({ children }) => (
  <p className="text-center text-sm text-faint py-8">{children}</p>
);

const App = () => {
  // --- App State ---
  const [tab, setTab] = useState('home');
  const [toast, setToast] = useState('');
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
  const exchanges = data.exchanges || [];

  const sortedIncomes = useMemo(() =>
    [...incomes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [incomes]
  );

  const sortedExpenses = useMemo(() =>
    [...expenses].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [expenses]
  );

  // Form States
  const [newContainerName, setNewContainerName] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [allocationAmount, setAllocationAmount] = useState({});

  const [expenseCurrency, setExpenseCurrency] = useState('USD');

  // Exchange Form States
  const [exchangeMode, setExchangeMode] = useState('buy');
  const [exchangeCurrency, setExchangeCurrency] = useState('ZAR');
  const [exchangeUsd, setExchangeUsd] = useState('');
  const [exchangeForeign, setExchangeForeign] = useState('');

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

  const updateContainerBalance = async (id, amount, direction = 1) => {
    const numAmount = parseFloat(amount) * direction;
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
        date: new Date().toLocaleDateString(),
        // Expenses without a currency are USD
        ...(activeExpenseCurrency !== 'USD' && { currency: activeExpenseCurrency })
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

  const addExchange = async (e) => {
    e.preventDefault();
    const usd = parseFloat(exchangeUsd);
    const foreign = parseFloat(exchangeForeign);
    if (isNaN(usd) || isNaN(foreign) || usd <= 0 || foreign <= 0) return;

    // Changing money back to USD reverses the flow
    const direction = exchangeMode === 'buy' ? 1 : -1;

    setIsSyncing(true);
    try {
      await storage.addExchange({
        currency: exchangeCurrency,
        usdAmount: usd * direction,
        foreignAmount: foreign * direction,
        date: new Date().toLocaleDateString()
      });
      setExchangeUsd('');
      setExchangeForeign('');
      setExchangeMode('buy');
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteExchange = async (id) => {
    setIsSyncing(true);
    try {
      await storage.deleteExchange(id);
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

  const isForeign = (expense) => expense.currency && expense.currency !== 'USD';

  // Only USD expenses come out of the USD remainder; travel spending comes out of its wallet
  const totalExpenses = useMemo(() =>
    expenses.reduce((acc, curr) => isForeign(curr) ? acc : acc + curr.amount, 0),
    [expenses]);

  // One travel wallet per currency, derived from exchanges and spending in that currency
  const wallets = useMemo(() => {
    const byCurrency = {};
    const walletFor = (currency) => (byCurrency[currency] ||= {
      currency, bought: 0, paidUsd: 0, netForeign: 0, netUsd: 0, spent: 0, exchanges: []
    });

    exchanges.forEach(ex => {
      const wallet = walletFor(ex.currency);
      if (ex.foreignAmount > 0) {
        wallet.bought += ex.foreignAmount;
        wallet.paidUsd += ex.usdAmount;
      }
      wallet.netForeign += ex.foreignAmount;
      wallet.netUsd += ex.usdAmount;
      wallet.exchanges.push(ex);
    });
    expenses.filter(isForeign).forEach(exp => {
      walletFor(exp.currency).spent += exp.amount;
    });

    return Object.values(byCurrency).map(wallet => ({
      ...wallet,
      exchanges: wallet.exchanges.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
      balance: wallet.netForeign - wallet.spent,
      // Units of foreign currency per $1, averaged over everything bought
      rate: wallet.paidUsd > 0 ? wallet.bought / wallet.paidUsd : 0
    }));
  }, [exchanges, expenses]);

  const totalExchanged = wallets.reduce((acc, wallet) => acc + wallet.netUsd, 0);

  const toUsd = (amount, currency) => {
    const rate = wallets.find(w => w.currency === currency)?.rate;
    return rate ? amount / rate : null;
  };

  const expenseCurrencies = ['USD', ...wallets.map(w => w.currency)];
  const activeExpenseCurrency = expenseCurrencies.includes(expenseCurrency) ? expenseCurrency : 'USD';

  const availableRemainder = totalIncome - totalDeductions - totalInContainers - totalExpenses - totalExchanged;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val);
  };

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
        ...(wallets.length > 0 ? [['Exchanged to Travel Money', formatCurrency(totalExchanged)]] : []),
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
      body: sortedIncomes.length > 0
        ? sortedIncomes.map(inc => [inc.date, inc.source, formatCurrency(inc.amount)])
        : [['-', 'No income recorded', '-']],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] } // Emerald
    });

    // Mandatory Deductions
    finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Mandatory Deductions", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Deduction Category', 'Total Owed (10%)', 'Total Cleared', 'Remaining Owed']],
      body: [
        ['Tithe', formatCurrency(totalTitheOwed), formatCurrency(data.clearedTithe || 0), formatCurrency(tithe)],
        ['Offering', formatCurrency(totalOfferingOwed), formatCurrency(data.clearedOffering || 0), formatCurrency(offering)],
        ['Charity', formatCurrency(totalCharityOwed), formatCurrency(data.clearedCharity || 0), formatCurrency(charity)],
        ['Total Deductions', formatCurrency(totalDeductions), formatCurrency((data.clearedTithe || 0) + (data.clearedOffering || 0) + (data.clearedCharity || 0)), formatCurrency(tithe + offering + charity)]
      ],
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] } // Amber
    });

    // Savings Buckets
    finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Savings Buckets", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Bucket', 'Balance']],
      body: containers.length > 0
        ? containers.map(con => [con.name, formatCurrency(con.balance)])
        : [['No savings buckets', '-']],
      theme: 'striped',
      headStyles: { fillColor: [236, 72, 153] } // Pink
    });

    // Travel Money
    if (wallets.length > 0) {
      finalY = doc.lastAutoTable.finalY + 15;
      doc.text("Travel Money", 14, finalY);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Currency', 'USD Exchanged', 'Received', 'Spent', 'Balance']],
        body: wallets.map(w => [
          w.currency,
          formatCurrency(w.netUsd),
          formatMoney(w.netForeign, w.currency),
          formatMoney(w.spent, w.currency),
          formatMoney(w.balance, w.currency)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [20, 120, 110] } // Teal
      });
    }

    // Expenses
    finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Expense History", 14, finalY);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Description', 'Amount']],
      body: expenses.length > 0
        ? sortedExpenses.map(exp => [exp.date, exp.description, `-${formatMoney(exp.amount, exp.currency || 'USD')}`])
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
    if (!window.confirm('Replace everything currently in FundFlow with this backup?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const success = await storage.importData(event.target.result);
      if (success) {
        setToast('Backup restored');
        setData(storage.getData()); // Force refresh
      } else {
        setToast("Couldn't restore — that file isn't a FundFlow backup");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // --- View helpers ---
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // On phones only the active tab's sections show; on large screens everything does
  const showOn = (...tabs) => (tabs.includes(tab) ? '' : 'hidden lg:block');

  const [remainderWhole, remainderCents] = formatCurrency(availableRemainder).split('.');
  const isOverspent = availableRemainder < 0;

  const allocationBase = Math.max(
    totalIncome,
    totalDeductions + Math.max(0, totalInContainers) + totalExpenses + Math.max(0, totalExchanged)
  );
  const share = (value) => (allocationBase > 0 ? (Math.max(0, value) / allocationBase) * 100 : 0);

  const allocation = [
    { key: 'giving', label: 'Giving', value: totalDeductions, bar: 'bg-give-hi' },
    { key: 'saved', label: 'Saved', value: totalInContainers, bar: 'bg-save-hi' },
    { key: 'spent', label: 'Spent', value: totalExpenses, bar: 'bg-spend-hi' },
    ...(wallets.length > 0
      ? [{ key: 'travel', label: 'Travel', value: totalExchanged, bar: 'bg-travel-hi' }]
      : [])
  ];

  const giving = [
    { key: 'tithe', label: 'Tithe', icon: Church, owed: tithe, total: totalTitheOwed, cleared: data.clearedTithe || 0 },
    { key: 'offering', label: 'Offering', icon: Coins, owed: offering, total: totalOfferingOwed, cleared: data.clearedOffering || 0 },
    { key: 'charity', label: 'Charity', icon: Heart, owed: charity, total: totalCharityOwed, cleared: data.clearedCharity || 0 }
  ];

  const cardClass = 'bg-surface border border-line rounded-3xl p-5 lg:p-6';

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans">

      {/* App bar */}
      <header className="sticky top-0 z-20 bg-canvas/85 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto h-14 px-4 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display text-2xl tracking-tight text-ink">FundFlow</h1>
            <span
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted whitespace-nowrap"
              aria-live="polite"
            >
              {isSyncing ? (
                <>
                  <LoaderCircle className="w-3 h-3 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-brand" /> Saved locally
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {tab !== 'home' && (
              <button
                onClick={() => setTab('home')}
                className="lg:hidden h-9 px-3 rounded-full bg-surface border border-line text-sm font-semibold tnum"
                aria-label="Available remainder, go to overview"
              >
                <span className={isOverspent ? 'text-spend' : 'text-ink'}>
                  {formatCurrency(availableRemainder)}
                </span>
              </button>
            )}
            <InstallPrompt />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 pt-2 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-12 space-y-4 lg:space-y-6">

        {/* Hero: available remainder */}
        <section className={`${showOn('home')} bg-hero text-hero-ink rounded-[28px] p-6 lg:p-8`}>
          <div className="lg:flex lg:items-end lg:justify-between lg:gap-12">
            <div className="shrink-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-hero-ink/60">
                Available to spend
              </p>
              <p className={`font-display tnum mt-2 leading-none ${isOverspent ? 'text-spend-hi' : ''}`}>
                <span className="text-[44px] lg:text-6xl tracking-tight">{remainderWhole}</span>
                <span className="text-2xl lg:text-3xl text-hero-ink/60">.{remainderCents}</span>
              </p>
              <p className="text-sm text-hero-ink/60 mt-3">
                {totalIncome > 0
                  ? isOverspent
                    ? `Over by ${formatCurrency(Math.abs(availableRemainder))} of ${formatCurrency(totalIncome)} income`
                    : `of ${formatCurrency(totalIncome)} income`
                  : 'Add your first income to get started'}
              </p>
            </div>

            <div className="mt-6 lg:mt-0 lg:flex-1 lg:max-w-xl">
              {/* Where the money went */}
              <div
                className="flex h-2.5 rounded-full overflow-hidden bg-hero-ink/15 gap-[2px]"
                role="img"
                aria-label={allocation.map(a => `${a.label} ${formatCurrency(a.value)}`).join(', ')}
              >
                {allocation.map(a => share(a.value) > 0 && (
                  <div key={a.key} className={`${a.bar} h-full`} style={{ width: `${share(a.value)}%` }} />
                ))}
              </div>
              <dl className={`grid gap-x-3 gap-y-4 mt-4 ${allocation.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                {allocation.map(a => (
                  <div key={a.key}>
                    <dt className="flex items-center gap-1.5 text-xs text-hero-ink/60">
                      <span className={`w-2 h-2 rounded-full ${a.bar}`} />
                      {a.label}
                    </dt>
                    <dd className="text-[15px] font-semibold tnum mt-1">{formatCurrency(a.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {wallets.length > 0 && (
            <div className="mt-6 pt-4 border-t border-hero-ink/15 space-y-3">
              {wallets.map(wallet => (
                <button
                  key={wallet.currency}
                  onClick={() => setTab('buckets')}
                  className="w-full flex items-center justify-between gap-3 text-left lg:cursor-default"
                >
                  <span className="flex items-center gap-2 text-sm text-hero-ink/60">
                    <Plane className="w-4 h-4 text-travel-hi" />
                    {wallet.currency} wallet
                  </span>
                  <span className="text-right tnum">
                    <span className={`text-[15px] font-semibold ${wallet.balance < 0 ? 'text-spend-hi' : ''}`}>
                      {formatMoney(wallet.balance, wallet.currency)} left
                    </span>
                    {wallet.rate > 0 && (
                      <span className="text-xs text-hero-ink/60 ml-2">
                        ≈ {formatCurrency(wallet.balance / wallet.rate)}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-start">

          {/* Column 1: Income & Giving */}
          <div className={`${showOn('home', 'income')} space-y-4 lg:space-y-6`}>
            <section className={`${showOn('income')} ${cardClass}`}>
              <SectionHeader icon={ArrowDownLeft} tone="bg-brand/10 text-brand" title="Income">
                {sortedIncomes.length > 0 && (
                  <span className="text-sm font-semibold text-brand tnum">{formatCurrency(totalIncome)}</span>
                )}
              </SectionHeader>

              <form onSubmit={addIncome} className="space-y-2 mb-6">
                <input
                  type="text"
                  required
                  placeholder="Source (e.g. Salary, Freelance)"
                  aria-label="Income source"
                  className={fieldClass}
                  value={incomeSource}
                  onChange={(e) => setIncomeSource(e.target.value)}
                />
                <div className="flex gap-2">
                  <MoneyInput
                    required
                    aria-label="Income amount"
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                  />
                  <button type="submit" disabled={isSyncing} className={primaryButtonClass}>
                    Add
                  </button>
                </div>
              </form>

              {sortedIncomes.length === 0 ? (
                <EmptyState>No income logged yet.</EmptyState>
              ) : (
                <ul className="divide-y divide-line lg:max-h-[320px] lg:overflow-y-auto overflow-x-hidden pr-2">
                  {sortedIncomes.map(inc => (
                    <li key={inc.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-ink truncate">{inc.source || 'Income'}</p>
                        <p className="text-xs text-faint mt-0.5">{inc.date}</p>
                      </div>
                      <div className="flex items-center gap-1 -mr-2">
                        <span className="text-[15px] font-semibold text-ink tnum">{formatCurrency(inc.amount)}</span>
                        <DeleteButton onConfirm={() => deleteIncome(inc.id)} label={`Delete income ${inc.source || ''}`} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`${showOn('home')} ${cardClass}`}>
              <SectionHeader icon={HandHeart} tone="bg-give/10 text-give" title="Giving">
                <span className="text-xs text-muted">10% each</span>
              </SectionHeader>

              <ul className="space-y-5">
                {giving.map(({ key, label, icon: Icon, owed, total, cleared }) => (
                  <li key={key}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="w-[18px] h-[18px] text-give shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-ink">{label}</p>
                          <p className="text-xs text-faint mt-0.5 tnum truncate">
                            {formatCurrency(Math.min(cleared, total))} paid
                          </p>
                        </div>
                      </div>
                      {owed > 0 ? (
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[15px] font-semibold text-ink tnum">{formatCurrency(owed)}</span>
                          <ConfirmButton
                            onConfirm={() => clearDeduction(key, owed)}
                            disabled={isSyncing}
                            armedLabel="Confirm"
                            className="h-9 px-3 rounded-full border border-give/40 text-give text-xs font-semibold active:bg-give/10 disabled:opacity-50"
                            armedClassName="h-9 px-3 rounded-full bg-give text-canvas text-xs font-semibold"
                          >
                            Mark paid
                          </ConfirmButton>
                        </div>
                      ) : total > 0 ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-brand shrink-0">
                          <Check className="w-3.5 h-3.5" /> Paid
                        </span>
                      ) : (
                        <span className="text-[15px] text-faint tnum shrink-0">{formatCurrency(0)}</span>
                      )}
                    </div>
                    <div className="h-1 rounded-full bg-sunken mt-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-give transition-[width] duration-500"
                        style={{ width: `${total > 0 ? Math.min(100, (cleared / total) * 100) : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Column 2: Savings Buckets */}
          <div className={`${showOn('buckets')} space-y-4 lg:space-y-6`}>
          <section className={cardClass}>
            <SectionHeader icon={PiggyBank} tone="bg-save/10 text-save" title="Buckets">
              {containers.length > 0 && (
                <span className="text-sm font-semibold text-save tnum">{formatCurrency(totalInContainers)}</span>
              )}
            </SectionHeader>

            <form
              onSubmit={(e) => { e.preventDefault(); addContainer(); }}
              className="flex gap-2 mb-6"
            >
              <input
                type="text"
                value={newContainerName}
                onChange={(e) => setNewContainerName(e.target.value)}
                placeholder="New bucket (e.g. Car)"
                aria-label="New bucket name"
                className={fieldClass}
              />
              <button
                type="submit"
                disabled={isSyncing}
                aria-label="Create bucket"
                className="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-save text-canvas active:scale-[.97] transition-transform disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>

            {containers.length === 0 ? (
              <EmptyState>No buckets yet. Create one to start setting money aside.</EmptyState>
            ) : (
              <ul className="space-y-3 lg:max-h-[560px] lg:overflow-y-auto">
                {containers.map(container => (
                  <li key={container.id} className="p-4 rounded-2xl bg-canvas border border-line">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-muted truncate">{container.name}</h3>
                        <p className="font-display text-[28px] leading-tight text-ink tnum mt-0.5">
                          {formatCurrency(container.balance)}
                        </p>
                      </div>
                      <DeleteButton onConfirm={() => deleteContainer(container.id)} label={`Delete bucket ${container.name}`} />
                    </div>
                    <div className="flex gap-2 mt-3">
                      <MoneyInput
                        aria-label={`Amount for ${container.name}`}
                        value={allocationAmount[container.id] || ''}
                        onChange={(e) => setAllocationAmount({ ...allocationAmount, [container.id]: e.target.value })}
                      />
                      <button
                        onClick={() => updateContainerBalance(container.id, allocationAmount[container.id], -1)}
                        disabled={isSyncing}
                        aria-label={`Take out of ${container.name}`}
                        className="h-12 w-12 shrink-0 grid place-items-center rounded-xl border border-line bg-surface text-ink active:scale-[.97] transition-transform disabled:opacity-50"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateContainerBalance(container.id, allocationAmount[container.id])}
                        disabled={isSyncing}
                        aria-label={`Add to ${container.name}`}
                        className="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-ink text-canvas active:scale-[.97] transition-transform disabled:opacity-50"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Travel money: USD exchanged into a foreign-currency wallet */}
          <section className={cardClass}>
            <SectionHeader icon={Plane} tone="bg-travel/10 text-travel" title="Travel money">
              {wallets.length > 0 && (
                <span className="text-sm font-semibold text-travel tnum">{formatCurrency(totalExchanged)}</span>
              )}
            </SectionHeader>

            <form onSubmit={addExchange} className="space-y-2 mb-6">
              <div className="flex p-1 rounded-xl bg-sunken" role="group" aria-label="Exchange direction">
                {[['buy', 'Exchange USD'], ['back', 'Change back']].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setExchangeMode(mode)}
                    aria-pressed={exchangeMode === mode}
                    className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${exchangeMode === mode ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <select
                value={exchangeCurrency}
                onChange={(e) => setExchangeCurrency(e.target.value)}
                aria-label="Travel currency"
                className={fieldClass}
              >
                {TRAVEL_CURRENCIES.map(({ code, name }) => (
                  <option key={code} value={code}>{code} · {name}</option>
                ))}
              </select>

              <div className={`flex gap-2 ${exchangeMode === 'back' ? 'flex-row-reverse' : ''}`}>
                <label className="flex-1 min-w-0">
                  <span className="block text-xs text-muted mb-1 ml-1">
                    {exchangeMode === 'buy' ? 'You gave' : 'You got'}
                  </span>
                  <MoneyInput
                    required
                    value={exchangeUsd}
                    onChange={(e) => setExchangeUsd(e.target.value)}
                  />
                </label>
                <label className="flex-1 min-w-0">
                  <span className="block text-xs text-muted mb-1 ml-1">
                    {exchangeMode === 'buy' ? 'You got' : 'You gave'}
                  </span>
                  <MoneyInput
                    required
                    symbol={currencySymbol(exchangeCurrency)}
                    value={exchangeForeign}
                    onChange={(e) => setExchangeForeign(e.target.value)}
                  />
                </label>
              </div>

              <button type="submit" disabled={isSyncing} className={`${primaryButtonClass} w-full flex items-center justify-center gap-2`}>
                <ArrowLeftRight className="w-4 h-4" />
                {exchangeMode === 'buy' ? 'Record exchange' : 'Record change back'}
              </button>
            </form>

            {wallets.length === 0 ? (
              <EmptyState>Changed money for a trip? Record it here, then log spending from that wallet.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {wallets.map(wallet => (
                  <li key={wallet.currency} className="p-4 rounded-2xl bg-canvas border border-line">
                    <h3 className="text-sm font-medium text-muted">{wallet.currency} wallet</h3>
                    <p className={`font-display text-[28px] leading-tight tnum mt-0.5 ${wallet.balance < 0 ? 'text-spend' : 'text-ink'}`}>
                      {formatMoney(wallet.balance, wallet.currency)}
                    </p>
                    <p className="text-xs text-faint mt-1 tnum">
                      {wallet.rate > 0 && `≈ ${formatCurrency(wallet.balance / wallet.rate)} · ${formatMoney(wallet.rate, wallet.currency)} per $1 · `}
                      {formatMoney(wallet.spent, wallet.currency)} spent
                    </p>

                    {wallet.exchanges.length > 0 && (
                      <ul className="divide-y divide-line border-t border-line mt-3">
                        {wallet.exchanges.map(ex => (
                          <li key={ex.id} className="flex items-center justify-between gap-2 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink tnum truncate">
                                {ex.foreignAmount > 0
                                  ? `${formatCurrency(ex.usdAmount)} → ${formatMoney(ex.foreignAmount, ex.currency)}`
                                  : `${formatMoney(-ex.foreignAmount, ex.currency)} → ${formatCurrency(-ex.usdAmount)}`}
                              </p>
                              <p className="text-xs text-faint mt-0.5">
                                {ex.date}{ex.foreignAmount < 0 && ' · changed back'}
                              </p>
                            </div>
                            <div className="-mr-2">
                              <DeleteButton onConfirm={() => deleteExchange(ex.id)} label="Delete exchange" />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>

          {/* Column 3: Expense Tracker */}
          <section className={`${showOn('spending')} ${cardClass}`}>
            <SectionHeader icon={Receipt} tone="bg-spend/10 text-spend" title="Spending">
              {sortedExpenses.length > 0 && (
                <span className="text-sm font-semibold text-spend tnum">{formatCurrency(totalExpenses)}</span>
              )}
            </SectionHeader>

            <form onSubmit={addExpense} className="space-y-2 mb-6">
              {expenseCurrencies.length > 1 && (
                <div className="flex p-1 rounded-xl bg-sunken" role="group" aria-label="Pay from">
                  {expenseCurrencies.map(code => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setExpenseCurrency(code)}
                      aria-pressed={activeExpenseCurrency === code}
                      className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${activeExpenseCurrency === code ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
                    >
                      {code === 'USD' ? 'USD' : `${code} wallet`}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text"
                required
                placeholder="What did you spend on?"
                aria-label="Expense description"
                className={fieldClass}
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <MoneyInput
                  required
                  symbol={currencySymbol(activeExpenseCurrency)}
                  aria-label="Expense amount"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
                <button type="submit" disabled={isSyncing} className={primaryButtonClass}>
                  Log
                </button>
              </div>
            </form>

            {sortedExpenses.length === 0 ? (
              <EmptyState>No expenses logged.</EmptyState>
            ) : (
              <ul className="divide-y divide-line lg:max-h-[560px] lg:overflow-y-auto overflow-x-hidden pr-2">
                {sortedExpenses.map(expense => (
                  <li key={expense.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-ink truncate">{expense.description}</p>
                      <p className="text-xs text-faint mt-0.5 tnum">
                        {expense.date}
                        {isForeign(expense) && toUsd(expense.amount, expense.currency) !== null &&
                          ` · ≈ ${formatCurrency(toUsd(expense.amount, expense.currency))}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 -mr-2">
                      <span className={`text-[15px] font-semibold tnum ${isForeign(expense) ? 'text-travel' : 'text-spend'}`}>
                        -{formatMoney(expense.amount, expense.currency || 'USD')}
                      </span>
                      <DeleteButton onConfirm={() => deleteExpense(expense.id)} label={`Delete expense ${expense.description}`} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Data: report, backup, restore */}
        <section className={`${showOn('home')} ${cardClass}`}>
          <SectionHeader icon={ShieldCheck} tone="bg-sunken text-muted" title="Your data" />
          <p className="text-sm text-muted -mt-2 mb-5 max-w-2xl">
            Everything is stored in this browser only. Clearing site data or switching devices
            will lose it, so keep a backup.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleBackup}
              className="h-12 px-4 flex items-center justify-center gap-2 rounded-xl bg-ink text-canvas text-sm font-semibold active:scale-[.98] transition-transform"
            >
              <Download className="w-4 h-4" />
              Back up data
            </button>

            <label className="h-12 px-4 flex items-center justify-center gap-2 rounded-xl border border-line bg-surface text-ink text-sm font-semibold cursor-pointer active:scale-[.98] transition-transform focus-within:border-brand">
              <Upload className="w-4 h-4" />
              Restore backup
              <input type="file" accept=".json" onChange={handleRestore} className="sr-only" />
            </label>

            <button
              onClick={generateReport}
              className="h-12 px-4 flex items-center justify-center gap-2 rounded-xl border border-line bg-surface text-ink text-sm font-semibold active:scale-[.98] transition-transform"
            >
              <FileText className="w-4 h-4" />
              Export PDF report
            </button>
          </div>

          <p className="text-xs text-faint mt-4">
            Vercel preview URLs (ending in .vercel.app) keep separate storage from your main domain. Always use your production URL.
          </p>
        </section>
      </main>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed z-40 left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-8 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-2xl bg-ink text-canvas text-sm font-medium shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* Bottom tab bar (phones) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/90 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 max-w-md mx-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => { setTab(id); window.scrollTo(0, 0); }}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 pt-2 pb-2 text-[11px] font-medium transition-colors ${active ? 'text-brand' : 'text-faint'}`}
              >
                <span className={`h-8 w-14 grid place-items-center rounded-full transition-colors ${active ? 'bg-brand/10' : ''}`}>
                  <Icon className="w-5 h-5" />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default App;
