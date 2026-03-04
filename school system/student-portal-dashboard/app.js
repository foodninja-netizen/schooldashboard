/* Student Portal Dashboard - App Logic with Supabase Integration */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '';
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// ========== SUPABASE CONFIGURATION ==========
const SUPABASE_URL = 'https://qkghqmjeifcqmozpzlfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZ2hxbWplaWZjcW1venB6bGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTMwMjAsImV4cCI6MjA4Nzc2OTAyMH0.wcT2uHBcpr6nLdtKdOLLzn_2Ifszu7GtbwYQetbQy84';

let supabaseClient = null;
let isOnline = navigator.onLine;

// Initialize Supabase
function initSupabase() {
  if (typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase initialized');
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      isOnline = true;
      toast('Back online - syncing data...');
      syncAllData();
    });
    
    window.addEventListener('offline', () => {
      isOnline = false;
      toast('Offline mode - data saved locally');
    });
  }
}

// ========== SUPABASE DATABASE OPERATIONS ==========
async function saveUserToSupabase(userId, userData) {
  if (!supabaseClient || !isOnline) return false;
  
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .upsert({
        id: userId,
        name: userData.name,
        email: userData.email,
        data: userData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select();
    
    if (error) throw error;
    console.log('User data synced to Supabase:', userId);
    return true;
  } catch (err) {
    console.error('Supabase sync error:', err.message);
    return false;
  }
}

async function loadUserFromSupabase(userId) {
  if (!supabaseClient || !isOnline) return null;
  
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('data')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data?.data || null;
  } catch (err) {
    console.error('Supabase load error:', err.message);
    return null;
  }
}

async function syncAllData() {
  if (!supabaseClient || !isOnline) return;
  
  // Sync all users
  for (const user of state.users) {
    const userData = state.data[user.id];
    if (userData) {
      await saveUserToSupabase(user.id, { ...user, ...userData });
    }
  }
  toast('Data synced to cloud');
}

// ========== OFFLINE STATUS UI ==========
function updateOnlineStatus() {
  let statusEl = document.getElementById('onlineStatus');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'onlineStatus';
    statusEl.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:4px;text-align:center;font-size:12px;z-index:9999;';
    document.body.insertBefore(statusEl, document.body.firstChild);
  }
  
  if (isOnline) {
    statusEl.style.background = '#059669';
    statusEl.style.color = 'white';
    statusEl.textContent = '🟢 Online - Synced';
    setTimeout(() => statusEl.style.display = 'none', 3000);
  } else {
    statusEl.style.display = 'block';
    statusEl.style.background = '#d97706';
    statusEl.style.color = 'white';
    statusEl.textContent = '🟠 Offline - Working locally';
  }
}

// Check online status periodically
setInterval(() => {
  const wasOnline = isOnline;
  isOnline = navigator.onLine;
  if (wasOnline !== isOnline) {
    updateOnlineStatus();
    if (isOnline) {
      syncAllData();
    }
  }
}, 2000);

// Toast
const toastEl = $('#toast');
let toastTimer;
function toast(msg, timeout = 2200) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), timeout);
}

// Storage
const KEY = 'student-portal.v2.new';
const DEFAULT_USER_STATE = () => ({
  assignments: [], announcements: [], todos: [], grades: [], 
  calendarCursor: new Date().toISOString(), schedule: [], attendance: [], studySessions: 0
});
const DEFAULT_STATE = () => ({
  settings: { theme: 'system', density: 'comfortable' },
  users: [ { id: uid(), name: 'Student A', email: 'student@example.com' } ],
  currentUserId: null, data: {}, admin: { enabled: false },
  notifications: []
});

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedDemo();
    const data = JSON.parse(raw);
    const merged = { ...DEFAULT_STATE(), ...data };
    if (!merged.users?.length) merged.users = [ { id: uid(), name: 'Student A', email: 'student@example.com' } ];
    if (!merged.currentUserId) merged.currentUserId = merged.users[0].id;
    if (!merged.data) merged.data = {};
    for (const u of merged.users) if (!merged.data[u.id]) merged.data[u.id] = DEFAULT_USER_STATE();
    if (!merged.admin) merged.admin = { enabled: false };
    return merged;
  } catch (e) { return seedDemo(); }
}

function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('Failed to save state', e); }
  
  // Sync to Supabase when online
  if (state.currentUserId && state.data[state.currentUserId]) {
    const user = state.users.find(u => u.id === state.currentUserId);
    if (user) {
      saveUserToSupabase(user.id, { ...user, ...state.data[user.id] });
    }
  }
}

