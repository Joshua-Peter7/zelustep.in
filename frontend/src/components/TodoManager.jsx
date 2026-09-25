import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Check, 
  Clock, 
  Send, 
  Trash2, 
  Filter, 
  AlertCircle,
  MailCheck,
  CheckCircle2,
  Calendar as CalendarIcon,
  List as ListIcon,
  Kanban,
  BarChart3,
  Sparkles,
  Layers,
  X,
  Edit2,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Table,
  LayoutGrid
} from 'lucide-react';
import { api } from '../services/api';
import { 
  getLocalDateTimeString, 
  getLocalDateString, 
  addDays, 
  diffCalendarDays,
  getRelativeDueLabel,
  formatReadableDate,
  formatReadableDateTime
} from '../utils/dateUtils';
import TimelineView, { getTaskSpan, getCleanDescription } from './TimelineView';

export default function TodoManager({ user, onShowToast }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation / Views: 'timeline' | 'list' | 'board' | 'calendar' | 'dashboard'
  const [activeView, setActiveView] = useState('timeline');
  const [listFilter, setListFilter] = useState('all'); // for list view
  const [listLayout, setListLayout] = useState('table'); // 'table' | 'cards'
  const [testSendingId, setTestSendingId] = useState(null);

  // Inspector / Details Modal
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [isEditingSelected, setIsEditingSelected] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueTime, setEditDueTime] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editStatus, setEditStatus] = useState('pending');
  const [editSpan, setEditSpan] = useState(1);

  // Create Task Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [taskType, setTaskType] = useState('milestone'); // 'milestone' | 'spanning'
  const [spanDays, setSpanDays] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize default due time to 1 hour ahead
  useEffect(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    setDueTime(getLocalDateTimeString(d));
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [user]);

  async function fetchTodos() {
    setLoading(true);
    try {
      const data = await api.todos.getAll();
      setTodos(data || []);
    } catch (err) {
      console.error('Failed to load todos:', err);
      onShowToast('Could not load tasks', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Create new task
  async function handleCreateTodo(e) {
    e.preventDefault();
    if (!title.trim() || !dueTime) return;

    setIsSubmitting(true);
    try {
      // If spanning task, encode [span:N] in description
      let finalDesc = description.trim();
      if (taskType === 'spanning' && spanDays > 1) {
        finalDesc = `[span:${spanDays}] ${finalDesc}`.trim();
      }

      const newTodo = await api.todos.create({
        title: title.trim(),
        description: finalDesc,
        dueTime: new Date(dueTime).toISOString(),
        priority,
        userEmail: user?.email
      });

      setTodos(prev => [newTodo, ...prev]);
      setTitle('');
      setDescription('');
      setShowAddModal(false);
      onShowToast('Task created and scheduled on timeline', 'success');
    } catch (err) {
      onShowToast(err.message || 'Failed to create task', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Open add task modal with optional prefilled target date/time
  function handleOpenAddTask(targetDate) {
    if (targetDate) {
      const d = new Date(targetDate);
      if (d.getHours() === 0 && d.getMinutes() === 0) {
        const now = new Date();
        d.setHours(now.getHours() + 1, 0, 0, 0);
      }
      setDueTime(getLocalDateTimeString(d));
    } else {
      const d = new Date();
      d.setHours(d.getHours() + 2);
      setDueTime(getLocalDateTimeString(d));
    }
    setTitle('');
    setDescription('');
    setShowAddModal(true);
  }

  // Toggle task complete / pending via button
  async function handleToggleStatus(todo) {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
    await handleUpdateStatus(todo, newStatus);
  }

  // Direct status update (via dropdown in table or modal)
  async function handleUpdateStatus(todo, newStatus) {
    try {
      await api.todos.update(todo.id, { status: newStatus });
      setTodos(prev => prev.map(t => (t.id === todo.id ? { ...t, status: newStatus } : t)));
      if (selectedTodo && selectedTodo.id === todo.id) {
        setSelectedTodo(prev => ({ ...prev, status: newStatus }));
      }
      onShowToast(`Task marked as ${newStatus === 'completed' ? 'Completed' : 'Pending'}`, 'info');
    } catch (err) {
      onShowToast('Failed to update status', 'error');
    }
  }

  // Delete task
  async function handleDeleteTodo(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.todos.delete(id);
      setTodos(prev => prev.filter(t => t.id !== id));
      if (selectedTodo?.id === id) {
        setSelectedTodo(null);
      }
      onShowToast('Task deleted', 'info');
    } catch (err) {
      onShowToast('Failed to delete task', 'error');
    }
  }

  // Send test reminder email
  async function handleTriggerTestEmail(todo) {
    setTestSendingId(todo.id);
    try {
      const res = await api.todos.testEmail(todo.id);
      if (res.success) {
        onShowToast(`Reminder email dispatched to ${user?.email || 'user'}`, 'success');
        setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, email_sent: true } : t));
        if (selectedTodo?.id === todo.id) {
          setSelectedTodo(prev => ({ ...prev, email_sent: true }));
        }
      } else {
        onShowToast(res.message || 'Email delivery failed', 'warning');
      }
    } catch (err) {
      onShowToast(err.message || 'Failed to send test email', 'error');
    } finally {
      setTestSendingId(null);
    }
  }

  // Open inspector for a selected task
  function handleSelectTodo(todo) {
    setSelectedTodo(todo);
    setIsEditingSelected(false);
    setEditTitle(todo.title);
    setEditDescription(getCleanDescription(todo.description));
    setEditDueTime(getLocalDateTimeString(new Date(todo.due_time)));
    setEditPriority(todo.priority || 'medium');
    setEditStatus(todo.status || 'pending');
    setEditSpan(getTaskSpan(todo));
  }

  // Save edits to selected task
  async function handleSaveEditedTodo(e) {
    e.preventDefault();
    if (!selectedTodo || !editTitle.trim() || !editDueTime) return;

    try {
      let finalDesc = editDescription.trim();
      if (editSpan > 1) {
        finalDesc = `[span:${editSpan}] ${finalDesc}`.trim();
      }

      const updates = {
        title: editTitle.trim(),
        description: finalDesc,
        due_time: new Date(editDueTime).toISOString(),
        priority: editPriority,
        status: editStatus
      };

      await api.todos.update(selectedTodo.id, updates);
      setTodos(prev => prev.map(t => t.id === selectedTodo.id ? { ...t, ...updates } : t));
      setSelectedTodo(prev => ({ ...prev, ...updates }));
      setIsEditingSelected(false);
      onShowToast('Task updated successfully', 'success');
    } catch (err) {
      onShowToast('Failed to save task edits', 'error');
    }
  }

  // KPI Calculations
  const pendingCount = todos.filter(t => t.status !== 'completed').length;
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const urgentCount = todos.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;

  // Daily Tasks Calculation (Accurate for user's local day)
  const now = new Date();
  const todayTodos = todos.filter(t => diffCalendarDays(now, new Date(t.due_time)) === 0);
  const tasksForTheDay = todayTodos.length;
  const tasksCompletedForDay = todayTodos.filter(t => t.status === 'completed').length;
  const tasksPendingForDay = todayTodos.filter(t => t.status !== 'completed').length;
  const todayCompletionRate = tasksForTheDay > 0 ? Math.round((tasksCompletedForDay / tasksForTheDay) * 100) : 0;

  // Filtered todos for List view
  const filteredListTodos = useMemo(() => {
    return todos.filter(t => {
      if (listFilter === 'pending') return t.status !== 'completed';
      if (listFilter === 'completed') return t.status === 'completed';
      return true;
    });
  }, [todos, listFilter]);

  // Board View Columns
  const boardColumns = useMemo(() => {
    return {
      pending: todos.filter(t => t.status !== 'completed' && t.priority !== 'urgent'),
      urgent: todos.filter(t => t.status !== 'completed' && t.priority === 'urgent'),
      completed: todos.filter(t => t.status === 'completed')
    };
  }, [todos]);

  return (
    <div className="timeline-page-container">
      {/* 1. TOP HEADER & SUB-TABS (List, Board, Timeline, Calendar, Dashboard) - "Overview" removed */}
      <div className="timeline-top-nav-bar">
        <div className="timeline-nav-tabs">
          <button 
            className={`timeline-tab-btn ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
          >
            List
            {activeView === 'list' && <div className="tab-active-indicator" />}
          </button>
          <button 
            className={`timeline-tab-btn ${activeView === 'board' ? 'active' : ''}`}
            onClick={() => setActiveView('board')}
          >
            Board
            {activeView === 'board' && <div className="tab-active-indicator" />}
          </button>
          <button 
            className={`timeline-tab-btn ${activeView === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveView('timeline')}
          >
            Timeline
            {activeView === 'timeline' && <div className="tab-active-indicator" />}
          </button>
          <button 
            className={`timeline-tab-btn ${activeView === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveView('calendar')}
          >
            Calendar
            {activeView === 'calendar' && <div className="tab-active-indicator" />}
          </button>
          <button 
            className={`timeline-tab-btn ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            Dashboard
            {activeView === 'dashboard' && <div className="tab-active-indicator" />}
          </button>
        </div>

        {/* Top-Right Action Button (matches "+ Add Chart" from reference) */}
        <div className="timeline-top-actions">
          <button 
            className="timeline-add-task-btn"
            onClick={() => setShowAddModal(true)}
            id="add-task-top-btn"
          >
            <Plus size={15} />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN ACTIVE VIEW CONTENT */}
      {loading ? (
        <div className="timeline-loading-container">
          <div className="spinner"></div>
          <span>Synchronizing task workspace...</span>
        </div>
      ) : (
        <>
          {/* A. TIMELINE (GANTT) VIEW */}
          {activeView === 'timeline' && (
            <TimelineView
              todos={todos}
              user={user}
              onToggleStatus={handleToggleStatus}
              onSelectTodo={handleSelectTodo}
              onOpenAddTask={handleOpenAddTask}
            />
          )}

          {/* B. LIST VIEW (Supports rich Table view with direct Status update dropdown) */}
          {activeView === 'list' && (
            <div className="timeline-list-view-container">
              {/* Filter bar and Layout Switcher */}
              <div className="kpi-filter-bar" style={{ marginTop: '12px' }}>
                <div className="kpi-mini-group">
                  <div className="kpi-mini-card">
                    <span className="kpi-mini-label">Pending</span>
                    <span className="kpi-mini-val text-warning">{pendingCount}</span>
                  </div>
                  <div className="kpi-mini-card">
                    <span className="kpi-mini-label">Completed</span>
                    <span className="kpi-mini-val text-success">{completedCount}</span>
                  </div>
                  <div className="kpi-mini-card">
                    <span className="kpi-mini-label">Total</span>
                    <span className="kpi-mini-val">{todos.length}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {/* Status Filter Pills */}
                  <div className="filter-pill-group">
                    <button 
                      className={`filter-pill ${listFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setListFilter('all')}
                    >
                      All ({todos.length})
                    </button>
                    <button 
                      className={`filter-pill ${listFilter === 'pending' ? 'active' : ''}`}
                      onClick={() => setListFilter('pending')}
                    >
                      Pending ({pendingCount})
                    </button>
                    <button 
                      className={`filter-pill ${listFilter === 'completed' ? 'active' : ''}`}
                      onClick={() => setListFilter('completed')}
                    >
                      Completed ({completedCount})
                    </button>
                  </div>

                  {/* Table vs Cards layout switcher */}
                  <div className="filter-pill-group">
                    <button 
                      className={`filter-pill ${listLayout === 'table' ? 'active' : ''}`}
                      onClick={() => setListLayout('table')}
                      title="Table View"
                    >
                      <Table size={13} style={{ marginRight: '4px' }} /> Table
                    </button>
                    <button 
                      className={`filter-pill ${listLayout === 'cards' ? 'active' : ''}`}
                      onClick={() => setListLayout('cards')}
                      title="Cards View"
                    >
                      <LayoutGrid size={13} style={{ marginRight: '4px' }} /> Cards
                    </button>
                  </div>
                </div>
              </div>

              {filteredListTodos.length === 0 ? (
                <div className="empty-state" style={{ marginTop: '16px' }}>
                  <CheckCircle2 size={32} className="text-muted" />
                  <h4>No tasks in this view</h4>
                  <p>Create a task to plot it on the list and timeline.</p>
                </div>
              ) : listLayout === 'table' ? (
                /* 1. INTERACTIVE DATA TABLE VIEW */
                <div className="todos-table-wrapper">
                  <table className="todos-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '150px' }}>Status</th>
                        <th>Task Deliverable</th>
                        <th style={{ width: '180px' }}>Due Time</th>
                        <th style={{ width: '100px' }}>Priority</th>
                        <th style={{ width: '120px' }}>Format</th>
                        <th style={{ width: '110px' }}>Alert</th>
                        <th style={{ width: '160px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredListTodos.map(todo => {
                        const isCompleted = todo.status === 'completed';
                        const span = getTaskSpan(todo);
                        const cleanDesc = getCleanDescription(todo.description);

                        return (
                          <tr key={todo.id} className={isCompleted ? 'row-done' : ''}>
                            {/* Interactive Status Column */}
                            <td>
                              <div className="table-status-cell">
                                <button 
                                  className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
                                  onClick={() => handleToggleStatus(todo)}
                                  title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                                >
                                  {isCompleted && <Check size={12} />}
                                </button>
                                <select 
                                  className={`status-select-pill ${isCompleted ? 'status-pill-completed' : 'status-pill-pending'}`}
                                  value={todo.status || 'pending'}
                                  onChange={(e) => handleUpdateStatus(todo, e.target.value)}
                                  title="Change task status"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="completed">Completed</option>
                                </select>
                              </div>
                            </td>

                            {/* Task Title & Details */}
                            <td className="table-task-cell" onClick={() => handleSelectTodo(todo)}>
                              <div className={`table-task-title ${isCompleted ? 'title-strike' : ''}`}>
                                {todo.title}
                              </div>
                              {cleanDesc && (
                                <div className="table-task-desc" title={cleanDesc}>
                                  {cleanDesc}
                                </div>
                              )}
                            </td>

                            {/* Due Date & Time */}
                            <td>
                              <div className="due-pill">
                                <Clock size={12} />
                                <span>{formatReadableDateTime(todo.due_time)}</span>
                              </div>
                              <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
                                {getRelativeDueLabel(todo.due_time)}
                              </span>
                            </td>

                            {/* Priority */}
                            <td>
                              <span className={`badge badge-${todo.priority || 'medium'}`}>
                                {todo.priority || 'medium'}
                              </span>
                            </td>

                            {/* Format */}
                            <td>
                              {span > 1 ? (
                                <span className="badge badge-medium" style={{ fontSize: '10px' }}>
                                  {span} Days Bar
                                </span>
                              ) : (
                                <span className="text-muted" style={{ fontSize: '11px' }}>
                                  Milestone
                                </span>
                              )}
                            </td>

                            {/* Email Alert Tag */}
                            <td>
                              {todo.email_sent ? (
                                <span className="email-status-tag tag-sent">
                                  <MailCheck size={11} /> Sent
                                </span>
                              ) : (
                                <span className="email-status-tag tag-scheduled">
                                  <Clock size={11} /> Armed
                                </span>
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleTriggerTestEmail(todo)}
                                  disabled={testSendingId === todo.id}
                                  title="Send test email now"
                                >
                                  <Send size={11} />
                                  <span>{testSendingId === todo.id ? 'Sending...' : 'Test'}</span>
                                </button>
                                <button 
                                  className="btn btn-secondary btn-icon btn-sm"
                                  onClick={() => handleSelectTodo(todo)}
                                  title="Edit details"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  className="btn btn-secondary btn-icon btn-sm text-danger"
                                  onClick={() => handleDeleteTodo(todo.id)}
                                  title="Delete task"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* 2. CARDS VIEW (Also includes direct Status select) */
                <div className="todos-grid" style={{ marginTop: '16px' }}>
                  {filteredListTodos.map(todo => {
                    const isCompleted = todo.status === 'completed';
                    const cleanDesc = getCleanDescription(todo.description);
                    const span = getTaskSpan(todo);

                    return (
                      <div 
                        key={todo.id} 
                        className={`task-card ${isCompleted ? 'task-card-done' : ''}`}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                          <button 
                            className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
                            onClick={() => handleToggleStatus(todo)}
                            title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                          >
                            {isCompleted && <Check size={12} />}
                          </button>
                        </div>

                        <div className="task-content">
                          <div className="task-header-row">
                            <h4 
                              className={`task-title ${isCompleted ? 'task-title-strike' : ''}`}
                              onClick={() => handleSelectTodo(todo)}
                              style={{ cursor: 'pointer' }}
                            >
                              {todo.title}
                            </h4>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {/* Direct Status Selector in Card */}
                              <select 
                                className={`status-select-pill ${isCompleted ? 'status-pill-completed' : 'status-pill-pending'}`}
                                value={todo.status || 'pending'}
                                onChange={(e) => handleUpdateStatus(todo, e.target.value)}
                                title="Change task status"
                              >
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                              </select>

                              {span > 1 && (
                                <span className="badge badge-medium" style={{ fontSize: '10.5px' }}>
                                  {span} Days
                                </span>
                              )}
                              <span className={`badge badge-${todo.priority || 'medium'}`}>
                                {todo.priority || 'medium'}
                              </span>
                            </div>
                          </div>

                          {cleanDesc && (
                            <p className="task-desc">{cleanDesc}</p>
                          )}

                          <div className="task-footer-row">
                            <div className="due-pill">
                              <Clock size={12} />
                              <span>{formatReadableDateTime(todo.due_time)}</span>
                              <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                                ({getRelativeDueLabel(todo.due_time)})
                              </span>
                            </div>

                            {todo.email_sent ? (
                              <div className="email-status-tag tag-sent">
                                <MailCheck size={12} />
                                <span>Email Sent</span>
                              </div>
                            ) : (
                              <div className="email-status-tag tag-scheduled">
                                <Clock size={12} />
                                <span>Armed</span>
                              </div>
                            )}

                            <div className="task-card-actions">
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleTriggerTestEmail(todo)}
                                disabled={testSendingId === todo.id}
                                title="Send test email now"
                              >
                                <Send size={12} />
                                <span>{testSendingId === todo.id ? 'Sending...' : 'Test Alert'}</span>
                              </button>

                              <button 
                                className="btn btn-secondary btn-icon btn-sm"
                                onClick={() => handleSelectTodo(todo)}
                                title="Edit details"
                              >
                                <Edit2 size={12} />
                              </button>

                              <button 
                                className="btn btn-secondary btn-icon btn-sm text-danger"
                                onClick={() => handleDeleteTodo(todo.id)}
                                title="Delete task"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* C. BOARD (KANBAN) VIEW */}
          {activeView === 'board' && (
            <div className="timeline-board-view">
              {/* Column 1: Pending */}
              <div className="kanban-column">
                <div className="kanban-col-header">
                  <div className="kanban-col-title">
                    <span className="kanban-dot dot-pending" />
                    <span>To Do / In Queue</span>
                  </div>
                  <span className="kanban-col-count">{boardColumns.pending.length}</span>
                </div>
                <div className="kanban-col-items">
                  {boardColumns.pending.map(todo => (
                    <div 
                      key={todo.id} 
                      className="kanban-task-card"
                      onClick={() => handleSelectTodo(todo)}
                    >
                      <div className="kanban-card-top">
                        <span className={`badge badge-${todo.priority}`}>{todo.priority}</span>
                        <span className="due-relative-label">{getRelativeDueLabel(todo.due_time)}</span>
                      </div>
                      <div className="kanban-card-title">{todo.title}</div>
                      <div className="kanban-card-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select 
                          className="status-select-pill status-pill-pending"
                          value={todo.status || 'pending'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleUpdateStatus(todo, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button 
                          className="btn btn-secondary btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(todo);
                          }}
                        >
                          <Check size={11} /> Mark Done
                        </button>
                      </div>
                    </div>
                  ))}
                  {boardColumns.pending.length === 0 && (
                    <div className="kanban-empty">No tasks in queue</div>
                  )}
                </div>
              </div>

              {/* Column 2: Urgent / In Progress */}
              <div className="kanban-column">
                <div className="kanban-col-header">
                  <div className="kanban-col-title">
                    <span className="kanban-dot dot-urgent" />
                    <span>Urgent Priority</span>
                  </div>
                  <span className="kanban-col-count text-danger">{boardColumns.urgent.length}</span>
                </div>
                <div className="kanban-col-items">
                  {boardColumns.urgent.map(todo => (
                    <div 
                      key={todo.id} 
                      className="kanban-task-card urgent-border"
                      onClick={() => handleSelectTodo(todo)}
                    >
                      <div className="kanban-card-top">
                        <span className="badge badge-urgent">Urgent</span>
                        <span className="due-relative-label text-danger">{getRelativeDueLabel(todo.due_time)}</span>
                      </div>
                      <div className="kanban-card-title">{todo.title}</div>
                      <div className="kanban-card-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select 
                          className="status-select-pill status-pill-pending"
                          value={todo.status || 'pending'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleUpdateStatus(todo, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button 
                          className="btn btn-secondary btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(todo);
                          }}
                        >
                          <Check size={11} /> Mark Done
                        </button>
                      </div>
                    </div>
                  ))}
                  {boardColumns.urgent.length === 0 && (
                    <div className="kanban-empty">No urgent tasks</div>
                  )}
                </div>
              </div>

              {/* Column 3: Completed */}
              <div className="kanban-column">
                <div className="kanban-col-header">
                  <div className="kanban-col-title">
                    <span className="kanban-dot dot-completed" />
                    <span>Completed</span>
                  </div>
                  <span className="kanban-col-count text-success">{boardColumns.completed.length}</span>
                </div>
                <div className="kanban-col-items">
                  {boardColumns.completed.map(todo => (
                    <div 
                      key={todo.id} 
                      className="kanban-task-card completed-card"
                      onClick={() => handleSelectTodo(todo)}
                    >
                      <div className="kanban-card-top">
                        <span className="badge badge-low">Done</span>
                        <span className="due-relative-label">{formatReadableDate(todo.due_time, { month: 'short', day: 'numeric' })}</span>
                      </div>
                      <div className="kanban-card-title strike-through">{todo.title}</div>
                      <div className="kanban-card-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select 
                          className="status-select-pill status-pill-completed"
                          value={todo.status || 'completed'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleUpdateStatus(todo, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button 
                          className="btn btn-secondary btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(todo);
                          }}
                        >
                          Reopen
                        </button>
                      </div>
                    </div>
                  ))}
                  {boardColumns.completed.length === 0 && (
                    <div className="kanban-empty">No completed tasks yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* D. CALENDAR VIEW */}
          {activeView === 'calendar' && (
            <div className="timeline-calendar-view">
              <div className="calendar-month-banner">
                <h3>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                <span className="badge badge-medium">Active Schedule</span>
              </div>
              <div className="calendar-grid-table">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="calendar-weekday-cell">{d}</div>
                ))}
                {/* Render days for current month */}
                {Array.from({ length: 35 }).map((_, i) => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
                  const dateNum = i - firstDay + 1;
                  const curDate = new Date(now.getFullYear(), now.getMonth(), dateNum);
                  const isCurrentMonth = curDate.getMonth() === now.getMonth();
                  const isToday = diffCalendarDays(now, curDate) === 0;

                  const dayTodos = todos.filter(t => {
                    const td = new Date(t.due_time);
                    return diffCalendarDays(curDate, td) === 0;
                  });

                  return (
                    <div 
                      key={i} 
                      className={`calendar-day-box ${!isCurrentMonth ? 'calendar-day-other' : ''} ${isToday ? 'calendar-day-today' : ''}`}
                    >
                      <div className="cal-day-header">
                        <span className="cal-day-num">{curDate.getDate()}</span>
                        {isToday && <span className="cal-today-badge">Today</span>}
                      </div>
                      <div className="cal-day-todos">
                        {dayTodos.map(todo => (
                          <div 
                            key={todo.id} 
                            className={`cal-todo-chip ${todo.status === 'completed' ? 'chip-done' : ''}`}
                            onClick={() => handleSelectTodo(todo)}
                            title={todo.title}
                          >
                            <span className={`chip-dot dot-${todo.priority}`} />
                            <span className="chip-text">{todo.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* E. DASHBOARD VIEW (With "No of task for the day", "No of task completed", "No of task pending") */}
          {activeView === 'dashboard' && (
            <div className="timeline-overview-view">
              {/* Primary KPI Row: Specifically displaying No of Tasks for the Day, Completed, Pending */}
              <div className="dashboard-kpi-grid">
                <div className="dashboard-kpi-card">
                  <div className="kpi-label">No of Tasks for the Day</div>
                  <div className="kpi-value">{tasksForTheDay}</div>
                  <div className="kpi-sub">
                    Due today ({formatReadableDate(getLocalDateString(now), { weekday: 'short', month: 'short', day: 'numeric' })})
                  </div>
                </div>

                <div className="dashboard-kpi-card">
                  <div className="kpi-label">No of Tasks Completed</div>
                  <div className="kpi-value text-success">{tasksCompletedForDay}</div>
                  <div className="kpi-sub">
                    {completedCount} total completed across all dates
                  </div>
                </div>

                <div className="dashboard-kpi-card">
                  <div className="kpi-label">No of Tasks Pending</div>
                  <div className="kpi-value text-warning">{tasksPendingForDay}</div>
                  <div className="kpi-sub">
                    {pendingCount} total pending in workspace
                  </div>
                </div>

                <div className="dashboard-kpi-card">
                  <div className="kpi-label">Today's Completion Rate</div>
                  <div className="kpi-value">{todayCompletionRate}%</div>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${todayCompletionRate}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* Second Row: Schedule Table for the Day + Daily Task Status Breakdown */}
              <div className="overview-two-col">
                {/* Left: Tasks Scheduled for Today with Direct Status Update Dropdowns */}
                <div className="form-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4>Today's Deliverable Schedule</h4>
                    <span className="badge badge-medium">{tasksForTheDay} Today</span>
                  </div>

                  {todayTodos.length === 0 ? (
                    <p className="text-muted" style={{ padding: '16px 0', fontSize: '13px' }}>
                      No tasks scheduled specifically for today. Create a task or review all tasks in the List/Timeline.
                    </p>
                  ) : (
                    <div className="upcoming-todos-list">
                      {todayTodos.map(t => (
                        <div key={t.id} className="upcoming-todo-row" style={{ cursor: 'default' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button 
                              className={`task-checkbox ${t.status === 'completed' ? 'checked' : ''}`}
                              onClick={() => handleToggleStatus(t)}
                              title={t.status === 'completed' ? 'Mark Pending' : 'Mark Completed'}
                            >
                              {t.status === 'completed' && <Check size={12} />}
                            </button>
                            <div>
                              <div 
                                className={`upcoming-title ${t.status === 'completed' ? 'strike-through' : ''}`}
                                onClick={() => handleSelectTodo(t)}
                                style={{ cursor: 'pointer' }}
                              >
                                {t.title}
                              </div>
                              <div className="upcoming-due">
                                {formatReadableDateTime(t.due_time)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <select 
                              className={`status-select-pill ${t.status === 'completed' ? 'status-pill-completed' : 'status-pill-pending'}`}
                              value={t.status || 'pending'}
                              onChange={(e) => handleUpdateStatus(t, e.target.value)}
                              title="Update status"
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                            </select>
                            <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Daily Task Status Breakdown & Dispatch Health (replaces the box from user image) */}
                <div className="form-card">
                  <h4>Daily Task Status & Health</h4>
                  <div className="health-item-row">
                    <span>No of Tasks for the Day:</span>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{tasksForTheDay}</strong>
                  </div>
                  <div className="health-item-row">
                    <span>No of Tasks Completed:</span>
                    <span className="badge badge-low">{tasksCompletedForDay} Finished</span>
                  </div>
                  <div className="health-item-row">
                    <span>No of Tasks Pending:</span>
                    <span className="badge badge-high">{tasksPendingForDay} In Queue</span>
                  </div>
                  <div className="health-item-row">
                    <span>Resend Email Dispatch:</span>
                    <span className="badge badge-success">Online (Active)</span>
                  </div>
                  <div className="health-item-row">
                    <span>Target Recipient:</span>
                    <span className="text-muted">{user?.email || 'Authenticated User'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. TASK INSPECTOR / EDIT MODAL (With direct interactive Status selector) */}
      {selectedTodo && (
        <div className="modal-overlay" onClick={() => setSelectedTodo(null)}>
          <div className="modal-content timeline-inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  {isEditingSelected ? <Edit2 size={16} /> : <Layers size={16} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3>{isEditingSelected ? 'Edit Milestone / Bar' : 'Task Details'}</h3>
                    <span className={`badge badge-${selectedTodo.priority}`}>
                      {selectedTodo.priority}
                    </span>
                  </div>
                  <p className="modal-desc">
                    {isEditingSelected 
                      ? 'Modify title, scheduled due date, duration span, or priority' 
                      : 'Inspect deliverable parameters, status, and reminder state'}
                  </p>
                </div>
              </div>
              <button 
                className="btn-icon-close" 
                onClick={() => setSelectedTodo(null)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {isEditingSelected ? (
              <form onSubmit={handleSaveEditedTodo} className="modal-body-form">
                <div className="input-group">
                  <label className="input-label">Task Title</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="input-field"
                    placeholder="Enter task title"
                  />
                </div>

                <div className="form-row-2col">
                  <div className="input-group">
                    <label className="input-label">Due Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={editDueTime}
                      onChange={(e) => setEditDueTime(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="select-field"
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2col">
                  <div className="input-group">
                    <label className="input-label">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="select-field"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Span / Duration (Days)</label>
                    <select
                      value={editSpan}
                      onChange={(e) => setEditSpan(Number(e.target.value))}
                      className="select-field"
                    >
                      <option value={1}>1 Day (Milestone Capsule)</option>
                      <option value={2}>2 Days (Spanning Bar)</option>
                      <option value={3}>3 Days (Spanning Bar)</option>
                      <option value={4}>4 Days (Spanning Bar)</option>
                      <option value={5}>5 Days (Spanning Bar)</option>
                      <option value={7}>7 Days (1 Week Bar)</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Notes & Description</label>
                  <textarea
                    rows="3"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="textarea-field"
                    placeholder="Include relevant links, checklist, or instructions..."
                  />
                </div>

                <div className="modal-actions-row">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setIsEditingSelected(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="modal-body-form">
                <div className="inspector-title-row">
                  <button 
                    className={`task-checkbox ${selectedTodo.status === 'completed' ? 'checked' : ''}`}
                    onClick={() => handleToggleStatus(selectedTodo)}
                    title={selectedTodo.status === 'completed' ? 'Mark Pending' : 'Mark Completed'}
                  >
                    {selectedTodo.status === 'completed' && <Check size={12} />}
                  </button>
                  <h4 className={selectedTodo.status === 'completed' ? 'strike-through' : ''}>
                    {selectedTodo.title}
                  </h4>
                </div>

                <div className="inspector-meta-grid">
                  {/* Interactive Status Selector inside Inspector Modal */}
                  <div className="inspector-meta-item">
                    <span className="meta-label">Status</span>
                    <select 
                      className={`status-modal-select ${selectedTodo.status === 'completed' ? 'status-pill-completed' : selectedTodo.status === 'in_progress' ? 'status-pill-progress' : 'status-pill-pending'}`}
                      value={selectedTodo.status || 'pending'}
                      onChange={(e) => handleUpdateStatus(selectedTodo, e.target.value)}
                      title="Update status"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="inspector-meta-item">
                    <span className="meta-label">Due Date</span>
                    <span className="meta-val">
                      {formatReadableDateTime(selectedTodo.due_time)}
                    </span>
                  </div>

                  <div className="inspector-meta-item">
                    <span className="meta-label">Timeline Format</span>
                    <span className="meta-val">
                      {getTaskSpan(selectedTodo) > 1 
                        ? `${getTaskSpan(selectedTodo)} Days Bar` 
                        : 'Single Day Milestone'}
                    </span>
                  </div>

                  <div className="inspector-meta-item">
                    <span className="meta-label">Email Reminder</span>
                    <span className="meta-val">
                      {selectedTodo.email_sent ? 'Dispatched' : 'Armed'}
                    </span>
                  </div>
                </div>

                {getCleanDescription(selectedTodo.description) && (
                  <div className="inspector-desc-box">
                    <div className="desc-box-label">Description & Steps</div>
                    <p>{getCleanDescription(selectedTodo.description)}</p>
                  </div>
                )}

                <div className="inspector-actions-row">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditingSelected(true)}
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button 
                    className="btn btn-secondary btn-sm text-danger"
                    onClick={() => handleDeleteTodo(selectedTodo.id)}
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. CREATE TASK MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Plus size={16} />
                </div>
                <div>
                  <h3>Create Timeline Task & Reminder</h3>
                  <p className="modal-desc">Schedule deliverable and configure email alert</p>
                </div>
              </div>
              <button 
                className="btn-icon-close" 
                onClick={() => setShowAddModal(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateTodo} className="modal-body-form">
              <div className="input-group">
                <label className="input-label">Task Title</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Propose 3 conference keynote ideas"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field"
                  id="new-task-title-input"
                  autoFocus
                />
              </div>

              {/* Task Type: Milestone vs Spanning Bar */}
              <div className="input-group">
                <label className="input-label">Timeline Representation</label>
                <div className="timeline-type-selector">
                  <button
                    type="button"
                    className={`timeline-type-btn ${taskType === 'milestone' ? 'active' : ''}`}
                    onClick={() => setTaskType('milestone')}
                  >
                    <div className="type-btn-title">Milestone Capsule</div>
                    <div className="type-btn-desc">Single-day target with colored stripe & avatar</div>
                  </button>
                  <button
                    type="button"
                    className={`timeline-type-btn ${taskType === 'spanning' ? 'active' : ''}`}
                    onClick={() => setTaskType('spanning')}
                  >
                    <div className="type-btn-title">Spanning Task Bar</div>
                    <div className="type-btn-desc">Multi-day colored horizontal Gantt bar</div>
                  </button>
                </div>
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Due Date & Time</label>
                  <input 
                    type="datetime-local"
                    required
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="input-field"
                    id="new-task-due-input"
                  />
                </div>

                {taskType === 'spanning' ? (
                  <div className="input-group">
                    <label className="input-label">Span Duration (Days)</label>
                    <select
                      value={spanDays}
                      onChange={(e) => setSpanDays(Number(e.target.value))}
                      className="select-field"
                    >
                      <option value={2}>2 Days</option>
                      <option value={3}>3 Days</option>
                      <option value={4}>4 Days</option>
                      <option value={5}>5 Days</option>
                      <option value={7}>7 Days (1 Week)</option>
                    </select>
                  </div>
                ) : (
                  <div className="input-group">
                    <label className="input-label">Priority</label>
                    <select 
                      value={priority} 
                      onChange={(e) => setPriority(e.target.value)}
                      className="select-field"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                )}
              </div>

              {taskType === 'spanning' && (
                <div className="input-group">
                  <label className="input-label">Priority</label>
                  <select 
                    value={priority} 
                    onChange={(e) => setPriority(e.target.value)}
                    className="select-field"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Task Details (Dispatched in email reminder)</label>
                <textarea 
                  rows="3"
                  placeholder="Outline action items, reference links, or execution requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="textarea-field"
                  id="new-task-desc-input"
                />
              </div>

              <div className="modal-actions-row">
                <span className="info-helper-text" style={{ marginRight: 'auto' }}>
                  <Clock size={13} /> Email alert sent to {user?.email || 'you'}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                  >
                    {isSubmitting ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
