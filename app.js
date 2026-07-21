// ============================================================
// app.js — 코어: 인증 / 네비게이션 / 대시보드 / 공통 유틸
// ============================================================

const STATE = { user: null, crews: [], todos: [], schedules: [] };

const PAGE_TITLES = { dashboard: '대시보드', crews: '크루 관리', schedule: '일정 · 할일' };

// ── 공통 유틸 ──
function fmtDate(v) { return v ? String(v).slice(0, 10) : ''; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function confirmDelete(msg, onOk) {
  document.getElementById('confirm-msg').innerHTML = msg;
  document.getElementById('confirm-ok').onclick = () => { closeModal('modal-confirm'); onOk(); };
  openModal('modal-confirm');
}
function calcTenure(d) {
  if (!d) return '—';
  const days = Math.floor((new Date() - new Date(d)) / 864e5);
  if (days < 0 || isNaN(days)) return '—';
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30);
  return y > 0 ? `${y}년 ${m}개월` : m > 0 ? `${m}개월` : `${days}일`;
}
function jobStyle(job) {
  if (job === '스낵') return { cls: 'snack', label: '스낵' };
  if (job === '가든') return { cls: 'garden', label: '가든' };
  if (job === '총무지원') return { cls: 'support', label: '총무지원' };
  return { cls: 'none', label: '미설정' };
}
function jobTag(job) {
  const s = jobStyle(job);
  return `<span class="job-tag ${s.cls}">${s.cls !== 'none' ? '<span class="d"></span>' : ''}${s.label}</span>`;
}

// ── 로그인 ──
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value;
  if (!email || !pw) { toast('이메일과 비밀번호를 입력하세요.', 'error'); return; }
  try {
    const res = await call('login', email, pw);
    if (!res.success) { toast(res.message || '로그인 실패', 'error'); return; }
    STATE.user = res.user;
    document.getElementById('sidebar-avatar').textContent = res.user.name.charAt(0);
    document.getElementById('sidebar-name').textContent = res.user.name;
    document.getElementById('sidebar-role').textContent =
      { super: '슈퍼관리자', admin: '팀관리자', viewer: '일반열람자' }[res.user.role] || res.user.role;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    navigate('dashboard');
    startClock();
  } catch (e) {
    toast('로그인 오류: ' + e.message, 'error');
  }
}
function doLogout() {
  STATE.user = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

// ── 네비게이션 ──
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page] || page;
  closeSidebar();
  loadPage(page);
}
function loadPage(page) {
  const map = { dashboard: loadDashboard, crews: loadCrews, schedule: loadSchedulePage };
  if (map[page]) map[page]();
}
function openSidebar() { document.getElementById('sidebar').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); }

function startClock() {
  const el = document.getElementById('topbar-time');
  const tick = () => {
    const now = new Date();
    const wd = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
    el.textContent = `${fmtDate(now)} (${wd}) ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 30000);
}

// ── 대시보드 ──
let _donutChart = null;
async function loadDashboard() {
  const grid = document.getElementById('stat-grid');
  grid.innerHTML = '<div class="spinner"></div>';
  let d;
  try { d = await call('getDashboardData'); }
  catch (e) { grid.innerHTML = `<p style="color:var(--danger);font-size:.82rem">로드 실패: ${e.message}</p>`; return; }

  grid.innerHTML = `
    <div class="stat-card accent"><div class="stat-label">전체 크루</div><div class="stat-val">${d.totalCrews}</div></div>
    <div class="stat-card"><div class="stat-label">미처리 이슈</div><div class="stat-val">${d.unprocIssueCount}</div></div>
    <div class="stat-card"><div class="stat-label">이번 달 면담</div><div class="stat-val">${d.monthInterviewCount}</div></div>
    <div class="stat-card"><div class="stat-label">이번 달 평가</div><div class="stat-val">${d.monthEvalCount}</div></div>
    <div class="stat-card"><div class="stat-label">신규 크루(30일)</div><div class="stat-val">${d.newCrewCount}</div></div>
  `;

  try {
    STATE.crews = await call('getCrews') || [];
  } catch (e) { STATE.crews = []; }

  renderDisabilityDonut();
  renderDashSchedule();
  renderDashTodos();
}

function renderDisabilityDonut() {
  const active = STATE.crews.filter(c => c['상태'] !== '퇴사');
  const dis = active.filter(c => c['장애여부'] === '장애').length;
  const non = active.filter(c => c['장애여부'] === '비장애').length;
  const legend = document.getElementById('donut-legend');
  const total = active.length || 1;
  legend.innerHTML = [
    { l: '장애', c: dis, col: 'var(--accent)' },
    { l: '비장애', c: non, col: 'var(--job-support)' },
  ].map(x => `
    <div style="display:flex;align-items:center;gap:8px;font-size:.8rem;margin-bottom:8px">
      <span style="width:9px;height:9px;border-radius:50%;background:${x.col};flex-shrink:0"></span>
      <span style="flex:1;color:var(--text-secondary)">${x.l}</span>
      <span style="font-family:var(--font-mono);font-weight:600">${x.c}명</span>
      <span style="font-size:.72rem;color:var(--text-muted);min-width:34px;text-align:right">${Math.round(x.c / total * 100)}%</span>
    </div>`).join('');

  const ctx = document.getElementById('chart-donut');
  if (!ctx || typeof Chart === 'undefined') return;
  if (_donutChart) _donutChart.destroy();
  _donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['장애', '비장애'], datasets: [{ data: [dis, non], backgroundColor: ['#5dcaa5', '#4a9bd9'], borderWidth: 3, borderColor: '#16171a' }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } },
  });
}

function renderDashSchedule() {
  const el = document.getElementById('dash-schedule');
  const list = STATE.schedules.slice().sort((a, b) => (a.date + (a.time || '')) > (b.date + (b.time || '')) ? 1 : -1)
    .filter(s => s.date >= todayStr()).slice(0, 5);
  if (!list.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:.8rem;text-align:center;padding:16px">예정된 일정 없음</p>'; return; }
  el.innerHTML = list.map(s => `
    <div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-muted);min-width:70px">${s.date.slice(5)} ${s.time || ''}</span>
      <span style="font-size:.82rem;flex:1">${s.title}</span>
    </div>`).join('');
}
function renderDashTodos() {
  const el = document.getElementById('dash-todos');
  const list = STATE.todos.filter(t => t.status !== '완료').slice(0, 5);
  if (!list.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:.8rem;text-align:center;padding:16px">진행 중인 할일 없음</p>'; return; }
  el.innerHTML = list.map(t => `
    <div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span class="pri-dot pri-${t.priority === '높음' ? 'high' : t.priority === '낮음' ? 'low' : 'mid'}"></span>
      <span style="font-size:.82rem;flex:1">${t.title}</span>
      ${t.dueDate ? `<span style="font-family:var(--font-mono);font-size:.68rem;color:var(--text-muted)">~${t.dueDate.slice(5)}</span>` : ''}
    </div>`).join('');
}

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => navigate(n.dataset.page)));
  if (!IS_LIVE) {
    const b = document.getElementById('demo-banner');
    if (b) b.style.display = 'block';
  }
});