function seedDemo() {
  const today = new Date();
  const plus = (d) => new Date(today.getTime() + d * 86400000).toISOString();
  const demo = DEFAULT_STATE();
  const u0 = demo.users[0].id;
  demo.currentUserId = u0;
  demo.data[u0] = DEFAULT_USER_STATE();
  demo.data[u0].assignments = [
    { id: uid(), course: 'Math 101', title: 'Algebra Worksheet', due: plus(2), status: 'pending', points: 10 },
    { id: uid(), course: 'History 201', title: 'Essay Draft', due: plus(5), status: 'pending', points: 20 },
    { id: uid(), course: 'Physics 110', title: 'Lab Report', due: plus(-1), status: 'completed', points: 15 },
  ];
  demo.data[u0].announcements = [
    { id: uid(), title: 'Welcome to the term', body: 'Check the syllabus!', date: today.toISOString() },
  ];
  demo.data[u0].todos = [
    { id: uid(), title: 'Buy textbooks', due: plus(1), priority: 'high', notes: '', done: false },
    { id: uid(), title: 'Email advisor', due: plus(3), priority: 'medium', done: false },
  ];
  demo.data[u0].grades = [
    { id: uid(), course: 'Math 101', item: 'Quiz 1', score: 8, max: 10, weight: 0.1, date: plus(-7) },
    { id: uid(), course: 'History 201', item: 'Essay 1', score: 85, max: 100, weight: 0.2, date: plus(-14) },
  ];
  demo.data[u0].schedule = [
    { id: uid(), course: 'Math 101', day: 'Monday', time: '09:00', room: 'Room 101' },
    { id: uid(), course: 'History 201', day: 'Tuesday', time: '11:00', room: 'Room 205' },
  ];
  demo.data[u0].attendance = [
    { id: uid(), course: 'Math 101', date: plus(-7), status: 'present' },
    { id: uid(), course: 'History 201', date: plus(-5), status: 'present' },
  ];
  try { localStorage.setItem(KEY, JSON.stringify(demo)); } catch {}
  return demo;
}

let state = loadState();
let currentNetlifyUser = null;

function currentUser() { return state.users?.find?.(u=>u.id===state.currentUserId) || null; }
function userData(id) { 
  id = id || state.currentUserId;
  if (!state.data[id]) state.data[id] = DEFAULT_USER_STATE(); 
  return state.data[id]; 
}

// Theme
function applyTheme(t) {
  document.body.setAttribute('data-theme', t);
  const themeToggle = $('#themeToggle');
  if (themeToggle) themeToggle.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
}
function applyDensity(d) {
  document.body.setAttribute('data-density', d === 'compact' ? 'compact' : 'comfortable');
}

// Routing
function showView(id) {
  $$('.view').forEach(v => v.hidden = v.id !== id);
  $$('.nav-link').forEach(b => {
    const active = b.getAttribute('data-view') === id;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-current', active ? 'page' : 'false');
  });
  document.body.classList.remove('sidebar-open');
  
  if (id === 'view-analytics') {
    renderAnalytics();
  } else if (id === 'view-schedule') {
    renderSchedule();
  } else if (id === 'view-attendance') {
    renderAttendance();
  } else if (id === 'view-assignments') {
    renderAssignments();
  } else if (id === 'view-announcements') {
    renderAnnouncements();
  } else if (id === 'view-grades') {
    renderGrades();
  } else if (id === 'view-todos') {
    renderTodos();
  }
}

// CRUD
function upsert(collection, item) {
  const arr = userData()[collection];
  const idx = arr.findIndex(x => x.id === item.id);
  if (idx >= 0) arr[idx] = item; else arr.unshift(item);
  saveState(); renderAll();
}
function removeItem(collection, id) {
  userData()[collection] = userData()[collection].filter(x => x.id !== id);
  saveState(); renderAll();
}

// Render Functions
function renderDashboard() {
  const list = $('#dashAssignments');
  if (list) {
    const items = [...userData().assignments].sort((a,b) => (a.due||'').localeCompare(b.due||'')).slice(0,5);
    list.innerHTML = items.map(a => `<li><div><strong>${escapeHtml(a.title)}</strong> • <span class="meta">${escapeHtml(a.course)}</span></div><div class="meta">Due ${a.due ? fmtDate(a.due) : '—'} • ${a.status}</div></li>`).join('');
    const empty = list.parentElement?.querySelector('.empty');
    if (empty) empty.hidden = items.length > 0;
  }
  
  const listA = $('#dashAnnouncements');
  if (listA) {
    const anns = [...userData().announcements].sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0,3);
    listA.innerHTML = anns.map(a => `<li><div><strong>${escapeHtml(a.title)}</strong></div><div class="meta">${fmtDate(a.date)}</div></li>`).join('');
    const empty = listA.parentElement?.querySelector('.empty');
    if (empty) empty.hidden = anns.length > 0;
  }
  
  const gpaEl = document.querySelector('[data-field="gpa"]');
  const compEl = document.querySelector('[data-field="completed"]');
  const pendEl = document.querySelector('[data-field="pending"]');
  const assignments = userData().assignments || [];
  const grades = userData().grades || [];
  const completed = assignments.filter(a => a.status === 'completed').length;
  const pending = assignments.filter(a => a.status !== 'completed').length;
  
  if (gpaEl) {
    if (grades.length > 0) {
      const avg = grades.reduce((sum, g) => sum + (g.score/g.max)*100, 0) / grades.length;
      gpaEl.textContent = (avg / 25).toFixed(2);
    } else {
      gpaEl.textContent = '—';
    }
  }
  if (compEl) compEl.textContent = completed.toString();
  if (pendEl) pendEl.textContent = pending.toString();
  
  renderDashboardTodos();
}

