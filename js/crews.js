// ============================================================
// crews.js — 크루 목록 / 등록 / 수정 / 삭제
// ============================================================

async function loadCrews() {
  const wrap = document.getElementById('crew-table-wrap');
  wrap.innerHTML = '<div class="spinner"></div>';
  try { STATE.crews = await call('getCrews') || []; }
  catch (e) { wrap.innerHTML = `<p style="color:var(--danger)">로드 실패: ${e.message}</p>`; return; }
  renderCrews();
}

function renderCrews() {
  const job = document.getElementById('crew-filter-job').value;
  const status = document.getElementById('crew-filter-status').value;
  const kw = document.getElementById('crew-search').value.trim().toLowerCase();

  let list = STATE.crews.filter(c => {
    if (job && c['직무유형'] !== job) return false;
    if (status && c['상태'] !== status) return false;
    if (kw && !(c['이름'] || '').toLowerCase().includes(kw)) return false;
    return true;
  });

  const wrap = document.getElementById('crew-table-wrap');
  if (!list.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="icon">◇</div><p>조건에 맞는 크루가 없습니다.</p></div>`;
    return;
  }

  list = [...list].sort((a, b) => (a['상태'] === '퇴사' ? 1 : 0) - (b['상태'] === '퇴사' ? 1 : 0));

  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>크루</th><th>직무</th><th>계약</th><th>입사일</th><th>근속</th><th>상태</th><th></th></tr></thead>
        <tbody>
          ${list.map(c => {
            const jt = jobStyle(c['직무유형']);
            const disCls = c['상태'] === '퇴사' ? 'opacity:.45' : '';
            const statusBadge = c['상태'] === '재직' ? 'badge-accent' : c['상태'] === '휴직' ? 'badge-warn' : 'badge-neutral';
            const jobColorMap = { snack: 'var(--job-snack)', garden: 'var(--job-garden)', support: 'var(--job-support)', none: 'var(--text-muted)' };
            const avBg = { snack: 'var(--job-snack-soft)', garden: 'var(--job-garden-soft)', support: 'var(--job-support-soft)', none: 'var(--bg-surface-3)' }[jt.cls];
            return `<tr class="clickable" style="${disCls}" onclick='openCrewDetail(${JSON.stringify(c['크루ID'])})'>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="avatar-circle" style="background:${avBg};color:${jobColorMap[jt.cls]}">${(c['이름'] || '?').charAt(0)}</div>
                  <div><div class="row-name">${c['이름'] || '—'}</div><div class="row-sub">${c['소속팀'] || ''}</div></div>
                </div>
              </td>
              <td>${jobTag(c['직무유형'])}</td>
              <td style="color:var(--text-secondary)">${c['계약현황'] || '—'}</td>
              <td style="font-family:var(--font-mono);font-size:.76rem;color:var(--text-secondary)">${fmtDate(c['입사일']) || '—'}</td>
              <td style="color:var(--text-secondary)">${c['입사일'] ? calcTenure(c['입사일']) : '—'}</td>
              <td><span class="badge ${statusBadge}">${c['상태'] || '재직'}</span></td>
              <td onclick="event.stopPropagation()">
                <button class="btn-icon" onclick='openCrewModal(${JSON.stringify(c['크루ID'])})' title="수정">✎</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function openCrewDetail(crewId) { openCrewModal(crewId); }

function openCrewModal(crewId) {
  const d = crewId ? STATE.crews.find(c => c['크루ID'] === crewId) : null;
  document.getElementById('c-id').value = d ? d['크루ID'] : '';
  document.getElementById('c-name').value = d ? d['이름'] || '' : '';
  document.getElementById('c-team').value = d ? d['소속팀'] || '스낵앤가든사업팀' : '스낵앤가든사업팀';
  document.getElementById('c-job').value = d ? d['직무유형'] || '' : '';
  document.getElementById('c-contract').value = d ? d['계약현황'] || '' : '';
  document.getElementById('c-hours').value = d ? d['업무시간'] || '' : '';
  document.getElementById('c-joindate').value = d ? fmtDate(d['입사일']) : todayStr();
  document.getElementById('c-phone').value = d ? d['연락처'] || '' : '';
  document.getElementById('c-dis').value = d ? d['장애여부'] || '' : '';
  document.getElementById('c-distype').value = d ? d['장애유형'] || '' : '';
  document.getElementById('c-status').value = d ? d['상태'] || '재직' : '재직';
  document.getElementById('modal-crew-title').textContent = d ? '크루 정보 수정' : '신규 크루 등록';
  openModal('modal-crew');
}

async function saveCrew() {
  const data = {
    '크루ID': document.getElementById('c-id').value,
    '이름': document.getElementById('c-name').value.trim(),
    '소속팀': document.getElementById('c-team').value.trim(),
    '직무유형': document.getElementById('c-job').value,
    '계약현황': document.getElementById('c-contract').value,
    '업무시간': document.getElementById('c-hours').value,
    '입사일': document.getElementById('c-joindate').value,
    '연락처': document.getElementById('c-phone').value,
    '장애여부': document.getElementById('c-dis').value,
    '장애유형': document.getElementById('c-distype').value,
    '상태': document.getElementById('c-status').value,
  };
  if (!data['이름']) { toast('이름을 입력하세요.', 'error'); return; }
  try {
    const res = await call('saveCrew', data);
    if (res.success) { toast('저장되었습니다.'); closeModal('modal-crew'); loadCrews(); }
    else toast(res.message || '저장 실패', 'error');
  } catch (e) { toast('오류: ' + e.message, 'error'); }
}

function deleteCrewFromModal() {
  const id = document.getElementById('c-id').value;
  const name = document.getElementById('c-name').value;
  if (!id) return;
  confirmDelete(`<strong>${name}</strong> 크루를 삭제하시겠습니까?`, async () => {
    try {
      await call('deleteCrew', id);
      toast('삭제되었습니다.');
      closeModal('modal-crew');
      loadCrews();
    } catch (e) { toast('삭제 실패: ' + e.message, 'error'); }
  });
}
