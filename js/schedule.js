// ============================================================
// schedule.js — 주간 일정 + 월간 할일 달력
// ============================================================

let _schedTab = 'schedule';
let _weekStart = null;
let _calYear = new Date().getFullYear();
let _calMonth = new Date().getMonth();
let _selectedDate = null;

function initWeekStart(ref) {
  const d = ref ? new Date(ref) : new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow + (dow === 0 ? -6 : 1));
  _weekStart = monday;
}

async function loadSchedulePage() {
  try {
    STATE.schedules = (await call('getSchedules')) || [];
    STATE.todos = (await call('getTodos')) || [];
  } catch (e) { toast('로드 실패: ' + e.message, 'error'); }
  if (!_weekStart) initWeekStart(null);
  switchSchedTab(_schedTab);
}

function switchSchedTab(tab) {
  _schedTab = tab;
  document.querySelectorAll('.sched-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('sched-panel-schedule').style.display = tab === 'schedule' ? 'block' : 'none';
  document.getElementById('sched-panel-todo').style.display = tab === 'todo' ? 'block' : 'none';
  if (tab === 'schedule') renderWeek(); else renderTodoCalendar();
}

// ── 주간 일정 ──
function weekNav(dir) {
  const d = new Date(_weekStart);
  d.setDate(d.getDate() + dir * 7);
  _weekStart = d;
  renderWeek();
}
function weekToday() { initWeekStart(null); renderWeek(); }

function renderWeek() {
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(_weekStart);
    d.setDate(_weekStart.getDate() + i);
    days.push(d);
  }
  const label = document.getElementById('week-label');
  label.textContent = `${days[0].getFullYear()}. ${days[0].getMonth() + 1}. ${days[0].getDate()} — ${days[4].getMonth() + 1}. ${days[4].getDate()}`;

  const byDate = {};
  STATE.schedules.forEach(s => { (byDate[s.date] ||= []).push(s); });
  const wd = ['일', '월', '화', '수', '목', '금', '토'];
  const todayS = todayStr();

  const grid = document.getElementById('week-grid');
  grid.innerHTML = days.map(d => {
    const ds = d.toISOString().slice(0, 10);
    const isToday = ds === todayS;
    const items = (byDate[ds] || []).sort((a, b) => (a.time || '') > (b.time || '') ? 1 : -1);
    return `
      <div class="day-col ${isToday ? 'today' : ''}">
        <div class="day-col-head"><span>${d.getMonth() + 1}/${d.getDate()}</span><span style="color:var(--text-muted);font-weight:400">(${wd[d.getDay()]})</span></div>
        <div class="day-col-body">
          ${items.map(s => `
            <div class="sched-item ${s.done ? 'done' : ''}" onclick="toggleSchedDone('${s.id}')">
              <span class="t">${s.time ? s.time.slice(0, 5) : '종일'}</span>
              <span class="title">${s.title}</span>
              <span class="del" onclick="event.stopPropagation();deleteSched('${s.id}')">✕</span>
            </div>`).join('')}
          <div class="add-row-btn" onclick="openSchedModal('${ds}')">+ 일정 추가</div>
        </div>
      </div>`;
  }).join('');
}

function openSchedModal(dateStr) {
  document.getElementById('sc-id').value = '';
  document.getElementById('sc-title').value = '';
  document.getElementById('sc-date').value = dateStr || todayStr();
  document.getElementById('sc-time').value = '';
  document.getElementById('sc-memo').value = '';
  document.getElementById('modal-sched-title').textContent = '일정 등록';
  openModal('modal-schedule');
}

async function saveSched() {
  const title = document.getElementById('sc-title').value.trim();
  const date = document.getElementById('sc-date').value;
  if (!title || !date) { toast('제목과 날짜를 입력하세요.', 'error'); return; }
  const data = {
    '일정ID': document.getElementById('sc-id').value,
    '제목': title, '날짜': date,
    '시작시간': document.getElementById('sc-time').value,
    '메모': document.getElementById('sc-memo').value,
    '완료여부': 'N',
  };
  try {
    const res = await call('saveScheduleGAS', data);
    if (res.success) {
      toast('일정이 저장되었습니다.');
      closeModal('modal-schedule');
      STATE.schedules = (await call('getSchedules')) || [];
      renderWeek();
    } else toast(res.message || '저장 실패', 'error');
  } catch (e) { toast('오류: ' + e.message, 'error'); }
}