function renderAttendance() {
  const attendanceList = userData().attendance || [];
  const tableBody = document.querySelector('#attendanceTable tbody');
  const presentEl = document.getElementById('attendancePresent');
  const absentEl = document.getElementById('attendanceAbsent');
  const rateEl = document.getElementById('attendanceRate');
  
  // Calculate stats
  const present = attendanceList.filter(a => a.status === 'present').length;
  const absent = attendanceList.filter(a => a.status === 'absent').length;
  const total = attendanceList.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;
  
  if (presentEl) presentEl.textContent = present.toString();
  if (absentEl) absentEl.textContent = absent.toString();
  if (rateEl) rateEl.textContent = rate + '%';
  
  // Render table
  if (tableBody) {
    const sorted = [...attendanceList].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    tableBody.innerHTML = sorted.map(a => `
      <tr>
        <td>${a.date ? fmtDate(a.date) : '—'}</td>
        <td>${escapeHtml(a.course || '—')}</td>
        <td><span class="status-badge status-${a.status}">${a.status}</span></td>
        <td>
          <button class="btn ghost btn-sm" data-action="edit-attendance" data-id="${a.id}">Edit</button>
          <button class="btn ghost btn-sm" data-action="delete-attendance" data-id="${a.id}">Delete</button>
        </td>
      </tr>
    `).join('');
    
    const empty = tableBody.parentElement?.querySelector('.empty');
    if (empty) empty.hidden = attendanceList.length > 0;
  }
}

function renderGrades() {
  const gradesList = userData().grades || [];
  const tableBody = document.querySelector('#gradesTable tbody');
  const gpaEl = document.getElementById('gradesGpa');
  const creditsEl = document.getElementById('gradesCredits');
  
  // Calculate GPA
  if (gradesList.length > 0) {
    const avg = gradesList.reduce((sum, g) => sum + (g.score / g.max) * 100, 0) / gradesList.length;
    if (gpaEl) gpaEl.textContent = (avg / 25).toFixed(2);
  } else {
    if (gpaEl) gpaEl.textContent = '—';
  }
  
  if (creditsEl) creditsEl.textContent = gradesList.length.toString();
  
  // Render table
  if (tableBody) {
    const sorted = [...gradesList].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    tableBody.innerHTML = sorted.map(g => `
      <tr>
        <td>${escapeHtml(g.course || '—')}</td>
        <td>${escapeHtml(g.item || '—')}</td>
        <td>${g.score}</td>
        <td>${g.max}</td>
        <td>${g.weight ? (g.weight * 100).toFixed(0) + '%' : '—'}</td>
        <td>${g.date ? fmtDate(g.date) : '—'}</td>
        <td>
          <button class="btn ghost btn-sm" data-action="edit-grade" data-id="${g.id}">Edit</button>
          <button class="btn ghost btn-sm" data-action="delete-grade" data-id="${g.id}">Delete</button>
        </td>
      </tr>
    `).join('');
    
    const empty = tableBody.parentElement?.querySelector('.empty');
    if (empty) empty.hidden = gradesList.length > 0;
  }
}

function renderDashboardTodos() {
  const list = $('#dashTodos');
  if (!list) return;
  const items = [...userData().todos].slice(0, 5);
  list.innerHTML = items.map(t => `<li><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" ${t.done?'checked':''} data-action="toggle-todo" data-id="${t.id}" /> <div><strong>${escapeHtml(t.title)}</strong> • <span class="meta">${t.priority}</span></div></label></li>`).join('');
  const emptyMsg = list.parentElement?.querySelector('.empty');
  if (emptyMsg) emptyMsg.hidden = items.length > 0;
}

