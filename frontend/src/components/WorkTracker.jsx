import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  Briefcase, 
  Check, 
  Edit3, 
  Trash2, 
  X,
  BarChart3
} from 'lucide-react';
import { api } from '../services/api';
import { getLocalDateString, getLocalTimeString, formatReadableDate } from '../utils/dateUtils';

// Helper to calculate 7 days of the week (Monday to Sunday) given any anchor date
function getWeekDays(anchorDate) {
  const anchor = anchorDate instanceof Date ? anchorDate : new Date();
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const day = date.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

// Calculate elapsed hours between two times (HH:MM)
function calculateHours(start, end) {
  if (!start || !end) return '';
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return '';

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Handle overnight shifts
  }

  const diffMinutes = endMinutes - startMinutes;
  const hours = diffMinutes / 60;
  return (Math.round(hours * 100) / 100).toString();
}

function formatDuration(start, end) {
  if (!start || !end) return '';
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return '';

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const diffMinutes = endMinutes - startMinutes;
  const h = Math.floor(diffMinutes / 60);
  const m = diffMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Format decimal hours (e.g. 7.78 or 1.5) to "Xh Ym" format (e.g. "7h 47m" or "1h 30m")
function formatDecimalHoursToHM(hours, showZero = false) {
  if (hours === undefined || hours === null || isNaN(hours) || Number(hours) <= 0) {
    return showZero ? '0h 0m' : '—';
  }
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function getDefaultTimes() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const start = getLocalTimeString(oneHourAgo);
  const end = getLocalTimeString(now);
  return {
    start,
    end,
    hours: calculateHours(start, end) || '1'
  };
}

export default function WorkTracker({ user, onShowToast }) {
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [monthOverview, setMonthOverview] = useState({});
  const [workLogs, setWorkLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [startTime, setStartTime] = useState(() => getDefaultTimes().start);
  const [endTime, setEndTime] = useState(() => getDefaultTimes().end);
  const [hoursSpent, setHoursSpent] = useState(() => getDefaultTimes().hours);
  const [category, setCategory] = useState('Frontend Development');
  const [status, setStatus] = useState('completed');
  const [editingId, setEditingId] = useState(null);

  // Weekly Bar Graph State
  const [weekAnchorDate, setWeekAnchorDate] = useState(() => new Date());
  const [weekData, setWeekData] = useState({});
  const [loadingWeek, setLoadingWeek] = useState(false);

  const weekDays = useMemo(() => getWeekDays(weekAnchorDate), [weekAnchorDate]);
  const weekStartStr = useMemo(() => getLocalDateString(weekDays[0]), [weekDays]);
  const weekEndStr = useMemo(() => getLocalDateString(weekDays[6]), [weekDays]);

  function handleStartTimeChange(newStart) {
    setStartTime(newStart);
    if (newStart && endTime) {
      const computed = calculateHours(newStart, endTime);
      if (computed) setHoursSpent(computed);
    }
  }

  function handleEndTimeChange(newEnd) {
    setEndTime(newEnd);
    if (startTime && newEnd) {
      const computed = calculateHours(startTime, newEnd);
      if (computed) setHoursSpent(computed);
    }
  }

  const categories = [
    'Frontend Development',
    'Backend Development',
    'Database & Supabase',
    'API & Integration',
    'Code Review & Refactor',
    'Client Meeting',
    'Bug Fixing & QA',
    'System Architecture'
  ];

  useEffect(() => {
    fetchCalendarOverview();
  }, [currentMonth, user]);

  useEffect(() => {
    fetchDayLogs(selectedDate);
  }, [selectedDate, user]);

  useEffect(() => {
    fetchWeekOverview();
  }, [weekStartStr, weekEndStr, user]);

  async function fetchCalendarOverview() {
    const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    try {
      const data = await api.workLogs.getCalendarOverview(monthStr);
      setMonthOverview(data || {});
    } catch (err) {
      console.error('Failed to fetch calendar overview:', err);
    }
  }

  async function fetchWeekOverview() {
    setLoadingWeek(true);
    try {
      const data = await api.workLogs.getRange(weekStartStr, weekEndStr);
      setWeekData(data || {});
    } catch (err) {
      console.error('Failed to load weekly work hours:', err);
    } finally {
      setLoadingWeek(false);
    }
  }

  async function fetchDayLogs(dateStr) {
    setLoading(true);
    try {
      const data = await api.workLogs.getByDate(dateStr);
      setWorkLogs(data || []);
    } catch (err) {
      console.error('Failed to load work logs:', err);
      onShowToast('Could not load work logs', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveWorkLog(e) {
    e.preventDefault();
    if (!title.trim() || !workDone.trim()) return;

    try {
      const payload = {
        log_date: selectedDate,
        start_time: startTime,
        end_time: endTime,
        title: title.trim(),
        work_done: workDone.trim(),
        hours_spent: Number(hoursSpent) || 1,
        category,
        status
      };

      if (editingId) {
        await api.workLogs.update(editingId, payload);
        onShowToast('Work entry updated', 'success');
      } else {
        await api.workLogs.create(payload);
        onShowToast('Work entry recorded', 'success');
      }

      resetForm();
      fetchDayLogs(selectedDate);
      fetchCalendarOverview();
      fetchWeekOverview();
    } catch (err) {
      onShowToast(err.message || 'Failed to save entry', 'error');
    }
  }

  async function handleDeleteLog(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await api.workLogs.delete(id);
      setWorkLogs(prev => prev.filter(x => x.id !== id));
      fetchCalendarOverview();
      fetchWeekOverview();
      onShowToast('Entry deleted', 'info');
    } catch (err) {
      onShowToast('Failed to delete entry', 'error');
    }
  }

  function handleEditLog(log) {
    setEditingId(log.id);
    setTitle(log.title);
    setWorkDone(log.work_done);
    setStartTime(log.start_time || '09:00');
    setEndTime(log.end_time || '12:00');
    setHoursSpent(String(log.hours_spent || 1));
    setCategory(log.category || 'Frontend Development');
    setStatus(log.status || 'completed');
    setShowLogModal(true);
  }

  function resetForm() {
    const def = getDefaultTimes();
    setTitle('');
    setWorkDone('');
    setStartTime(def.start);
    setEndTime(def.end);
    setHoursSpent(def.hours);
    setCategory('Frontend Development');
    setStatus('completed');
    setEditingId(null);
    setShowLogModal(false);
  }

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  function changeMonth(delta) {
    setCurrentMonth(new Date(year, month + delta, 1));
  }

  const totalHoursToday = workLogs.reduce((sum, item) => sum + Number(item.hours_spent || 0), 0);
  const completedEntries = workLogs.filter(w => w.status === 'completed').length;

  const formattedSelectedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Weekly Graph Breakdown Calculations
  const weekDaysWithHours = useMemo(() => {
    return weekDays.map(d => {
      const dateStr = getLocalDateString(d);
      const dayRecord = weekData[dateStr];
      const hours = dayRecord ? Number(dayRecord.totalHours || 0) : 0;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isToday = getLocalDateString() === dateStr;
      const isSelected = selectedDate === dateStr;
      return {
        date: d,
        dateStr,
        hours: hours,
        dayName,
        dayDate,
        isToday,
        isSelected,
        itemsCount: dayRecord ? dayRecord.count : 0
      };
    });
  }, [weekDays, weekData, selectedDate]);

  const totalWeekHours = useMemo(() => {
    return weekDaysWithHours.reduce((acc, curr) => acc + (curr.hours || 0), 0);
  }, [weekDaysWithHours]);

  const maxDayHours = useMemo(() => {
    const max = Math.max(...weekDaysWithHours.map(d => d.hours), 0);
    return Math.max(max, 8); // Scale against at least 8 hours so empty or small days look proportional
  }, [weekDaysWithHours]);

  const activeDaysCount = useMemo(() => {
    return weekDaysWithHours.filter(d => d.hours > 0).length;
  }, [weekDaysWithHours]);

  const dailyAverageHours = useMemo(() => {
    if (activeDaysCount === 0) return 0;
    return totalWeekHours / activeDaysCount;
  }, [totalWeekHours, activeDaysCount]);

  function changeWeek(deltaWeeks) {
    setWeekAnchorDate(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + deltaWeeks * 7);
      return next;
    });
  }

  function resetToCurrentWeek() {
    setWeekAnchorDate(new Date());
  }

  const weekRangeLabel = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="section-container">
      {/* Header Banner */}
      <div className="section-header-row">
        <div>
          <div className="section-subtitle">Activity Ledger</div>
          <h2 className="section-title">Daily Work Progress Tracker</h2>
          <p className="section-desc">
            Select any calendar date to review or record detailed work accomplished and hours logged.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => { resetForm(); setShowLogModal(true); }}
          id="add-work-log-btn"
        >
          <Plus size={15} />
          <span>Log Work for {selectedDate}</span>
        </button>
      </div>

      {/* Main Grid: Interactive Calendar, Square Bar Graph & Timeline (Single Consolidated Section) */}
      <div className="work-tracker-unified-layout">
        
        {/* Card 1: Month Calendar (Square) */}
        <div className="clean-card calendar-card">
          <div className="calendar-header">
            <div className="calendar-title">
              <CalendarIcon size={16} />
              <span>
                {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            <div className="month-nav-btns">
              <button 
                className="btn btn-secondary btn-icon btn-sm" 
                onClick={() => changeMonth(-1)}
                title="Previous Month"
              >
                <ChevronLeft size={14} />
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  setSelectedDate(getLocalDateString(today));
                }}
              >
                Today
              </button>
              <button 
                className="btn btn-secondary btn-icon btn-sm" 
                onClick={() => changeMonth(1)}
                title="Next Month"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="calendar-grid-labels">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="calendar-weekday-cell">{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="calendar-days-grid">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="calendar-day-cell empty"></div>
            ))}

            {Array.from({ length: totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const isToday = getLocalDateString() === dateStr;
              const dayData = monthOverview[dateStr];

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`calendar-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${dayData ? 'has-work' : ''}`}
                  id={`cal-day-${dateStr}`}
                >
                  <span className="day-number">{dayNum}</span>
                  {dayData && (
                    <div className="day-work-badge" title={`${dayData.count} tasks (${formatDecimalHoursToHM(dayData.totalHours)})`}>
                      <span className="dot-indicator"></span>
                      <span className="hours-text">{formatDecimalHoursToHM(dayData.totalHours)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            <div className="legend-item">
              <span className="legend-dot active"></span>
              <span>Work Logged</span>
            </div>
            <div className="legend-item">
              <span className="legend-ring"></span>
              <span>Selected Date</span>
            </div>
          </div>
        </div>

        {/* Center: Selected Day Work Timeline & Entries */}
        <div className="clean-card work-timeline-panel">
          <div className="day-summary-header-inner">
            <div className="day-summary-info">
              <div className="day-tag">ACTIVE RECORD FOR</div>
              <h3 className="day-title-text">{formattedSelectedDate}</h3>
            </div>

            <div className="day-metrics-row">
              <div className="metric-box">
                <span className="metric-num">{formatDecimalHoursToHM(totalHoursToday, true)}</span>
                <span className="metric-lbl">Hours Total</span>
              </div>
              <div className="metric-box">
                <span className="metric-num text-success">{completedEntries}</span>
                <span className="metric-lbl">Completed</span>
              </div>
              <div className="metric-box">
                <span className="metric-num">{workLogs.length}</span>
                <span className="metric-lbl">Entries</span>
              </div>
            </div>
          </div>

          {/* Timeline Items */}
          <div className="work-timeline-list">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <span>Fetching work entries...</span>
              </div>
            ) : workLogs.length === 0 ? (
              <div className="empty-state">
                <Briefcase size={30} className="text-muted" />
                <h4>No entries recorded for this date</h4>
                <p>Record your start and end times and deliverables for {formattedSelectedDate}.</p>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => { resetForm(); setShowLogModal(true); }}
                >
                  <Plus size={13} /> Add Entry
                </button>
              </div>
            ) : (
              workLogs.map((log, idx) => (
                <div key={log.id} className="timeline-item-card">
                  <div className="timeline-indicator-rail">
                    <div className="timeline-node">
                      <Check size={12} className="text-success" />
                    </div>
                    {idx < workLogs.length - 1 && <div className="timeline-connector-line"></div>}
                  </div>

                  <div className="timeline-card-content">
                    <div className="timeline-top-row">
                      <div>
                        <span className="category-pill">{log.category}</span>
                        <h4 className="timeline-task-title">{log.title}</h4>
                      </div>

                      <div className="timeline-time-badge">
                        <Clock size={12} />
                        <span>
                          {log.start_time || '09:00'} - {log.end_time || '12:00'} ({formatDecimalHoursToHM(log.hours_spent)})
                        </span>
                      </div>
                    </div>

                    <div className="work-done-details-box">
                      <div className="work-done-label">Summary of Work Done:</div>
                      <p className="work-done-text">{log.work_done}</p>
                    </div>

                    <div className="timeline-footer-row">
                      <span className="status-pill status-completed">
                        {log.status}
                      </span>

                      <div className="timeline-actions">
                        <button 
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => handleEditLog(log)}
                          title="Edit entry"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button 
                          className="btn btn-secondary btn-icon btn-sm text-danger"
                          onClick={() => handleDeleteLog(log.id)}
                          title="Delete entry"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Corner: Minimalist Weekly Hours Bar Graph */}
        <div className="clean-card weekly-bargraph-square-card">
          <div className="bargraph-sq-header">
            <div className="bargraph-sq-title-row">
              <div className="bargraph-sq-title-wrap">
                <BarChart3 size={15} style={{ color: '#22c55e' }} />
                <h4>Weekly Work</h4>
              </div>
              <div className="bargraph-sq-total">
                {formatDecimalHoursToHM(totalWeekHours, true)}
              </div>
            </div>

            <div className="bargraph-sq-sub-row">
              <span className="bargraph-sq-range">{weekRangeLabel}</span>
              <div className="bargraph-sq-nav">
                <button
                  className="btn btn-secondary btn-icon btn-sm"
                  onClick={() => changeWeek(-1)}
                  title="Previous Week"
                  id="bargraph-prev-week-btn"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  className="btn btn-secondary btn-icon btn-sm"
                  onClick={() => changeWeek(1)}
                  title="Next Week"
                  id="bargraph-next-week-btn"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal Square Bars Chart */}
          <div className="h-sq-chart-wrapper">
            <div className="h-sq-rows-container">
              {/* Dotted Vertical Gridlines overlay */}
              <div className="h-sq-grid-overlay">
                {[20, 40, 60, 80, 100].map(val => (
                  <div 
                    key={val} 
                    className="h-sq-grid-line" 
                    style={{ left: `${val}%` }}
                  />
                ))}
              </div>

              {/* 7 Daily Rows */}
              {weekDaysWithHours.map(day => {
                const scaleMax = 10;
                const hasHours = day.hours > 0;
                const barWidthPercent = hasHours ? Math.min(100, (day.hours / scaleMax) * 100) : 0;
                const fullName = day.date.toLocaleDateString('en-US', { weekday: 'long' });

                return (
                  <div
                    key={day.dateStr}
                    className={`h-sq-day-row ${day.isSelected ? 'is-selected' : ''} ${day.isToday ? 'is-today' : ''}`}
                    onClick={() => setSelectedDate(day.dateStr)}
                    title={`${fullName}, ${day.dayDate}: ${formatDecimalHoursToHM(day.hours, true)} of work logged. Click to view.`}
                  >
                    <div className="h-sq-day-label">
                      <span className="h-sq-day-name">{day.dayName}</span>
                      <span className="h-sq-day-date">{day.date.getDate()}</span>
                    </div>

                    <div className="h-sq-bar-track-area">
                      <div className="h-sq-bar-track">
                        {hasHours && (
                          <div 
                            className={`h-sq-bar-fill ${day.isSelected ? 'is-selected' : ''}`}
                            style={{ width: `${barWidthPercent}%` }}
                          />
                        )}
                      </div>
                    </div>

                    <div className={`h-sq-day-val ${hasHours ? 'has-hours' : ''}`}>
                      {hasHours ? formatDecimalHoursToHM(day.hours) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Hours Scale Axis (2h, 4h, 6h, 8h, 10h) */}
            <div className="h-sq-axis-row">
              <div className="h-sq-axis-spacer"></div>
              <div className="h-sq-axis-ticks-container">
                {[2, 4, 6, 8, 10].map(val => (
                  <span 
                    key={val} 
                    className="h-sq-axis-tick" 
                    style={{ left: `${val * 10}%` }}
                  >
                    {val}h
                  </span>
                ))}
              </div>
            </div>

            {/* Footer summary */}
            <div className="h-sq-footer">
              <span>Avg: <strong style={{ color: '#6366f1' }}>{formatDecimalHoursToHM(dailyAverageHours, true)}/d</strong></span>
              <span>Active: <strong style={{ color: '#22c55e' }}>{activeDaysCount}/7d</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Work Log Modal */}
      {showLogModal && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Briefcase size={16} />
                </div>
                <div>
                  <h3>{editingId ? 'Edit Work Log' : 'Record Daily Work'}</h3>
                  <p className="modal-desc">Date: <strong>{selectedDate}</strong></p>
                </div>
              </div>
              <button className="btn-icon-close" onClick={() => setShowLogModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveWorkLog} className="auth-form">
              <div className="input-group">
                <label className="input-label">Deliverable / Task Title</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Database schema migration and index optimization"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                  id="work-title-input"
                />
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label" style={{ margin: 0 }}>Start Time</label>
                    <button 
                      type="button" 
                      onClick={() => handleStartTimeChange(getLocalTimeString())}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '1px 6px', fontSize: '10px', height: '18px', lineHeight: '16px' }}
                      title="Set to current live time"
                    >
                      Now
                    </button>
                  </div>
                  <input 
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="input-field"
                    id="work-start-time"
                  />
                </div>

                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label" style={{ margin: 0 }}>End Time</label>
                    <button 
                      type="button" 
                      onClick={() => handleEndTimeChange(getLocalTimeString())}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '1px 6px', fontSize: '10px', height: '18px', lineHeight: '16px' }}
                      title="Set to current live time"
                    >
                      Now
                    </button>
                  </div>
                  <input 
                    type="time"
                    value={endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className="input-field"
                    id="work-end-time"
                  />
                </div>
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label" style={{ margin: 0 }}>Hours Spent</label>
                    {startTime && endTime && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        <span>{formatDuration(startTime, endTime)}</span>
                      </span>
                    )}
                  </div>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="24"
                    required
                    value={hoursSpent}
                    onChange={(e) => setHoursSpent(e.target.value)}
                    className="input-field"
                    id="work-hours-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="select-field"
                    id="work-category-select"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Detailed Description of Work Done</label>
                <textarea 
                  rows="4"
                  required
                  placeholder="Detail achievements, merge requests, code refactoring, or client feedback..."
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                  className="textarea-field"
                  id="work-done-input"
                />
              </div>

              <div className="modal-actions-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowLogModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  id="save-work-btn"
                >
                  {editingId ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