function normalizeSchedule(s) {
  return {
    id: s['일정ID'] || s.id || '',
    title: s['제목'] || s.title || '',
    date: (s['날짜'] || s.date || '').slice(0, 10),
    time: s['시작시간'] || s.time || '',
    memo: s['메모'] || s.memo || '',
    done: s['완료여부'] === 'Y' || s.done === true,
  };
}
async function toggleSchedDone(id) {
  const raw = STATE.schedules.find(s => (s['일정ID'] || s.id) === id);
  if (!raw) return;
  const s = normalizeSchedule(raw);
  s.done = !s.done;
  try {
    await call('saveScheduleGAS', { '일정ID': s.id, '제목': s.title, '날짜': s.date, '시작시간': s.time, '메모': s.memo, '완료여부': s.done ? 'Y' : 'N' });
    STATE.schedules = (await call('getSchedules')) || [];
    renderWeek();
  } catch (e) { toast('업데이트 실패: ' + e.message, 'error'); }
}
function deleteSched(id) {
  confirmDelete('이 일정을 삭제하시겠습니까?', async () => {
    try {
      await call('deleteScheduleGAS', id);
      STATE.schedules = (await call('getSchedules')) || [];
      renderWeek();
      toast('삭제되었습니다.');
    } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
  });
}

// ── 정규화 (렌더 전 매핑) ──
function normTodos() { return STATE.todos.map(t => ({
  id: t['할일ID'] || t.id || '', title: t['제목'] || t.title || '',
  status: t['상태'] || t.status || '할일', priority: t['우선순위'] || t.priority || '보통',
  dueDate: (t['마감일'] || t.dueDate || '').slice(0, 10), memo: t['메모'] || t.memo || '',
}));}
function normScheds() { STATE.schedules = STATE.schedules.map(normalizeSchedule); }

// ── 할일 달력 ──
function calNav(dir) {
  _calMonth += dir;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  renderTodoCalendar();
}
function calToday() { _calYear = new Date().getFullYear(); _calMonth = new Date().getMonth(); _selectedDate = todayStr(); renderTodoCalendar(); }