function renderSchedule() {
  const scheduleList = userData().schedule || [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  days.forEach(day => {
    const listEl = document.getElementById('schedule' + day);
    if (listEl) {
      const dayItems = scheduleList.filter(s => s.day === day).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      listEl.innerHTML = dayItems.map(s => `<li><strong>${escapeHtml(s.time || '—')}</strong> • ${escapeHtml(s.course || '—')} <span class="meta">${escapeHtml(s.room || '')}</span></li>`).join('');
    }
  });
}

function renderAssignments() {
  const list = document.getElementById('assignmentsList');
  if (!list) return;
  const items = [...userData().assignments].sort((a, b) => (a.due || '').localeCompare(b.due || ''));
  list.innerHTML = items.map(a => `<li><div><strong>${escapeHtml(a.title)}</strong> • <span class="meta">${escapeHtml(a.course)}</span></div><div class="meta">Due ${a.due ? fmtDate(a.due) : '—'} • ${a.status} • ${a.points} pts</div></li>`).join('');
  const empty = list.parentElement?.querySelector('.empty');
  if (empty) empty.hidden = items.length > 0;
}

function renderAnnouncements() {
  const list = document.getElementById('announcementsList');
  if (!list) return;
  const items = [...userData().announcements].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  list.innerHTML = items.map(a => `<li><div><strong>${escapeHtml(a.title)}</strong></div><div class="meta">${fmtDate(a.date)}</div><div>${escapeHtml(a.body || '')}</div></li>`).join('');
  const empty = list.parentElement?.querySelector('.empty');
  if (empty) empty.hidden = items.length > 0;
}

function renderTodos() {
  const list = document.getElementById('todosList');
  if (!list) return;
  const items = [...userData().todos];
  list.innerHTML = items.map(t => `<li><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" ${t.done?'checked':''} data-action="toggle-todo" data-id="${t.id}" /> <div><strong>${escapeHtml(t.title)}</strong> • <span class="meta">${t.priority}</span></div><div class="meta">Due ${t.due ? fmtDate(t.due) : '—'}</div></label></li>`).join('');
  const empty = list.parentElement?.querySelector('.empty');
  if (empty) empty.hidden = items.length > 0;
}

function renderAnalytics() {
  const statsContainer = document.querySelector('.productivity-stats');
  if (statsContainer) {
    const completedTodos = userData().todos?.filter(t => t.done).length || 0;
    const studyTime = Math.floor((userData().studySessions || 0) / 60);
    const statTodos = document.getElementById('statCompletedTodos');
    const statTime = document.getElementById('statStudyTime');
    const statStreak = document.getElementById('statStreak');
    if (statTodos) statTodos.textContent = completedTodos.toString();
    if (statTime) statTime.textContent = studyTime + 'h';
    if (statStreak) statStreak.textContent = '0';
  }
  
  // Render charts if Chart.js is available
  if (typeof Chart !== 'undefined') {
    renderGradeChart();
    renderAssignmentChart();
    renderCourseChart();
  }
}

function renderGradeChart() {
  const canvas = document.getElementById('gradesChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Destroy existing chart if any
  if (canvas.chart) canvas.chart.destroy();
  
  const grades = userData().grades || [];
  if (grades.length === 0) return;
  
  // Group grades by date
  const gradeByDate = {};
  grades.forEach(g => {
    const date = g.date ? new Date(g.date).toLocaleDateString() : 'No Date';
    if (!gradeByDate[date]) gradeByDate[date] = [];
    gradeByDate[date].push((g.score / g.max) * 100);
  });
  
  const labels = Object.keys(gradeByDate);
  const data = labels.map(d => gradeByDate[d].reduce((a,b) => a + b, 0) / gradeByDate[d].length);
  
  canvas.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Grade %',
        data: data,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}

function renderAssignmentChart() {
  const canvas = document.getElementById('assignmentsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (canvas.chart) canvas.chart.destroy();
  
  const assignments = userData().assignments || [];
  const completed = assignments.filter(a => a.status === 'completed').length;
  const pending = assignments.filter(a => a.status !== 'completed').length;
  
  if (assignments.length === 0) return;
  
  canvas.chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Pending'],
      datasets: [{
        data: [completed, pending],
        backgroundColor: ['#059669', '#d97706']
      }]
    },
    options: {
      responsive: true
    }
  });
}

