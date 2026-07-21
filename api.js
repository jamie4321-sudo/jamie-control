// ============================================================
// api.js — GAS(Google Apps Script) 백엔드 연결 브릿지
// 깃허브 페이지 등 정적 호스팅에서 이 파일의 GAS_URL만 채우면
// 기존 call('fn', args...) 호출부는 그대로 재사용됩니다.
// ============================================================

// ★ 여기에 Apps Script "웹앱으로 배포" 후 나오는 /exec URL을 붙여넣으세요.
// 비워두면 자동으로 "데모 모드"(브라우저 localStorage)로 동작합니다.
const GAS_URL = ''; // 예: 'https://script.google.com/macros/s/AKfycb.../exec'

const IS_LIVE = !!GAS_URL;

// GAS Api.gs 라우터가 doPost에서 받아줄 함수 이름 화이트리스트
// (gas/Api.gs 의 API_REGISTRY와 반드시 일치해야 합니다)
async function gasCall(fn, args) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // preflight 회피
    body: JSON.stringify({ fn, args: args || [] }),
  });
  if (!res.ok) throw new Error('네트워크 오류: ' + res.status);
  const data = await res.json();
  if (data && data.error) throw new Error(data.message || '서버 오류');
  return data;
}

// ── 데모 모드: localStorage 기반 목업 백엔드 ──
const LS_KEY = (name) => 'sg_' + name;

function lsGet(name, fallback) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(name)) || 'null') ?? fallback; }
  catch (e) { return fallback; }
}
function lsSet(name, val) { localStorage.setItem(LS_KEY(name), JSON.stringify(val)); }
function genId(prefix) { return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000); }

const DEMO_USER = { id: 'USR_DEMO', name: '제이미', email: 'jamie@snackgarden.local', role: 'super' };

function seedDemoCrews() {
  const existing = lsGet('crews', null);
  if (existing) return existing;
  const seed = [
    { '크루ID': genId('CRW'), '이름': '김민준', '소속팀': '스낵앤가든사업팀', '직무유형': '스낵', '계약현황': '정규', '업무시간': '09:00~18:00', '입사일': '2024-03-04', '연락처': '010-1111-2222', '장애여부': '비장애', '장애유형': '', '상태': '재직' },
    { '크루ID': genId('CRW'), '이름': '이서연', '소속팀': '스낵앤가든사업팀', '직무유형': '가든', '계약현황': '정규', '업무시간': '09:00~18:00', '입사일': '2023-11-20', '연락처': '010-2222-3333', '장애여부': '장애', '장애유형': '지체', '상태': '재직' },
    { '크루ID': genId('CRW'), '이름': '박도윤', '소속팀': '스낵앤가든사업팀', '직무유형': '총무지원', '계약현황': '계약', '업무시간': '09:00~14:00', '입사일': '2025-01-10', '연락처': '010-3333-4444', '장애여부': '비장애', '장애유형': '', '상태': '재직' },
  ];
  lsSet('crews', seed);
  return seed;
}

const DEMO_ROUTER = {
  login: ([email]) => ({ success: true, user: DEMO_USER }),

  getDashboardData: () => {
    const crews = seedDemoCrews();
    return {
      totalCrews: crews.filter(c => c['상태'] !== '퇴사').length,
      unprocIssueCount: 0,
      monthInterviewCount: 0,
      monthEvalCount: 0,
      newCrewCount: 0,
      recentIssues: [],
      pendingNotifs: [],
    };
  },

  getCrews: () => seedDemoCrews(),
  getCrew: ([id]) => seedDemoCrews().find(c => c['크루ID'] === id) || null,
  saveCrew: ([data]) => {
    const crews = seedDemoCrews();
    if (data['크루ID']) {
      const idx = crews.findIndex(c => c['크루ID'] === data['크루ID']);
      if (idx >= 0) crews[idx] = { ...crews[idx], ...data };
      lsSet('crews', crews);
      return { success: true, id: data['크루ID'] };
    }
    const id = genId('CRW');
    crews.push({ ...data, '크루ID': id, '상태': data['상태'] || '재직' });
    lsSet('crews', crews);
    return { success: true, id };
  },
  deleteCrew: ([id]) => {
    const crews = seedDemoCrews().filter(c => c['크루ID'] !== id);
    lsSet('crews', crews);
    return { success: true };
  },

  getTodos: () => lsGet('todos', []),
  saveTodoGAS: ([data]) => {
    const todos = lsGet('todos', []);
    const id = data['할일ID'] || genId('td');
    const idx = todos.findIndex(t => t['할일ID'] === id);
    const item = { ...data, '할일ID': id };
    if (idx >= 0) todos[idx] = item; else todos.unshift(item);
    lsSet('todos', todos);
    return { success: true, id };
  },
  deleteTodoGAS: ([id]) => {
    lsSet('todos', lsGet('todos', []).filter(t => t['할일ID'] !== id));
    return { success: true };
  },

  getSchedules: () => lsGet('schedules', []),
  saveScheduleGAS: ([data]) => {
    const list = lsGet('schedules', []);
    const id = data['일정ID'] || genId('sc');
    const idx = list.findIndex(s => s['일정ID'] === id);
    const item = { ...data, '일정ID': id };
    if (idx >= 0) list[idx] = item; else list.push(item);
    lsSet('schedules', list);
    return { success: true, id };
  },
  deleteScheduleGAS: ([id]) => {
    lsSet('schedules', lsGet('schedules', []).filter(s => s['일정ID'] !== id));
    return { success: true };
  },
};

async function demoCall(fn, args) {
  await new Promise(r => setTimeout(r, 60));
  const handler = DEMO_ROUTER[fn];
  if (!handler) {
    console.warn('[데모 모드] 미구현 함수:', fn);
    return null;
  }
  console.log('[데모 모드]', fn, args);
  return handler(args || []);
}

// 공용 호출 함수 — 기존 코드의 call('fn', a, b, c) 시그니처를 그대로 유지
async function call(fn, ...args) {
  if (IS_LIVE) return gasCall(fn, args);
  return demoCall(fn, args);
}
