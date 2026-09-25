import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Check, 
  Clock, 
  ArrowUpDown, 
  Calendar as CalendarIcon,
  Layers,
  Circle,
  AlertCircle
} from 'lucide-react';
import { 
  addDays, 
  diffCalendarDays, 
  getLocalDateString 
} from '../utils/dateUtils';

// Helper to extract span (duration in days)
export function getTaskSpan(todo) {
  if (!todo) return 1;
  if (todo.span && Number(todo.span) > 0) return Number(todo.span);
  const match = (todo.description || '').match(/\[span:(\d+)\]/);
  if (match) return parseInt(match[1], 10);
  return 1;
}

// Clean description without span tag
export function getCleanDescription(desc) {
  return (desc || '').replace(/\[span:\d+\]/g, '').trim();
}

// Extract task start date (due_time minus span days, or due_time itself for milestone)
export function getTaskStartDate(todo) {
  const dueDate = new Date(todo.due_time);
  const span = getTaskSpan(todo);
  if (span <= 1) return dueDate;
  return addDays(dueDate, -(span - 1));
}

// Check if two dates fall on the exact same calendar day
export function isSameDay(date1, date2) {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

// Get Monday of the week for an anchor date
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Format 24h hour number into readable label (e.g. "12 AM", "9 AM", "2 PM")
export function formatHourShort(hour) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

// Format task time into 12h readable time
export function formatTaskTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Color and status theme based on task status (Pending, Overdue, In Progress, Completed)
export function getStatusTheme(todo) {
  const isCompleted = todo.status === 'completed';
  const dueDate = todo.due_time ? new Date(todo.due_time) : null;
  const isOverdue = !isCompleted && dueDate && !isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
  const isInProgress = todo.status === 'in_progress' || todo.status === 'inprogress';

  if (isCompleted) {
    return {
      status: 'completed',
      label: 'Completed',
      color: '#10b981',       // Emerald Green
      border: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      className: 'is-completed'
    };
  }

  if (isInProgress) {
    return {
      status: 'in_progress',
      label: 'In Progress',
      color: '#3b82f6',       // Vibrant Blue
      border: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      className: 'is-in-progress'
    };
  }

  if (isOverdue) {
    return {
      status: 'overdue',
      label: 'Overdue',
      color: '#ef4444',       // Crimson Red
      border: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      className: 'is-overdue'
    };
  }

  // Pending / To Do (Warm Amber / Gold)
  return {
    status: 'pending',
    label: 'Pending',
    color: '#f59e0b',
    border: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.12)',
    className: 'is-pending'
  };
}