function renderCourseChart() {
  const canvas = document.getElementById('courseChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (canvas.chart) canvas.chart.destroy();
  
  const grades = userData().grades || [];
  if (grades.length === 0) return;
  
  // Group by course
  const courseGrades = {};
  grades.forEach(g => {
    if (!courseGrades[g.course]) courseGrades[g.course] = [];
    courseGrades[g.course].push((g.score / g.max) * 100);
  });
  
  const labels = Object.keys(courseGrades);
  const data = labels.map(c => courseGrades[c].reduce((a,b) => a + b, 0) / courseGrades[c].length);
  
  canvas.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average %',
        data: data,
        backgroundColor: ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#d97706']
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Netlify Identity Integration
function initNetlifyIdentity() {
  if (typeof window.netlifyIdentity !== 'undefined') {
    const identity = window.netlifyIdentity;
    identity.close();
    
    identity.on('login', (user) => {
      currentNetlifyUser = user;
      handleNetlifyLogin(user);
    });
    
    identity.on('logout', () => {
      currentNetlifyUser = null;
      showView('view-login');
    });
    
    identity.on('init', (user) => {
      if (user) {
        currentNetlifyUser = user;
        handleNetlifyLogin(user);
      }
    });
    
    try {
      identity.refresh();
      const user = identity.currentUser();
      if (user) {
        currentNetlifyUser = user;
        handleNetlifyLogin(user);
      }
    } catch (e) {
      console.log('Netlify Identity not configured, using local auth');
    }
  }
}

function handleNetlifyLogin(netlifyUser) {
  const email = netlifyUser.email;
  const name = netlifyUser.user_metadata?.full_name || netlifyUser.email.split('@')[0];
  
  let user = state.users.find(u => u.email === email);
  if (!user) {
    user = { id: uid(), name: name, email: email };
    state.users.push(user);
    state.data[user.id] = DEFAULT_USER_STATE();
  }
  
  state.currentUserId = user.id;
  saveState();
  showView('view-dashboard');
  renderAll();
  toast('Logged in as ' + user.name);
  
  if (window.netlifyIdentity) {
    window.netlifyIdentity.close();
  }
}

function openNetlifyLogin() {
  if (typeof window.netlifyIdentity !== 'undefined') {
    window.netlifyIdentity.open();
  } else {
    toast('Netlify Identity not available');
  }
}

function logout() {
  if (typeof window.netlifyIdentity !== 'undefined') {
    window.netlifyIdentity.logout();
  }
  state.currentUserId = null;
  saveState();
  showView('view-login');
  toast('Logged out');
}

// Event Delegation
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const action = a.getAttribute('data-action');
  switch (action) {
    case 'toggle-sidebar': document.body.classList.toggle('sidebar-open'); break;
    case 'go-view': showView(a.getAttribute('data-target')); break;
    case 'toggle-todo': toggleTodo(a.getAttribute('data-id')); break;
    case 'logout-menu': 
    case 'logout':
      logout();
      break;
    case 'open-study-timer': 
      const timerDialog = $('#modal-study-timer');
      if (timerDialog && timerDialog.showModal) timerDialog.showModal();
      break;
    case 'admin-enable':
      enableAdminFromLogin();
      break;
  }
});

function toggleTodo(id) {
  const todo = userData().todos.find(t => t.id === id);
  if (todo) { todo.done = !todo.done; saveState(); renderDashboardTodos(); }
}

// Admin functions
function toggleAdmin() {
  if (!state.admin.enabled) {
    const pwd = prompt('Enter admin password:');
    if (pwd !== '0987') { toast('Invalid password'); return; }
    state.admin.enabled = true;
  } else { state.admin.enabled = false; }
  saveState(); updateAdminUI(); toast('Admin ' + (state.admin.enabled ? 'enabled' : 'disabled'));
}

function enableAdminFromLogin() {
  const pwd = prompt('Enter admin password to enable user management:');
  if (pwd !== '0987') { toast('Invalid password'); return; }
  state.admin.enabled = true;
  saveState(); renderLogin(); toast('Admin enabled - you can now manage users');
}

function renderAll() {
  renderDashboard();
  renderAttendance();
  renderGrades();
  updateAdminUI();
  updateUserSelect();
}

function updateAdminUI() {
  const isAdmin = !!state.admin?.enabled;
  document.querySelectorAll('.admin-only').forEach(el => {
    if (isAdmin) { el.removeAttribute('hidden'); }
    else { el.setAttribute('hidden', ''); }
  });
  
  // Show/hide admin Students nav item
  const adminStudentsNav = document.getElementById('nav-admin-students');
  const adminStudentsMenu = document.getElementById('menu-admin-students');
  if (isAdmin) {
    if (adminStudentsNav) adminStudentsNav.removeAttribute('hidden');
    if (adminStudentsMenu) adminStudentsMenu.removeAttribute('hidden');
  } else {
    if (adminStudentsNav) adminStudentsNav.setAttribute('hidden', '');
    if (adminStudentsMenu) adminStudentsMenu.setAttribute('hidden', '');
  }
}

function updateUserSelect() {
  const sel = $('#currentUserSelect');
  if (!sel) return;
  
  const isAdmin = !!state.admin?.enabled;
  const currentU = currentUser();
  
  if (isAdmin) {
    // Admin mode: show all students
    sel.innerHTML = state.users.map(u => 
      `<option value="${u.id}" ${u.id === state.currentUserId ? 'selected' : ''}>${escapeHtml(u.name)}</option>`
    ).join('');
    sel.disabled = false;
    
    // Update admin scope label if it exists
    const scopeLabel = $('#adminScopeLabel');
    if (scopeLabel) {
      const selectedUser = state.users.find(u => u.id === sel.value);
      scopeLabel.textContent = selectedUser ? selectedUser.name : 'Self';
    }
  } else {
    // Normal mode: show only current user
    if (currentU) {
      sel.innerHTML = `<option value="${currentUser().id}">${escapeHtml(currentUser().name)}</option>`;
      sel.disabled = true;
    }
  }
}

// Handle student selection change in dropdown
function handleStudentSelection(event) {
  const selectedId = event.target.value;
  if (selectedId && selectedId !== state.currentUserId) {
    state.currentUserId = selectedId;
    saveState();
    renderAll();
    toast('Viewing ' + (currentUser()?.name || 'student'));
  }
}

