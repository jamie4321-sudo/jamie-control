// ============================================================
// Api.gs — 깃허브(정적 호스팅)에서 fetch()로 호출하기 위한 JSON API 라우터
//
// 사용법:
//   1. 기존 Apps Script 프로젝트(Code.gs, Code_NewModules.gs가 있는 곳)에
//      이 파일을 새 스크립트 파일로 추가하세요.
//   2. 배포 > 새 배포 > 웹앱으로 배포
//        - 실행 대상: 나(본인 계정)
//        - 액세스 권한: 전체 공개(익명 포함)
//   3. 생성된 /exec URL을 깃허브 쪽 js/api.js 의 GAS_URL 에 붙여넣으세요.
//
// ★ 기존 doGet(e)이 index.html을 서빙하던 것과 충돌하지 않도록,
//    이 라우터는 e.parameter.fn 또는 POST body의 fn 값이 있을 때만 동작하고,
//    없을 때는 기존 동작(HTML 서빙)으로 자연스럽게 넘어갑니다.
//    (아래 doGet은 기존 Code.gs의 doGet과 이름이 겹치므로,
//     Code.gs 쪽 doGet은 함수명을 doGetPage 등으로 바꾸거나
//     이 파일의 라우팅 분기를 Code.gs의 doGet 안에 합쳐 넣으세요.)
// ============================================================

// 읽기 전용(GET) 허용 함수 목록
const API_GET_WHITELIST = [
  'getDashboardData', 'getCrews', 'getCrew', 'getCrewProfile',
  'getInterviews', 'getEvaluations', 'getIssues', 'getAttendance',
  'getEducation', 'getHrHistory', 'getNotifications', 'getActivityLog',
  'getUsers', 'getKpiRecords', 'getClients', 'getTodos', 'getSchedules',
  'getNotes', 'getReports', 'getSettlements', 'getBillingRecords', 'getCrewSnapshots',
];

// 쓰기(POST) 허용 함수 목록
const API_POST_WHITELIST = [
  'login', 'saveCrew', 'deleteCrew',
  'saveInterview', 'deleteInterview', 'saveEvaluation', 'deleteEvaluation',
  'saveIssue', 'deleteIssue', 'saveAttendance', 'deleteAttendance',
  'saveEducation', 'deleteEducation', 'saveHrHistory', 'deleteHrHistory',
  'saveNotification', 'resolveNotification', 'deleteNotification', 'saveUser',
  'saveKpiRecord', 'deleteKpiRecord', 'saveSensitiveInfo',
  'saveClient', 'deleteClient', 'saveTodoGAS', 'deleteTodoGAS',
  'saveScheduleGAS', 'deleteScheduleGAS', 'saveNoteGAS', 'deleteNoteGAS',
  'saveReport', 'deleteReport', 'saveSettlement', 'deleteSettlement',
  'saveBillingRecord', 'deleteBillingRecord', 'saveCrewSnapshot',
];

function apiJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiDispatch_(fn, args, whitelist) {
  if (whitelist.indexOf(fn) === -1) {
    return apiJson_({ error: true, message: '허용되지 않은 함수입니다: ' + fn });
  }
  try {
    const target = this[fn] || globalThis[fn];
    if (typeof target !== 'function') {
      return apiJson_({ error: true, message: '함수를 찾을 수 없습니다: ' + fn });
    }
    const result = target.apply(null, args || []);
    return apiJson_(result);
  } catch (err) {
    return apiJson_({ error: true, message: err.message });
  }
}

// ── GET: 조회 전용, 쿼리스트링 ?fn=getCrews&args=[]  ──
function apiHandleGet(e) {
  const fn = e.parameter.fn;
  let args = [];
  if (e.parameter.args) {
    try { args = JSON.parse(e.parameter.args); } catch (err) { args = []; }
  }
  return apiDispatch_(fn, args, API_GET_WHITELIST);
}

// ── POST: 쓰기 전용, body = {"fn":"saveCrew","args":[{...}]} ──
function apiHandlePost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return apiJson_({ error: true, message: 'JSON 파싱 오류: ' + err.message }); }
  return apiDispatch_(body.fn, body.args, API_POST_WHITELIST);
}

// ────────────────────────────────────────────────────────────
// 아래 doGet / doPost 를 그대로 쓰려면, 기존 Code.gs에 있는
// doGet(e) 함수 이름을 지우거나 doGetPage(e) 등으로 바꿔주세요.
// (Apps Script는 같은 이름의 함수가 두 파일에 있으면 배포 시 충돌합니다)
// ────────────────────────────────────────────────────────────
function doGet(e) {
  if (e && e.parameter && e.parameter.fn) {
    return apiHandleGet(e);
  }
  // fn 파라미터가 없을 때는 기존처럼 아무 데이터도 없는 안내 응답
  return apiJson_({ ok: true, message: '스낵앤가든 API 서버가 정상 동작 중입니다.' });
}

function doPost(e) {
  return apiHandlePost(e);
}
