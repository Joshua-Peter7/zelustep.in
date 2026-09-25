import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Trash2, 
  PieChart, 
  BarChart3, 
  X,
  CreditCard,
  Search,
  Filter,
  ArrowUpDown,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api';
import { getLocalDateString } from '../utils/dateUtils';

// Format currency into Indian Rupees (INR ₹) with en-IN numbering format
export function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  const num = Number(val);
  const formatted = Math.abs(num).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
  return `₹${formatted}`;
}

export default function MoneyDashboard({ user, onShowToast }) {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState('monthly');
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Filters, Search & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [txFilter, setTxFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');

  // Form State
  const [txType, setTxType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food & Groceries');
  const [txDate, setTxDate] = useState(() => getLocalDateString());
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI (GPay, PhonePe)');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expenseCategories = [
    'Food & Groceries',
    'Rent & Housing',
    'Software & Subscriptions',
    'Utilities & Bills',
    'Travel & Transport',
    'Healthcare & Medical',
    'Shopping & Personal',
    'EMI & Loan Repayment',
    'Office & Equipment',
    'Miscellaneous Expense'
  ];

  const incomeCategories = [
    'Salary & Compensation',
    'Client Invoices & Freelance',
    'Investments & Dividends',
    'Business / Product Revenue',
    'Consulting',
    'Other Income'
  ];

  const allPaymentMethods = [
    'UPI (GPay, PhonePe)',
    'Net Banking (IMPS/NEFT)',
    'Debit / Credit Card',
    'Bank Transfer',
    'Cash',
    'Cheque / DD'
  ];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    fetchFinancialData();
  }, [selectedYear, selectedMonth, user]);

  async function fetchFinancialData(yr = selectedYear) {
    setLoading(true);
    try {
      // Fetch full year data so monthly, overview cards, and annual comparison stay 100% in sync
      const txData = await api.finance.getTransactions(yr, null, 'all');
      setTransactions(txData || []);
    } catch (err) {
      console.error('Failed to load finance data:', err);
      onShowToast('Could not load financial records', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTransaction(e) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !category || !txDate) return;

    setIsSubmitting(true);
    try {
      await api.finance.createTransaction({
        type: txType,
        amount: Number(amount),
        category,
        transaction_date: txDate,
        description: description.trim(),
        payment_method: paymentMethod
      });

      onShowToast(
        txType === 'income' 
          ? `Recorded income: ₹${Number(amount).toLocaleString('en-IN')}` 
          : `Recorded expense: ₹${Number(amount).toLocaleString('en-IN')}`, 
        'success'
      );

      setAmount('');
      setDescription('');
      setShowAddModal(false);

      // Auto-align selected month/year to transaction date so the new entry displays immediately
      const dateParts = String(txDate).split('-');
      const entryYear = parseInt(dateParts[0], 10);
      const entryMonth = parseInt(dateParts[1], 10);
      if (entryYear && (entryYear !== selectedYear || entryMonth !== selectedMonth)) {
        setSelectedYear(entryYear);
        setSelectedMonth(entryMonth);
        await fetchFinancialData(entryYear);
      } else {
        await fetchFinancialData(selectedYear);
      }
    } catch (err) {
      onShowToast(err.message || 'Failed to record transaction', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.finance.deleteTransaction(id);
      onShowToast('Transaction deleted', 'info');
      await fetchFinancialData(selectedYear);
    } catch (err) {
      onShowToast('Failed to delete transaction', 'error');
    }
  }

  // Monthly breakdown for selected month
  const monthString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const dStr = String(t.transaction_date || '').split('T')[0];
      return dStr.startsWith(monthString);
    });
  }, [transactions, monthString]);

  // Yearly breakdown for selected year
  const currentYearTransactions = useMemo(() => {
    return transactions.filter(t => {
      const dStr = String(t.transaction_date || '').split('T')[0];
      return dStr.startsWith(`${selectedYear}`);
    });
  }, [transactions, selectedYear]);

  // Live Overview Metrics for selected month (guaranteed 100% sync)
  const monthlyMetrics = useMemo(() => {
    const received = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const spent = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const saved = received - spent;
    const savingsRate = received > 0 ? Math.round((saved / received) * 100) : 0;
    return {
      received,
      spent,
      saved,
      savingsRate,
      count: currentMonthTransactions.length
    };
  }, [currentMonthTransactions]);

  // Live Overview Metrics for selected year (guaranteed 100% sync)
  const yearlyMetrics = useMemo(() => {
    const received = currentYearTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const spent = currentYearTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const saved = received - spent;
    const savingsRate = received > 0 ? Math.round((saved / received) * 100) : 0;
    return {
      received,
      spent,
      saved,
      savingsRate
    };
  }, [currentYearTransactions]);

  // Live 12-Month Performance Trend for Annual Comparison
  const monthlyTrend = useMemo(() => {
    return monthNames.map((name, idx) => {
      const mNum = idx + 1;
      const mStr = `${selectedYear}-${String(mNum).padStart(2, '0')}`;
      const mItems = currentYearTransactions.filter(t => {
        const dStr = String(t.transaction_date || '').split('T')[0];
        return dStr.startsWith(mStr);
      });
      const rec = mItems.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const sp = mItems.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return {
        monthNumber: mNum,
        monthName: name.slice(0, 3),
        fullMonthName: name,
        received: rec,
        spent: sp,
        saved: rec - sp
      };
    });
  }, [currentYearTransactions, selectedYear]);

  // Dynamic set of all categories
  const allCategories = useMemo(() => {
    const set = new Set([...incomeCategories, ...expenseCategories]);
    transactions.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [transactions]);

  // Filtered & Sorted Transactions for Ledger
  const filteredAndSortedTransactions = useMemo(() => {
    let list = [...currentMonthTransactions];

    // 1. Type
    if (txFilter === 'income') list = list.filter(t => t.type === 'income');
    else if (txFilter === 'expense') list = list.filter(t => t.type === 'expense');

    // 2. Category
    if (categoryFilter !== 'all') {
      list = list.filter(t => t.category === categoryFilter);
    }

    // 3. Payment Method
    if (methodFilter !== 'all') {
      list = list.filter(t => t.payment_method === methodFilter);
    }

    // 4. Search Query (description, category, method, amount, date)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => {
        const desc = (t.description || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();
        const meth = (t.payment_method || '').toLowerCase();
        const amt = String(t.amount || '');
        const date = String(t.transaction_date || '').toLowerCase();
        return desc.includes(q) || cat.includes(q) || meth.includes(q) || amt.includes(q) || date.includes(q);
      });
    }

    // 5. Sorting
    list.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.transaction_date) - new Date(a.transaction_date);
      if (sortBy === 'date_asc') return new Date(a.transaction_date) - new Date(b.transaction_date);
      if (sortBy === 'amount_desc') return Number(b.amount) - Number(a.amount);
      if (sortBy === 'amount_asc') return Number(a.amount) - Number(b.amount);
      if (sortBy === 'category_asc') return (a.category || '').localeCompare(b.category || '');
      if (sortBy === 'description_asc') return (a.description || '').localeCompare(b.description || '');
      return 0;
    });

    return list;
  }, [currentMonthTransactions, txFilter, categoryFilter, methodFilter, searchQuery, sortBy]);

  const hasActiveFilters = txFilter !== 'all' || categoryFilter !== 'all' || methodFilter !== 'all' || searchQuery.trim() !== '' || sortBy !== 'date_desc';

  function handleResetFilters() {
    setTxFilter('all');
    setCategoryFilter('all');
    setMethodFilter('all');
    setSearchQuery('');
    setSortBy('date_desc');
  }

  const activeMetrics = viewMode === 'monthly' ? monthlyMetrics : yearlyMetrics;

  return (
    <div className="section-container">
      {/* Header Banner */}
      <div className="section-header-row">
        <div>
          <div className="section-subtitle">Financial Operations</div>
          <h2 className="section-title">Income & Expenditure Dashboard</h2>
          <p className="section-desc">
            Track revenue received, operating expenses, and net savings with live synchronization.
          </p>
        </div>

        <div className="finance-top-actions">
          <div className="select-pill-wrapper">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="select-pill"
              id="finance-month-select"
            >
              {monthNames.map((name, idx) => (
                <option key={name} value={idx + 1}>{name}</option>
              ))}
            </select>

            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="select-pill"
              id="finance-year-select"
            >
              {[2024, 2025, 2026, 2027].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <button 
            className="btn btn-primary"
            onClick={() => {
              setTxType('expense');
              setCategory('Food & Groceries');
              setShowAddModal(true);
            }}
            id="add-transaction-btn"
          >
            <Plus size={15} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Metric Cards (Synchronized with entered data) */}
      <div className="finance-kpi-grid">
        {/* Total Received */}
        <div className="clean-card finance-kpi-card">
          <div className="kpi-top">
            <span className="kpi-tag">TOTAL RECEIVED</span>
            <div className="kpi-icon-wrap">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="kpi-amount text-success">
            {formatINR(activeMetrics.received)}
          </div>
          <div className="kpi-footer-note">
            {viewMode === 'monthly' ? `${monthNames[selectedMonth - 1]} ${selectedYear}` : `Annual ${selectedYear}`}
          </div>
        </div>

        {/* Total Spent */}
        <div className="clean-card finance-kpi-card">
          <div className="kpi-top">
            <span className="kpi-tag">TOTAL SPENT</span>
            <div className="kpi-icon-wrap">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="kpi-amount text-danger">
            {formatINR(activeMetrics.spent)}
          </div>
          <div className="kpi-footer-note">
            {viewMode === 'monthly' ? `${monthlyMetrics.count} transactions` : `Annual cumulative`}
          </div>
        </div>

        {/* Total Saved */}
        <div className="clean-card finance-kpi-card">
          <div className="kpi-top">
            <span className="kpi-tag">NET SAVED</span>
            <div className="kpi-icon-wrap">
              <Wallet size={16} />
            </div>
          </div>
          <div className={`kpi-amount ${activeMetrics.saved >= 0 ? 'text-success' : 'text-danger'}`}>
            {activeMetrics.saved >= 0 ? `+${formatINR(activeMetrics.saved)}` : `-${formatINR(activeMetrics.saved)}`}
          </div>
          <div className="kpi-footer-note">
            Revenue minus expenditure
          </div>
        </div>

        {/* Savings Rate */}
        <div className="clean-card finance-kpi-card">
          <div className="kpi-top">
            <span className="kpi-tag">SAVINGS RATE</span>
            <div className="kpi-icon-wrap">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="kpi-amount">
            {activeMetrics.savingsRate}%
          </div>
          <div className="savings-progress-bar">
            <div 
              className="savings-fill" 
              style={{ width: `${Math.min(100, Math.max(0, activeMetrics.savingsRate))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="view-toggle-bar">
        <div className="tab-pill-group">
          <button 
            className={`tab-pill-btn ${viewMode === 'monthly' ? 'active' : ''}`}
            onClick={() => setViewMode('monthly')}
            id="view-monthly-tab"
          >
            <PieChart size={14} />
            <span>Monthly Ledger ({monthNames[selectedMonth - 1]})</span>
          </button>
          <button 
            className={`tab-pill-btn ${viewMode === 'yearly' ? 'active' : ''}`}
            onClick={() => setViewMode('yearly')}
            id="view-yearly-tab"
          >
            <BarChart3 size={14} />
            <span>Annual Comparison ({selectedYear})</span>
          </button>
        </div>
      </div>

      {/* Content for Monthly vs Yearly */}
      {viewMode === 'monthly' ? (
        <div className="monthly-ledger-layout">
          {/* Filter, Sort & Search Toolbar (Replaces old static category card) */}
          <div className="clean-card finance-control-toolbar">
            {/* Top Row: Search Input + Type Filter Pills */}
            <div className="toolbar-top-row">
              <div className="search-input-wrapper">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search description, category, method, or amount..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  id="tx-search-input"
                />
                {searchQuery && (
                  <button 
                    type="button"
                    className="search-clear-btn" 
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="tx-type-pill-group">
                <button 
                  type="button"
                  className={`tx-type-pill ${txFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTxFilter('all')}
                  id="filter-type-all"
                >
                  All ({currentMonthTransactions.length})
                </button>
                <button 
                  type="button"
                  className={`tx-type-pill income ${txFilter === 'income' ? 'active' : ''}`}
                  onClick={() => setTxFilter('income')}
                  id="filter-type-income"
                >
                  Income ({currentMonthTransactions.filter(t => t.type === 'income').length})
                </button>
                <button 
                  type="button"
                  className={`tx-type-pill expense ${txFilter === 'expense' ? 'active' : ''}`}
                  onClick={() => setTxFilter('expense')}
                  id="filter-type-expense"
                >
                  Expenses ({currentMonthTransactions.filter(t => t.type === 'expense').length})
                </button>
              </div>
            </div>

            {/* Bottom Row: Category dropdown, Method dropdown, Sort dropdown, and Reset */}
            <div className="toolbar-bottom-row">
              <div className="toolbar-select-group">
                <div className="toolbar-filter-item">
                  <label className="toolbar-label" htmlFor="filter-category-select">
                    <Filter size={11} /> Category
                  </label>
                  <select 
                    id="filter-category-select"
                    value={categoryFilter} 
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="toolbar-select"
                  >
                    <option value="all">All Categories</option>
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="toolbar-filter-item">
                  <label className="toolbar-label" htmlFor="filter-method-select">
                    <CreditCard size={11} /> Payment Method
                  </label>
                  <select 
                    id="filter-method-select"
                    value={methodFilter} 
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="toolbar-select"
                  >
                    <option value="all">All Payment Methods</option>
                    {allPaymentMethods.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="toolbar-filter-item">
                  <label className="toolbar-label" htmlFor="sort-by-select">
                    <ArrowUpDown size={11} /> Sort By
                  </label>
                  <select 
                    id="sort-by-select"
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="toolbar-select"
                  >
                    <option value="date_desc">Date: Newest First</option>
                    <option value="date_asc">Date: Oldest First</option>
                    <option value="amount_desc">Amount: High to Low</option>
                    <option value="amount_asc">Amount: Low to High</option>
                    <option value="category_asc">Category: A to Z</option>
                    <option value="description_asc">Description: A to Z</option>
                  </select>
                </div>
              </div>

              <div className="toolbar-right-meta">
                {hasActiveFilters && (
                  <button 
                    type="button"
                    className="btn btn-secondary btn-sm reset-filter-btn"
                    onClick={handleResetFilters}
                    title="Reset all filters and search query"
                    id="reset-filters-btn"
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                )}
                <span className="toolbar-counter-text">
                  Showing <strong>{filteredAndSortedTransactions.length}</strong> of {currentMonthTransactions.length}
                </span>
              </div>
            </div>
          </div>

          {/* Transactions Ledger Panel (Full Width) */}
          <div className="clean-card ledger-panel full-width">
            <div className="ledger-header">
              <div className="ledger-title-group">
                <CreditCard size={16} />
                <h4>Transaction Ledger</h4>
                <span className="ledger-currency-tag">INR (₹)</span>
              </div>

              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setTxType('expense');
                  setCategory('Food & Groceries');
                  setShowAddModal(true);
                }}
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <span>Loading ledger entries...</span>
              </div>
            ) : filteredAndSortedTransactions.length === 0 ? (
              <div className="empty-substate ledger-empty-state">
                <div className="ledger-empty-icon-wrap">
                  <CreditCard size={22} />
                </div>
                <h5>
                  {currentMonthTransactions.length === 0 
                    ? 'No transactions recorded' 
                    : 'No matching transactions found'}
                </h5>
                <p>
                  {currentMonthTransactions.length === 0 
                    ? `No transactions recorded for ${monthNames[selectedMonth - 1]} ${selectedYear}.`
                    : 'No transactions match your active search or filter criteria.'}
                </p>
                <div className="ledger-empty-actions">
                  {currentMonthTransactions.length === 0 ? (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAddModal(true)}
                      id="add-first-tx-btn"
                    >
                      <Plus size={14} /> Add Transaction
                    </button>
                  ) : (
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={handleResetFilters}
                    >
                      <RotateCcw size={13} /> Reset Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="transactions-table-container">
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: 'nowrap' }}>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Method</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
                      <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedTransactions.map((tx) => {
                      const isIncome = tx.type === 'income';
                      return (
                        <tr key={tx.id} className="tx-row">
                          <td className="tx-date-cell" style={{ whiteSpace: 'nowrap' }}>{tx.transaction_date}</td>
                          <td>
                            <span className={`cat-pill ${isIncome ? 'income' : 'expense'}`}>
                              {tx.category}
                            </span>
                          </td>
                          <td className="tx-desc-cell">{tx.description || '—'}</td>
                          <td className="tx-method-cell">{tx.payment_method}</td>
                          <td 
                            className={`tx-amount-cell ${isIncome ? 'text-success' : 'text-danger'}`} 
                            style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                          >
                            {isIncome ? `+${formatINR(tx.amount)}` : `-${formatINR(tx.amount)}`}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn btn-secondary btn-icon btn-sm text-danger"
                              onClick={() => handleDeleteTransaction(tx.id)}
                              title="Delete record"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Annual 12-Month Performance (Synchronized with entered data) */
        <div className="clean-card yearly-panel">
          <div className="yearly-panel-header">
            <h4>Annual 12-Month Performance ({selectedYear})</h4>
            <p className="modal-desc">Monthly breakdown of income received, operating expenses, and net balance.</p>
          </div>

          <div className="yearly-chart-bars-wrap">
            {monthlyTrend.map((item) => {
              const maxVal = Math.max(1, ...monthlyTrend.map(x => Math.max(x.received, x.spent)));
              const recHeight = Math.round((item.received / maxVal) * 90);
              const spHeight = Math.round((item.spent / maxVal) * 90);

              return (
                <div key={item.monthNumber} className="monthly-chart-col">
                  <div className="bars-pair">
                    <div 
                      className="bar-rec" 
                      style={{ height: `${Math.max(2, recHeight)}px` }}
                      title={`${item.fullMonthName} Received: ${formatINR(item.received)}`}
                    ></div>
                    <div 
                      className="bar-sp" 
                      style={{ height: `${Math.max(2, spHeight)}px` }}
                      title={`${item.fullMonthName} Spent: ${formatINR(item.spent)}`}
                    ></div>
                  </div>
                  <div className="chart-month-lbl">{item.monthName}</div>
                  <div className={`chart-saved-lbl ${item.saved >= 0 ? 'text-success' : 'text-danger'}`} style={{ whiteSpace: 'nowrap' }}>
                    {item.saved >= 0 ? `+${formatINR(item.saved)}` : `-${formatINR(item.saved)}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table */}
          <div className="yearly-table-wrap">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: 'right' }}>Received</th>
                  <th style={{ textAlign: 'right' }}>Spent</th>
                  <th style={{ textAlign: 'right' }}>Net Balance</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTrend.map((m) => {
                  const status = m.received === 0 && m.spent === 0 ? 'No Data' : m.saved >= 0 ? 'Surplus' : 'Deficit';
                  return (
                    <tr key={m.monthNumber}>
                      <td><strong>{m.fullMonthName} {selectedYear}</strong></td>
                      <td style={{ textAlign: 'right' }} className="text-success">{formatINR(m.received)}</td>
                      <td style={{ textAlign: 'right' }} className="text-danger">{formatINR(m.spent)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '500' }} className={m.saved >= 0 ? 'text-success' : 'text-danger'}>
                        {m.saved >= 0 ? `+${formatINR(m.saved)}` : `-${formatINR(m.saved)}`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${status === 'Surplus' ? 'badge-low' : status === 'Deficit' ? 'badge-urgent' : 'badge-medium'}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Wallet size={16} />
                </div>
                <div>
                  <h3>Record Financial Transaction</h3>
                  <p className="modal-desc">Add income received or expense spent in INR (₹)</p>
                </div>
              </div>
              <button className="btn-icon-close" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="auth-form">
              {/* Type Switcher */}
              <div className="tx-type-toggle">
                <button
                  type="button"
                  className={`tx-type-btn ${txType === 'expense' ? 'active-expense' : ''}`}
                  onClick={() => {
                    setTxType('expense');
                    setCategory('Food & Groceries');
                  }}
                >
                  <ArrowUpRight size={14} />
                  <span>Expense (Spent)</span>
                </button>
                <button
                  type="button"
                  className={`tx-type-btn ${txType === 'income' ? 'active-income' : ''}`}
                  onClick={() => {
                    setTxType('income');
                    setCategory('Salary & Compensation');
                  }}
                >
                  <ArrowDownLeft size={14} />
                  <span>Income (Received)</span>
                </button>
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Amount (₹ INR)</label>
                  <input 
                    type="number"
                    step="1"
                    min="1"
                    required
                    placeholder="₹ 0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field font-mono"
                    id="tx-amount-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="select-field"
                    id="tx-category-select"
                  >
                    {(txType === 'expense' ? expenseCategories : incomeCategories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Date</label>
                  <input 
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="input-field"
                    id="tx-date-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Payment Method</label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="select-field"
                    id="tx-method-select"
                  >
                    <option value="UPI (GPay, PhonePe)">UPI (GPay, PhonePe)</option>
                    <option value="Net Banking (IMPS/NEFT)">Net Banking (IMPS/NEFT)</option>
                    <option value="Debit / Credit Card">Debit / Credit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque / DD">Cheque / DD</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Description / Note</label>
                <input 
                  type="text"
                  placeholder="e.g. Monthly rent, Client milestone payout, Supermarket groceries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field"
                  id="tx-desc-input"
                />
              </div>

              <div className="modal-actions-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  id="save-tx-btn"
                >
                  {isSubmitting ? 'Saving...' : `Record ${txType === 'income' ? 'Income' : 'Expense'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