// Init
function init() {
  // Initialize Supabase first
  initSupabase();
  
  applyTheme(state.settings.theme || 'system');
  applyDensity(state.settings.density || 'comfortable');
  
  // Bind nav links
  $$('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.getAttribute('data-view')));
  });
  
  const sidebarToggle = $('.sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  }
  
  showView('view-login');
  renderLogin();
  updateAdminUI();
  
  // Initialize Netlify Identity
  initNetlifyIdentity();
  
  // Bind login buttons
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', openNetlifyLogin);
  
  // Bind create user button
  const createUserBtn = document.getElementById('createUserBtn');
  if (createUserBtn) createUserBtn.addEventListener('click', doCreateAndLogin);
  
  // Bind admin toggle
  const adminToggle = document.getElementById('adminToggle');
  if (adminToggle) adminToggle.addEventListener('click', toggleAdmin);
  
  // Bind theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = state.settings.theme === 'dark' ? 'light' : 'dark';
      state.settings.theme = next; saveState(); applyTheme(next);
    });
  }
  
  // Bind logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  const headerAdminToggle = document.querySelector('[data-action="toggle-admin-menu"]');
  if (headerAdminToggle) {
    headerAdminToggle.addEventListener('click', toggleAdmin);
  }
  
  // Bind student selection dropdown
  const currentUserSelect = document.getElementById('currentUserSelect');
  if (currentUserSelect) {
    currentUserSelect.addEventListener('change', handleStudentSelection);
  }
  
  // Bind study timer button
  const studyTimerBtn = document.getElementById('studyTimerBtn');
  if (studyTimerBtn) {
    studyTimerBtn.addEventListener('click', () => {
      const timerDialog = document.getElementById('modal-study-timer');
      if (timerDialog && timerDialog.showModal) {
        timerDialog.showModal();
      }
    });
  }
  
  // Bind timer buttons immediately
  const startBtn = document.getElementById('timerStartBtn');
  if (startBtn) startBtn.addEventListener('click', startTimer);
  
  const pauseBtn = document.getElementById('timerPauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
  
  const resetBtn = document.getElementById('timerResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetTimer);
  
  // Timer presets
  document.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      const time = parseInt(btn.getAttribute('data-time'));
      timerSeconds = time * 60;
      updateTimerDisplay();
      pauseTimer();
    });
  });
  
  // Initialize calendars
  renderMiniCalendar();
  renderFullCalendar();
}

function renderLogin() {
  // Update login section with admin button
  const loginSection = $('#view-login');
  if (!loginSection) return;
  
  // Get the card body
  const cardBody = loginSection.querySelector('.card-body');
  if (!cardBody) return;
  
  // Check if admin
  const isAdmin = !!state.admin?.enabled;
  
  // Build the login section HTML
  let loginHTML = `
    <div class="row">
      <div class="btn-row" style="margin-top:12px;">
        <button class="btn primary" id="loginBtn" style="width:100%;">Login / Sign Up</button>
      </div>
    </div>
  `;
  
  if (!isAdmin) {
    loginHTML += `
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;" />
      <div style="background:var(--surface);padding:12px;border-radius:8px;text-align:center;">
        <p style="margin:0 0 8px 0;"><strong>Teacher/Admin?</strong></p>
        <button class="btn" data-action="admin-enable" style="width:100%;">Enable Admin Panel</button>
        <p class="help" style="margin:8px 0 0 0;font-size:0.8rem;">Password required</p>
      </div>
    `;
  } else {
    loginHTML += `
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;" />
      <div style="background:var(--surface);padding:12px;border-radius:8px;">
        <p style="margin:0 0 8px 0;"><strong>Admin Mode Enabled</strong></p>
        <div class="row" style="margin:0;">
          <label for="newUserName">Add New Student</label>
          <input id="newUserName" placeholder="Student name" />
          <div class="btn-row"><button class="btn primary" id="createUserBtn">Create & Login</button></div>
        </div>
      </div>
    `;
  }
  
  // Replace the card body content
  cardBody.innerHTML = loginHTML;
  
  // Rebind the buttons after replacing HTML
  const newLoginBtn = document.getElementById('loginBtn');
  if (newLoginBtn) newLoginBtn.addEventListener('click', openNetlifyLogin);
  
  const newCreateUserBtn = document.getElementById('createUserBtn');
  if (newCreateUserBtn) newCreateUserBtn.addEventListener('click', doCreateAndLogin);
  
  const adminEnableBtn = document.querySelector('[data-action="admin-enable"]');
  if (adminEnableBtn) adminEnableBtn.addEventListener('click', enableAdminFromLogin);
}