export default function TimelineView({ 
  todos, 
  user,
  onToggleStatus, 
  onSelectTodo, 
  onOpenAddTask
}) {
  const containerRef = useRef(null);
  const hoursScrollRef = useRef(null);
  
  // Zoom modes: 'hours' (1 day 24-hr horizontal timeline) | 'days' (7-day horizontal timeline) | 'weeks' (14-day horizontal timeline)
  const [zoom, setZoom] = useState('days');
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'priority'

  // Live today reference
  const today = useMemo(() => new Date(), []);
  const currentHour = today.getHours();
  const currentMinute = today.getMinutes();

  // Navigation state for Days & Weeks zoom (offset in days from anchor Monday)
  const [windowOffsetDays, setWindowOffsetDays] = useState(0);

  // Selected date for Hours zoom (defaults to Today)
  const [selectedHourDate, setSelectedHourDate] = useState(() => new Date());

  // Auto-scroll Hours timeline to current hour on mount/switch
  useEffect(() => {
    if (zoom === 'hours' && hoursScrollRef.current) {
      const scrollPos = Math.max(0, (currentHour - 2) * 85);
      hoursScrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  }, [zoom, currentHour]);

  // Sort todos
  const sortedTodos = useMemo(() => {
    const list = [...todos];
    if (sortBy === 'priority') {
      const weight = { urgent: 4, high: 3, medium: 2, low: 1 };
      list.sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0));
    } else {
      list.sort((a, b) => new Date(a.due_time) - new Date(b.due_time));
    }
    return list;
  }, [todos, sortBy]);

  // --------------------------------------------------------------------------
  // 1. DAYS ZOOM (Strictly 7 Days in a Single Horizontal Timeline Row)
  // --------------------------------------------------------------------------
  const daysStart = useMemo(() => {
    const monday = getWeekStart(today);
    return addDays(monday, windowOffsetDays);
  }, [today, windowOffsetDays]);

  const sevenDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(daysStart, i);
      const isToday = diffCalendarDays(today, d) === 0;
      
      const dayTasks = sortedTodos.filter(todo => {
        const dueDate = new Date(todo.due_time);
        const span = getTaskSpan(todo);
        if (span > 1) {
          const s = getTaskStartDate(todo);
          const curTime = new Date(d).setHours(0,0,0,0);
          const sTime = new Date(s).setHours(0,0,0,0);
          const eTime = new Date(dueDate).setHours(0,0,0,0);
          return curTime >= sTime && curTime <= eTime;
        }
        return isSameDay(d, dueDate);
      });

      days.push({
        date: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth(),
        shortMonth: d.toLocaleDateString('en-US', { month: 'short' }),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        fullWeekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
        isToday,
        index: i,
        tasks: dayTasks
      });
    }
    return days;
  }, [daysStart, today, sortedTodos]);

  const daysRangeLabel = useMemo(() => {
    if (sevenDays.length === 0) return '';
    const first = sevenDays[0];
    const last = sevenDays[6];
    return `${first.shortMonth} ${first.dayNum} – ${last.shortMonth} ${last.dayNum}, ${last.date.getFullYear()}`;
  }, [sevenDays]);

  // --------------------------------------------------------------------------
  // 2. HOURS ZOOM (24-Hour Horizontal Timeline for Single Day)
  // --------------------------------------------------------------------------
  const isSelectedHourDateToday = useMemo(() => {
    return diffCalendarDays(today, selectedHourDate) === 0;
  }, [today, selectedHourDate]);

  const selectedHourDateLabel = useMemo(() => {
    return selectedHourDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, [selectedHourDate]);

  const hourTimelineTasks = useMemo(() => {
    return sortedTodos.filter(todo => {
      const dueDate = new Date(todo.due_time);
      const span = getTaskSpan(todo);
      if (span > 1) {
        const s = getTaskStartDate(todo);
        const curTime = new Date(selectedHourDate).setHours(0,0,0,0);
        return curTime >= new Date(s).setHours(0,0,0,0) && curTime <= new Date(dueDate).setHours(0,0,0,0);
      }
      return isSameDay(selectedHourDate, dueDate);
    });
  }, [selectedHourDate, sortedTodos]);

  const hourSlotsData = useMemo(() => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      const slotTasks = hourTimelineTasks.filter(t => {
        if (getTaskSpan(t) > 1) return false;
        const d = new Date(t.due_time);
        return d.getHours() === h;
      });

      slots.push({
        hour: h,
        label: formatHourShort(h),
        fullLabel: `${String(h).padStart(2, '0')}:00`,
        isCurrent: isSelectedHourDateToday && currentHour === h,
        tasks: slotTasks
      });
    }
    return slots;
  }, [hourTimelineTasks, isSelectedHourDateToday, currentHour]);

  // --------------------------------------------------------------------------
  // 3. WEEKS ZOOM (14-Day Horizontal Continuous Timeline)
  // --------------------------------------------------------------------------
  const fourteenDays = useMemo(() => {
    if (zoom !== 'weeks') return [];
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(daysStart, i);
      const isToday = diffCalendarDays(today, d) === 0;
      
      const dayTasks = sortedTodos.filter(todo => {
        const dueDate = new Date(todo.due_time);
        const span = getTaskSpan(todo);
        if (span > 1) {
          const s = getTaskStartDate(todo);
          const curTime = new Date(d).setHours(0,0,0,0);
          return curTime >= new Date(s).setHours(0,0,0,0) && curTime <= new Date(dueDate).setHours(0,0,0,0);
        }
        return isSameDay(d, dueDate);
      });

      days.push({
        date: d,
        dayNum: d.getDate(),
        monthNum: d.getMonth(),
        shortMonth: d.toLocaleDateString('en-US', { month: 'short' }),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday,
        index: i,
        tasks: dayTasks
      });
    }
    return days;
  }, [zoom, daysStart, today, sortedTodos]);

  const weeksRangeLabel = useMemo(() => {
    if (fourteenDays.length === 0) return '14-Day Timeline';
    const first = fourteenDays[0];
    const last = fourteenDays[13];
    return `${first.shortMonth} ${first.dayNum} – ${last.shortMonth} ${last.dayNum}, ${last.date.getFullYear()}`;
  }, [fourteenDays]);

  // Navigation handlers
  function handlePrev() {
    if (zoom === 'hours') {
      setSelectedHourDate(prev => addDays(prev, -1));
    } else if (zoom === 'days') {
      setWindowOffsetDays(prev => prev - 7);
    } else {
      setWindowOffsetDays(prev => prev - 14);
    }
  }

  function handleNext() {
    if (zoom === 'hours') {
      setSelectedHourDate(prev => addDays(prev, 1));
    } else if (zoom === 'days') {
      setWindowOffsetDays(prev => prev + 7);
    } else {
      setWindowOffsetDays(prev => prev + 14);
    }
  }

  function handleResetToday() {
    if (zoom === 'hours') {
      setSelectedHourDate(new Date());
    } else {
      setWindowOffsetDays(0);
    }
  }

  function handleJumpToDayHours(date) {
    setSelectedHourDate(new Date(date));
    setZoom('hours');
  }

  // Render task card with dynamic status-based color (border and dot)
  function renderTaskCard(todo) {
    const statusTheme = getStatusTheme(todo);
    const isCompleted = todo.status === 'completed';
    const span = getTaskSpan(todo);
    const isSpanning = span > 1;
    const taskTime = formatTaskTime(todo.due_time);

    return (
      <div 
        key={todo.id}
        className={`timeline-task-card ${statusTheme.className}`}
        style={{ borderLeftColor: statusTheme.border }}
        onClick={() => onSelectTodo(todo)}
        title={`${todo.title} • Status: ${statusTheme.label}`}
      >
        <div className="task-card-header-line">
          <button
            type="button"
            className={`task-check-circle ${isCompleted ? 'checked' : ''}`}
            style={isCompleted ? { background: statusTheme.color, borderColor: statusTheme.color } : {}}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(todo);
            }}
            title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
          >
            {isCompleted && <Check size={11} />}
          </button>
          <span className="task-card-title">{todo.title}</span>
        </div>

        <div className="task-card-meta-line">
          {taskTime && (
            <span className="task-meta-time">
              <Clock size={10} />
              <span>{taskTime}</span>
            </span>
          )}
          {isSpanning && (
            <span className="task-meta-span">
              {span}d
            </span>
          )}
          <span 
            className="task-meta-dot" 
            style={{ backgroundColor: statusTheme.color }} 
            title={`Status: ${statusTheme.label}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-container-wrapper" ref={containerRef}>
      {/* 1. Timeline Top Subheader Controls Bar */}
      <div className="timeline-controls-bar">
        {/* Left: Range and Title */}
        <div className="timeline-month-labels">
          {zoom === 'hours' && (
            <div className="timeline-view-title-group">
              <span className="timeline-month-name">{selectedHourDateLabel}</span>
              {isSelectedHourDateToday && (
                <span className="timeline-badge-today">TODAY</span>
              )}
              <span className="timeline-header-task-count">
                {hourTimelineTasks.length} {hourTimelineTasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>
          )}

          {zoom === 'days' && (
            <div className="timeline-view-title-group">
              <span className="timeline-month-name">{daysRangeLabel}</span>
              <span className="timeline-header-task-count">7-Day Timeline</span>
            </div>
          )}

          {zoom === 'weeks' && (
            <div className="timeline-view-title-group">
              <span className="timeline-month-name">{weeksRangeLabel}</span>
              <span className="timeline-header-task-count">14-Day Timeline</span>
            </div>
          )}
        </div>

        {/* Right: Controls & Actions */}
        <div className="timeline-toolbar-actions">
          {/* Timeline Navigation: Prev, Today, Next */}
          <div className="timeline-nav-pills">
            <button 
              className="timeline-arrow-btn" 
              onClick={handlePrev} 
              title={zoom === 'hours' ? 'Previous day' : 'Previous period'}
              id="timeline-prev-btn"
            >
              <ChevronLeft size={15} />
            </button>
            <button 
              className="timeline-today-btn" 
              onClick={handleResetToday} 
              title="Jump to Today"
              id="timeline-today-btn"
            >
              Today
            </button>
            <button 
              className="timeline-arrow-btn" 
              onClick={handleNext} 
              title={zoom === 'hours' ? 'Next day' : 'Next period'}
              id="timeline-next-btn"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Date Picker for Hours Zoom */}
          {zoom === 'hours' && (
            <input 
              type="date" 
              className="timeline-select-pill"
              value={getLocalDateString(selectedHourDate)}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setSelectedHourDate(new Date(y, m - 1, d));
                }
              }}
              title="Jump to specific date"
            />
          )}

          {/* Zoom Selector */}
          <div className="timeline-toolbar-group">
            <span className="toolbar-label">ZOOM:</span>
            <select 
              value={zoom} 
              onChange={(e) => setZoom(e.target.value)}
              className="timeline-select-pill"
              id="timeline-zoom-select"
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </div>

          {/* Sort Button */}
          <button 
            className="timeline-action-btn"
            onClick={() => setSortBy(prev => prev === 'date' ? 'priority' : 'date')}
            title="Sort tasks"
          >
            <ArrowUpDown size={13} />
            <span>Sort: {sortBy === 'date' ? 'Time' : 'Priority'}</span>
          </button>

          {/* New Task Button */}
          <button 
            className="timeline-action-btn timeline-btn-primary"
            onClick={() => onOpenAddTask(zoom === 'hours' ? selectedHourDate : undefined)}
            title="Create new task"
          >
            <Plus size={13} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN HORIZONTAL TIMELINE VIEW */}
      <div className="timeline-surface">
        {/* ========================================================================= */}
        {/* A. DAYS ZOOM: STRICTLY 7 DAYS HORIZONTAL TIMELINE, TASKS INSIDE DAY BOXES */}
        {/* ========================================================================= */}
        {zoom === 'days' && (
          <div className="timeline-unified-grid-wrapper">
            {/* Horizontal Timeline Scale Header (7 Days edge-to-edge) */}
            <div className="timeline-7day-scale-header">
              {sevenDays.map((d) => (
                <div 
                  key={d.index}
                  className={`timeline-scale-day-header ${d.isToday ? 'is-today-scale' : ''}`}
                  onClick={() => handleJumpToDayHours(d.date)}
                  title="Click to zoom into Hours for this day"
                >
                  <div className="scale-day-top">
                    <span className="scale-day-weekday">{d.weekday}</span>
                    {d.isToday && <span className="scale-today-pill">TODAY</span>}
                  </div>
                  <div className="scale-day-bottom">
                    <span className="scale-day-num">{d.dayNum}</span>
                    <span className="scale-day-month">{d.shortMonth}</span>
                    <span className="scale-day-badge">{d.tasks.length}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Horizontal Timeline Columns Grid (7 Days Columns) */}
            <div className="timeline-7day-columns-canvas">
              {sevenDays.map((d) => (
                <div 
                  key={d.index}
                  className={`timeline-day-column-box ${d.isToday ? 'is-today-column' : ''}`}
                >
                  {/* Today live line indicator */}
                  {d.isToday && <div className="timeline-today-glow-bar" />}

                  {/* Tasks Container assigned directly inside this day box */}
                  <div className="timeline-column-tasks-container">
                    {d.tasks.length === 0 ? (
                      <div 
                        className="timeline-empty-day-target"
                        onClick={() => onOpenAddTask(d.date)}
                        title="Click to schedule task"
                      >
                        <Plus size={13} className="empty-plus-icon" />
                        <span>Add task</span>
                      </div>
                    ) : (
                      d.tasks.map(todo => renderTaskCard(todo))
                    )}
                  </div>

                  {/* Quick Add at bottom of day column */}
                  <button 
                    type="button" 
                    className="timeline-day-quick-add"
                    onClick={() => onOpenAddTask(d.date)}
                    title={`Add task for ${d.weekday} ${d.dayNum}`}
                  >
                    <Plus size={12} />
                    <span>Add Task</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* B. HOURS ZOOM: 24-HOUR HORIZONTAL TIMELINE, TASKS INSIDE HOUR BOXES       */}
        {/* ========================================================================= */}
        {zoom === 'hours' && (
          <div className="timeline-hours-scroll-wrapper" ref={hoursScrollRef}>
            <div className="timeline-hours-horizontal-canvas">
              {/* Horizontal Timeline Scale Header (24 Hours) */}
              <div className="timeline-24h-scale-header">
                {hourSlotsData.map((slot) => (
                  <div 
                    key={slot.hour}
                    className={`timeline-scale-hour-cell ${slot.isCurrent ? 'is-current-hour-scale' : ''}`}
                  >
                    <span className="scale-hour-label">{slot.label}</span>
                    {slot.isCurrent && <span className="scale-now-badge">NOW</span>}
                  </div>
                ))}
              </div>

              {/* 24 Hour Columns Canvas */}
              <div className="timeline-24h-columns-canvas">
                {hourSlotsData.map((slot) => {
                  const slotDate = new Date(selectedHourDate);
                  slotDate.setHours(slot.hour, 0, 0, 0);

                  return (
                    <div 
                      key={slot.hour}
                      className={`timeline-hour-column-box ${slot.isCurrent ? 'is-current-hour-box' : ''}`}
                    >
                      {/* Current minute needle if today and current hour */}
                      {slot.isCurrent && (
                        <div 
                          className="timeline-now-vertical-needle"
                          style={{ left: `${Math.min(95, Math.max(5, (currentMinute / 60) * 100))}%` }}
                        >
                          <div className="now-needle-dot" />
                        </div>
                      )}

                      {/* Tasks Container assigned inside this hour box */}
                      <div className="timeline-hour-tasks-container">
                        {slot.tasks.map(todo => renderTaskCard(todo))}
                      </div>

                      {/* Quick Add at hour */}
                      <button 
                        type="button" 
                        className="timeline-hour-quick-add"
                        onClick={() => onOpenAddTask(slotDate)}
                        title={`Schedule task at ${slot.label}`}
                      >
                        <Plus size={11} />
                        <span>Add</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* C. WEEKS ZOOM: 14-DAY CONTINUOUS HORIZONTAL TIMELINE                      */}
        {/* ========================================================================= */}
        {zoom === 'weeks' && (
          <div className="timeline-weeks-scroll-wrapper">
            <div className="timeline-14day-horizontal-canvas">
              {/* Horizontal Timeline Scale Header (14 Days) */}
              <div className="timeline-14day-scale-header">
                {fourteenDays.map((d) => (
                  <div 
                    key={d.index}
                    className={`timeline-scale-day-header ${d.isToday ? 'is-today-scale' : ''}`}
                    onClick={() => handleJumpToDayHours(d.date)}
                    title="Click to zoom into Hours for this day"
                  >
                    <div className="scale-day-top">
                      <span className="scale-day-weekday">{d.weekday}</span>
                      {d.isToday && <span className="scale-today-pill">TODAY</span>}
                    </div>
                    <div className="scale-day-bottom">
                      <span className="scale-day-num">{d.dayNum}</span>
                      <span className="scale-day-month">{d.shortMonth}</span>
                      <span className="scale-day-badge">{d.tasks.length}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Horizontal Timeline Columns Grid (14 Days Columns) */}
              <div className="timeline-14day-columns-canvas">
                {fourteenDays.map((d) => (
                  <div 
                    key={d.index}
                    className={`timeline-day-column-box ${d.isToday ? 'is-today-column' : ''}`}
                  >
                    {d.isToday && <div className="timeline-today-glow-bar" />}

                    <div className="timeline-column-tasks-container">
                      {d.tasks.map(todo => renderTaskCard(todo))}
                    </div>

                    <button 
                      type="button" 
                      className="timeline-day-quick-add"
                      onClick={() => onOpenAddTask(d.date)}
                      title={`Add task for ${d.weekday} ${d.dayNum}`}
                    >
                      <Plus size={12} />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