function renderTodoCalendar() {
  const label = document.getElementById('cal-label');
  label.textContent = `${_calYear}년 ${_calMonth + 1}월`;
  const todos = normTodos();
  const byDate = {};
  todos.forEach(t => { if (t.dueDate) (byDate[t.dueDate] ||= []).push(t); });

  const firstDow = new Date(_calYear, _calMonth, 1).getDay();
  const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
  const prevDays = new Date(_calYear, _calMonth, 0).getDate();
  const todayS = todayStr();

  let html = '';
  for (let i = 0; i < firstDow; i++) html += `<div class="cal-cell other"><div class="cal-daynum">${prevDays - firstDow + 1 + i}</div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${_calYear}-${String(_calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = ds === todayS, isSel = ds === _selectedDate;
    const items = (byDate[ds] || []).slice(0, 3);
    html += `<div class="cal-cell ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}" onclick="selectTodoDay('${ds}')">
      <div class="cal-daynum">${d}</div>
      ${items.map(t => `<div class="todo-chip ${t.status === '완료' ? 'done' : ''}">${t.title}</div>`).join('')}
      ${byDate[ds] && byDate[ds].length > 3 ? `<div style="font-size:.6rem;color:var(--text-muted)">+${byDate[ds].length - 3}</div>` : ''}
    </div>`;
  }
  const totalCells = firstDow + daysInMonth;
  const remain = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remain; i++) html += `<div class="cal-cell other"><div class="cal-daynum">${i}</div></div>`;
  document.getElementById('cal-grid').innerHTML = html;

  renderTodoOngoing();
  if (_selectedDate) selectTodoDay(_selectedDate); else renderTodoDayPanel(null);
}

function selectTodoDay(ds) { _selectedDate = ds; renderTodoCalendar(); renderTodoDayPanel(ds); }

function renderTodoDayPanel(ds) {
  const label = document.getElementById('todo-day-label');
  const list = document.getElementById('todo-day-list');
  if (!ds) { label.textContent = '날짜를 선택하세요'; list.innerHTML = ''; return; }
  const wd = ['일', '월', '화', '수', '목', '금', '토'];
  label.textContent = `${ds.slice(5).replace('-', '/')} (${wd[new Date(ds).getDay()]})`;
  const todos = normTodos().filter(t => t.dueDate === ds);
  if (!todos.length) { list.innerHTML = `<p style="color:var(--text-muted);font-size:.78rem;padding:10px 0">할일 없음</p>`; }
  else {
    list.innerHTML = todos.map(t => `
      <div class="todo-side-item">
        <div class="todo-checkbox ${t.status === '완료' ? 'checked' : ''}" onclick="toggleTodoDone('${t.id}')"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600;${t.status === '완료' ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${t.title}</div>
          <span class="pri-dot pri-${t.priority === '높음' ? 'high' : t.priority === '낮음' ? 'low' : 'mid'}" style="display:inline-block;margin-top:5px"></span>
        </div>
        <button class="del" style="font-size:.7rem;color:var(--text-muted)" onclick="deleteTodo('${t.id}')">✕</button>
      </div>`).join('');
  }
  document.getElementById('todo-add-btn').onclick = () => openTodoModal(ds);
}

function renderTodoOngoing() {
  const el = document.getElementById('todo-ongoing');
  const list = normTodos().filter(t => t.status !== '완료')
    .sort((a, b) => (a.dueDate || '9999') > (b.dueDate || '9999') ? 1 : -1).slice(0, 8);
  if (!list.length) { el.innerHTML = `<p style="color:var(--text-muted);font-size:.76rem;padding:8px 0">모두 완료!</p>`; return; }
  el.innerHTML = list.map(t => `
    <div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span class="pri-dot pri-${t.priority === '높음' ? 'high' : t.priority === '낮음' ? 'low' : 'mid'}"></span>
      <span style="font-size:.78rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title}</span>
      ${t.dueDate ? `<span style="font-family:var(--font-mono);font-size:.66rem;color:var(--text-muted)">${t.dueDate.slice(5)}</span>` : ''}
    </div>`).join('');
}

function openTodoModal(preDate) {
  document.getElementById('td-id').value = '';
  document.getElementById('td-title').value = '';
  document.getElementById('td-priority').value = '보통';
  document.getElementById('td-due').value = preDate || _selectedDate || todayStr();
  document.getElementById('td-memo').value = '';
  document.getElementById('modal-todo-title').textContent = '할일 등록';
  openModal('modal-todo');
}
async function saveTodo() {
  const title = document.getElementById('td-title').value.trim();
  if (!title) { toast('할일 제목을 입력하세요.', 'error'); return; }
  const data = {
    '할일ID': document.getElementById('td-id').value,
    '제목': title, '상태': '할일',
    '우선순위': document.getElementById('td-priority').value,
    '마감일': document.getElementById('td-due').value,
    '메모': document.getElementById('td-memo').value,
  };
  try {
    const res = await call('saveTodoGAS', data);
    if (res.success) {
      toast('할일이 저장되었습니다.');
      closeModal('modal-todo');
      STATE.todos = (await call('getTodos')) || [];
      renderTodoCalendar();
    } else toast(res.message || '저장 실패', 'error');
  } catch (e) { toast('오류: ' + e.message, 'error'); }
}
async function toggleTodoDone(id) {
  const raw = STATE.todos.find(t => (t['할일ID'] || t.id) === id);
  if (!raw) return;
  const t = { '할일ID': raw['할일ID'] || raw.id, '제목': raw['제목'] || raw.title, '우선순위': raw['우선순위'] || raw.priority, '마감일': raw['마감일'] || raw.dueDate, '메모': raw['메모'] || raw.memo };
  const curStatus = raw['상태'] || raw.status || '할일';
  t['상태'] = curStatus === '완료' ? '할일' : '완료';
  try {
    await call('saveTodoGAS', t);
    STATE.todos = (await call('getTodos')) || [];
    renderTodoCalendar();
  } catch (e) { toast('업데이트 실패: ' + e.message, 'error'); }
}
function deleteTodo(id) {
  confirmDelete('이 할일을 삭제하시겠습니까?', async () => {
    try {
      await call('deleteTodoGAS', id);
      STATE.todos = (await call('getTodos')) || [];
      renderTodoCalendar();
      toast('삭제되었습니다.');
    } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
  });
}