function doCreateAndLogin() {
  if (!state.admin?.enabled) { alert('Admin required'); return; }
  const name = $('#newUserName').value.trim();
  if (!name) { alert('Enter a name'); return; }
  const id = uid();
  state.users.push({ id, name, email: name.toLowerCase().replace(/\s+/g, '.') + '@example.com' });
  state.data[id] = DEFAULT_USER_STATE();
  state.currentUserId = id;
  saveState();
  showView('view-dashboard');
  renderAll();
  toast('Created and logged in as ' + name);
}

// Modal handlers
function openModal(modalId) {
  const modal = $(modalId);
  if (modal && modal.showModal) {
    modal.showModal();
    // Focus on first input after modal opens
    setTimeout(() => {
      const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  }
}

function closeModal(modalId) {
  const modal = $(modalId);
  if (modal && modal.close) modal.close();
}

// FAB menu actions
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const action = a.getAttribute('data-action');
  
  // FAB menu
  if (action === 'open-todo-modal') {
    $('#todoId').value = '';
    $('#todoForm').reset();
    openModal('#modal-todo');
  } else if (action === 'open-assignment-modal') {
    $('#assignmentId').value = '';
    $('#assignmentForm').reset();
    openModal('#modal-assignment');
  } else if (action === 'open-announcement-modal') {
    $('#announcementId').value = '';
    $('#announcementForm').reset();
    openModal('#modal-announcement');
  } else if (action === 'open-grade-modal') {
    $('#gradeId').value = '';
    $('#gradeForm').reset();
    openModal('#modal-grade');
  } else if (action === 'open-schedule-modal') {
    $('#scheduleId').value = '';
    $('#scheduleForm').reset();
    openModal('#modal-schedule');
  } else if (action === 'open-attendance-modal') {
    $('#attendanceId').value = '';
    $('#attendanceForm').reset();
    openModal('#modal-attendance');
  }
});

// Save handlers
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action^="save-"]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  
  if (action === 'save-todo') {
    e.preventDefault();
    const id = $('#todoId').value || uid();
    const todo = {
      id: id,
      title: $('#todoTitle').value,
      due: $('#todoDue').value,
      priority: $('#todoPriority').value,
      notes: $('#todoNotes').value,
      done: false
    };
    if (!todo.title) { alert('Title required'); return; }
    upsert('todos', todo);
    closeModal('#modal-todo');
    toast('To-do saved');
  } else if (action === 'save-assignment') {
    e.preventDefault();
    const id = $('#assignmentId').value || uid();
    const assignment = {
      id: id,
      course: $('#assignmentCourse').value,
      title: $('#assignmentTitle').value,
      due: $('#assignmentDue').value,
      status: $('#assignmentStatus').value,
      points: parseFloat($('#assignmentPoints').value) || 0,
      final: $('#assignmentFinal').checked
    };
    if (!assignment.course || !assignment.title) { alert('Course and title required'); return; }
    upsert('assignments', assignment);
    closeModal('#modal-assignment');
    toast('Assignment saved');
  } else if (action === 'save-announcement') {
    e.preventDefault();
    const id = $('#announcementId').value || uid();
    const announcement = {
      id: id,
      title: $('#announcementTitle').value,
      body: $('#announcementBody').value,
      date: $('#announcementDate').value || new Date().toISOString()
    };
    if (!announcement.title || !announcement.body) { alert('Title and body required'); return; }
    upsert('announcements', announcement);
    closeModal('#modal-announcement');
    toast('Announcement saved');
  } else if (action === 'save-grade') {
    e.preventDefault();
    const id = $('#gradeId').value || uid();
    const grade = {
      id: id,
      course: $('#gradeCourse').value,
      item: $('#gradeItem').value,
      score: parseFloat($('#gradeScore').value) || 0,
      max: parseFloat($('#gradeMax').value) || 100,
      weight: parseFloat($('#gradeWeight').value) || 0,
      date: $('#gradeDate').value,
      final: $('#gradeFinal').checked
    };
    if (!grade.course || !grade.item) { alert('Course and item required'); return; }
    upsert('grades', grade);
    closeModal('#modal-grade');
    toast('Grade saved');
  } else if (action === 'save-schedule') {
    e.preventDefault();
    const id = $('#scheduleId').value || uid();
    const schedule = {
      id: id,
      course: $('#scheduleCourse').value,
      day: $('#scheduleDay').value,
      time: $('#scheduleTime').value,
      room: $('#scheduleRoom').value
    };
    if (!schedule.course || !schedule.day || !schedule.time) { alert('Course, day and time required'); return; }
    upsert('schedule', schedule);
    closeModal('#modal-schedule');
    toast('Class saved');
  } else if (action === 'save-attendance') {
    e.preventDefault();
    const id = $('#attendanceId').value || uid();
    const attendance = {
      id: id,
      course: $('#attendanceCourse').value,
      date: $('#attendanceDate').value,
      status: $('#attendanceStatus').value
    };
    if (!attendance.course || !attendance.date) { alert('Course and date required'); return; }
    upsert('attendance', attendance);
    closeModal('#modal-attendance');
    toast('Attendance saved');
  }
});

// FAB toggle
document.addEventListener('click', (e) => {
  const fab = e.target.closest('#fabQuickAdd');
  if (fab) {
    const menu = $('#fabMenu');
    menu.hidden = !menu.hidden;
  } else if (!e.target.closest('.fab-menu')) {
    const menu = $('#fabMenu');
    if (menu) menu.hidden = true;
  }
});

// Study Timer functionality
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerRunning = false;

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  if (display) {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  const startBtn = document.getElementById('timerStartBtn');
  const pauseBtn = document.getElementById('timerPauseBtn');
  const statusEl = document.getElementById('timerStatus');
  
  if (startBtn) startBtn.hidden = true;
  if (pauseBtn) pauseBtn.hidden = false;
  if (statusEl) statusEl.textContent = 'Focus time!';
  
  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
    } else {
      // Timer complete
      clearInterval(timerInterval);
      timerRunning = false;
      const sessions = document.getElementById('timerSessions');
      if (sessions) sessions.textContent = (parseInt(sessions.textContent) + 1).toString();
      
      // Save study session
      const data = userData();
      data.studySessions = (data.studySessions || 0) + 1;
      saveState();
      
      const pauseBtnEl = document.getElementById('timerPauseBtn');
      const startBtnEl = document.getElementById('timerStartBtn');
      const statusEl2 = document.getElementById('timerStatus');
      
      if (pauseBtnEl) pauseBtnEl.hidden = true;
      if (startBtnEl) startBtnEl.hidden = false;
      if (statusEl2) statusEl2.textContent = 'Session complete!';
      
      toast('Great job! Session complete.');
    }
  }, 1000);
}

function pauseTimer() {
  if (!timerRunning) return;
  timerRunning = false;
  clearInterval(timerInterval);
  
  const startBtn = document.getElementById('timerStartBtn');
  const pauseBtn = document.getElementById('timerPauseBtn');
  const statusEl = document.getElementById('timerStatus');
  
  if (startBtn) startBtn.hidden = false;
  if (pauseBtn) pauseBtn.hidden = true;
  if (statusEl) statusEl.textContent = 'Paused';
}

function resetTimer() {
  pauseTimer();
  timerSeconds = 25 * 60;
  updateTimerDisplay();
  
  const statusEl = document.getElementById('timerStatus');
  if (statusEl) statusEl.textContent = 'Ready to study!';
}

// Calendar functionality
let calendarCurrentDate = new Date();

function renderMiniCalendar() {
  const container = document.getElementById('miniCalendar');
  if (!container) return;
  
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  let html = `<div class="calendar-header" style="text-align:center;font-weight:bold;margin-bottom:8px;">${monthNames[month]} ${year}</div>`;
  html += '<div class="calendar-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:0.75rem;">';
  
  // Day headers
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  days.forEach(d => html += `<div>${d}</div>`);
  
  // Empty cells before first day
  for (let i = 0; i < firstDay.getDay(); i++) {
    html += '<div></div>';
  }
  
  // Days of month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    html += `<div style="padding:4px;${isToday ? 'background:var(--primary);color:white;border-radius:4px;' : ''}">${d}</div>`;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

function renderFullCalendar() {
  const container = document.getElementById('fullCalendar');
  if (!container) return;
  
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  let html = `<div class="calendar-header" style="text-align:center;font-weight:bold;margin-bottom:12px;font-size:1.2rem;">${monthNames[month]} ${year}</div>`;
  html += '<div class="calendar-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;">';
  
  // Day headers
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  days.forEach(d => html += `<div style="font-weight:bold;font-size:0.85rem;padding:8px 0;">${d}</div>`);
  
  // Empty cells before first day
  for (let i = 0; i < firstDay.getDay(); i++) {
    html += '<div></div>';
  }
  
  // Days of month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    html += `<div style="padding:12px 4px;border:1px solid var(--border);border-radius:4px;${isToday ? 'background:var(--primary);color:white;' : ''}">${d}</div>`;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

function navigateCalendar(direction) {
  calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + direction);
  renderMiniCalendar();
  renderFullCalendar();
}

function goToToday() {
  calendarCurrentDate = new Date();
  renderMiniCalendar();
  renderFullCalendar();
}

// Bind calendar navigation
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  
  if (action === 'cal-prev') {
    navigateCalendar(-1);
  } else if (action === 'cal-next') {
    navigateCalendar(1);
  } else if (action === 'cal-today') {
    goToToday();
  }
});

// Bind timer buttons
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('timerStartBtn');
  if (startBtn) startBtn.addEventListener('click', startTimer);
  
  const pauseBtn = document.getElementById('timerPauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
  
  const resetBtn = document.getElementById('timerResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetTimer);
  
  // Timer presets
  document.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      const time = parseInt(btn.getAttribute('data-time'));
      timerSeconds = time * 60;
      updateTimerDisplay();
      pauseTimer();
    });
  });
});

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

