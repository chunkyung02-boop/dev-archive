// Dev Archive — 글은 posts.json 에 있고, 주인(토큰이 있는 사람)만 이 화면에서 직접 수정할 수 있습니다.
// 저장하면 GitHub 저장소의 posts.json 이 바뀌고, 1~2분 뒤 사이트에 반영됩니다.
const OWNER = "chunkyung02-boop";
const REPO = "dev-archive";
const FILE = "posts.json";
const BRANCH = "main";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const TOKEN_KEY = "devArchive.token";
const TYPES = ["프로젝트", "AX 자동화", "툴 리뷰"];

const $ = (s, r = document) => r.querySelector(s);
let site = { eyebrow: "", desc: "", posts: [] };
let admin = false;
let token = "";
const openIds = new Set();

// ---------- 글 본문(마크다운 비슷한 글) → 화면 ----------
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function inline(s) {
  let t = esc(s);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => `<img src="${u}" alt="${a}" loading="lazy">`);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`);
  t = t.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  return t.replace(/\n/g, "<br>");
}
function renderBody(md) {
  const lines = String(md || "").replace(/\r/g, "").split("\n");
  const sections = [];
  let cur = null;
  const push = (html) => {
    if (!cur) { cur = { title: "", html: "" }; sections.push(cur); }
    cur.html += html;
  };
  let i = 0;
  while (i < lines.length) {
    const L = lines[i];
    if (L.startsWith("## ")) { cur = { title: L.slice(3).trim(), html: "" }; sections.push(cur); i += 1; continue; }
    if (!L.trim()) { i += 1; continue; }
    if (L.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i += 1;
      }
      const head = rows.shift() || [];
      const th = head.map((c) => `<th>${inline(c)}</th>`).join("");
      const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
      push(`<div class="at-wrap"><table class="at"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`);
      continue;
    }
    const m = L.trim().match(/^\*\*(.+?)\*\*$/);
    if (m && m[1].startsWith("#")) {
      // 개선 루프 항목: **#1** 다음에 "- **항목**: 내용" 줄들
      i += 1;
      let dl = "";
      while (i < lines.length && /^- \*\*/.test(lines[i])) {
        const mm = lines[i].match(/^- \*\*(.+?)\*\*:\s*(.*)$/);
        i += 1;
        if (!mm) continue;
        let v = mm[2];
        while (i < lines.length && lines[i].trim() && !/^- \*\*/.test(lines[i]) && !lines[i].startsWith("## ") && !/^\*\*/.test(lines[i].trim())) {
          v += "\n" + lines[i];
          i += 1;
        }
        dl += `<div><dt>${esc(mm[1])}</dt><dd>${inline(v)}</dd></div>`;
      }
      push(`<div class="aloop"><span>${esc(m[1])}</span><dl>${dl}</dl></div>`);
      continue;
    }
    if (m) {
      i += 1;
      const buf = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith("## ") && !lines[i].startsWith("|") && !/^\*\*(.+?)\*\*$/.test(lines[i].trim()) && !/^- \*\*/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      push(`<div class="af"><b>${esc(m[1])}</b><p>${inline(buf.join("\n"))}</p></div>`);
      continue;
    }
    if (/^\d+\. /.test(L)) {
      let li = "";
      while (i < lines.length && /^\d+\. /.test(lines[i])) { li += `<li>${inline(lines[i].replace(/^\d+\. /, ""))}</li>`; i += 1; }
      push(`<ol class="al-list">${li}</ol>`);
      continue;
    }
    if (/^- /.test(L)) {
      let li = "";
      while (i < lines.length && /^- /.test(lines[i])) {
        let s = lines[i].slice(2);
        i += 1;
        while (i < lines.length && /^\s+\S/.test(lines[i])) { s += "\n" + lines[i].trim(); i += 1; }
        li += `<li>${inline(s)}</li>`;
      }
      push(`<ul class="al-list">${li}</ul>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("## ") && !lines[i].startsWith("|")) { buf.push(lines[i]); i += 1; }
    push(`<p class="ap">${inline(buf.join("\n"))}</p>`);
  }
  return sections.map((s) => `<section class="asec">${s.title ? `<h4>${esc(s.title)}</h4>` : ""}<div>${s.html}</div></section>`).join("");
}

// ---------- 목록 화면 ----------
function sortedPosts() {
  return site.posts
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => admin || !p.draft)
    .sort((a, b) => (a.p.date < b.p.date ? 1 : a.p.date > b.p.date ? -1 : a.idx - b.idx))
    .map(({ p }) => p);
}
function render() {
  const list = sortedPosts();
  let rows = "";
  let n = 1;
  for (const it of list) {
    let tags = "";
    for (const t of it.tags || []) tags += `<span>#${esc(t)}</span>`;
    const open = openIds.has(it.id) ? " open" : "";
    rows += `
      <article class="arc${open}" id="${esc(it.id)}">
        <button class="arc-head" type="button" aria-expanded="${open ? "true" : "false"}">
          <span class="arc-meta"><i>${String(n).padStart(2, "0")}</i><span>${esc(it.date)}</span><span>${esc(it.type)}</span><em>${esc(it.status)}</em>${it.draft ? '<em class="draft">비공개 초안</em>' : ""}</span>
          <span class="arc-main"><h3>${esc(it.title)}</h3><p>${inline(it.summary || "")}</p><span class="arc-tags">${tags}</span></span>
          <span class="arc-plus" aria-hidden="true"></span>
        </button>
        <div class="arc-body"><div class="arc-body-in">
          ${admin ? `<div class="admin-row"><button class="btn" data-act="edit" data-id="${esc(it.id)}">수정</button></div>` : ""}
          ${it.note ? `<p class="anote">${esc(it.note)}</p>` : ""}
          ${renderBody(it.body)}
        </div></div>
      </article>`;
    n += 1;
  }
  if (!rows) rows = `<p class="empty">아직 글이 없습니다.</p>`;
  $("#main").innerHTML = `
    <section class="page-head wrap">
      <p class="eyebrow">${esc(site.eyebrow)}</p>
      <h1>Dev Archive</h1>
      <p class="desc">${esc(site.desc)}</p>
      ${admin ? `<div class="admin-bar"><button class="btn primary" data-act="new">+ 새 글 쓰기</button><span>관리자 모드 · 저장하면 1~2분 뒤 사이트에 반영됩니다</span></div>` : ""}
    </section>
    <section class="wrap arcs">${rows}</section>`;
  $("#adminLink").textContent = admin ? "로그아웃" : "관리자";
}

document.addEventListener("click", (e) => {
  const head = e.target.closest(".arc-head");
  if (head) {
    const el = head.parentElement;
    const open = el.classList.toggle("open");
    head.setAttribute("aria-expanded", open);
    if (open) openIds.add(el.id); else openIds.delete(el.id);
    return;
  }
  const act = e.target.closest("[data-act]");
  if (!act) return;
  if (act.dataset.act === "new") openEditor(null);
  if (act.dataset.act === "edit") openEditor(site.posts.find((p) => p.id === act.dataset.id));
});

// ---------- 알림 ----------
function toast(msg, ms = 3200) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("on"), ms);
}

// ---------- GitHub 저장 ----------
function b64enc(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64dec(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, "")))); }
async function gh(path, opt = {}) {
  const r = await fetch(API + path, {
    ...opt,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", ...(opt.headers || {}) },
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const err = new Error(j.message || `GitHub ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}
async function fetchLatest() {
  const j = await gh(`/contents/${FILE}?ref=${BRANCH}&t=${Date.now()}`);
  return { sha: j.sha, data: JSON.parse(b64dec(j.content)) };
}
async function commit(mutate, message, retry = true) {
  const { sha, data } = await fetchLatest();
  mutate(data);
  try {
    await gh(`/contents/${FILE}`, {
      method: "PUT",
      body: JSON.stringify({ message, content: b64enc(JSON.stringify(data, null, 1)), sha, branch: BRANCH }),
    });
  } catch (e) {
    if (e.status === 409 && retry) return commit(mutate, message, false);
    throw e;
  }
  site = data;
}

// ---------- 로그인 ----------
async function verifyToken(t) {
  token = t;
  const repo = await gh("");
  if (!repo.permissions || !repo.permissions.push) throw new Error("이 토큰에는 저장소 글쓰기 권한이 없습니다.");
}
function openLogin() {
  const m = modal(`
    <h2>관리자 로그인</h2>
    <p class="hint">GitHub 토큰을 한 번만 붙여 넣으면 이 브라우저에 저장됩니다. 방문자에게는 보이지 않습니다.</p>
    <ol class="steps">
      <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">토큰 만들기 페이지</a> 열기</li>
      <li>Repository access → <b>Only select repositories</b> → <b>dev-archive</b> 선택</li>
      <li>Permissions → Repository permissions → <b>Contents: Read and write</b></li>
      <li>Generate token → 나온 토큰(github_pat_…)을 아래에 붙여 넣기</li>
    </ol>
    <input id="tokenIn" type="password" placeholder="github_pat_..." autocomplete="off">
    <div class="m-actions"><button class="btn" data-m="close">취소</button><button class="btn primary" data-m="login">로그인</button></div>
    <p class="err" id="loginErr"></p>`);
  $("[data-m=login]", m).onclick = async () => {
    const t = $("#tokenIn", m).value.trim();
    if (!t) return;
    $("#loginErr", m).textContent = "확인 중…";
    try {
      await verifyToken(t);
      try { localStorage.setItem(TOKEN_KEY, t); } catch (_) {}
      admin = true;
      closeModal();
      render();
      toast("관리자 모드로 로그인했습니다");
    } catch (e) {
      token = "";
      $("#loginErr", m).textContent = "로그인 실패: " + e.message;
    }
  };
}
$("#adminLink").addEventListener("click", (e) => {
  e.preventDefault();
  if (admin) {
    admin = false; token = "";
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    render();
    toast("로그아웃했습니다");
  } else openLogin();
});

// ---------- 모달 ----------
function modal(html, wide) {
  closeModal();
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="modal-box${wide ? " wide" : ""}">${html}</div>`;
  document.body.appendChild(m);
  document.body.style.overflow = "hidden";
  m.addEventListener("click", (e) => {
    if (e.target === m || e.target.dataset.m === "close") closeModal();
  });
  return m;
}
function closeModal() {
  const m = $(".modal");
  if (m) m.remove();
  document.body.style.overflow = "";
}

// ---------- 글쓰기 / 수정 ----------
const SNIPPETS = {
  "섹션": "\n## 섹션 제목\n\n",
  "항목": "\n**항목 이름**\n내용을 적습니다\n",
  "목록": "\n- 첫째\n- 둘째\n",
  "표": "\n| 구분 | 내용 |\n|---|---|\n| 값1 | 값2 |\n",
  "개선 사례": "\n**#1**\n- **문제 발견**: \n- **원인**: \n- **시도한 방법 (비교)**: \n- **선택과 결과**: \n",
};
function openEditor(post) {
  const isNew = !post;
  const d = post ? JSON.parse(JSON.stringify(post)) : {
    id: "p" + Date.now().toString(36), title: "", type: "프로젝트", date: new Date().toISOString().slice(0, 10),
    status: "진행중", tags: [], summary: "", note: "", draft: false,
    body: "## 문제와 목표\n\n**해결하려던 문제**\n\n\n**목표와 성공 기준**\n\n\n## 결과\n\n\n## 회고\n\n",
  };
  const draftKey = "devArchive.draft." + d.id;
  try {
    const s = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (s && confirm("저장하지 못한 임시 글이 있습니다. 불러올까요?")) Object.assign(d, s);
  } catch (_) {}
  const opts = (arr, v) => arr.map((o) => `<option${o === v ? " selected" : ""}>${o}</option>`).join("");
  const m = modal(`
    <h2>${isNew ? "새 글" : "글 수정"}</h2>
    <div class="grid">
      <label>제목<input id="eTitle" value="${esc(d.title)}"></label>
      <label>유형<select id="eType">${opts(TYPES, d.type)}</select></label>
      <label>날짜<input id="eDate" type="date" value="${esc(d.date)}"></label>
      <label>상태<select id="eStatus">${opts(["진행중", "완료"], d.status)}</select></label>
    </div>
    <label>태그 (쉼표로 구분)<input id="eTags" value="${esc((d.tags || []).join(", "))}"></label>
    <label>한 줄 요약<input id="eSummary" value="${esc(d.summary)}"></label>
    <label>안내 문구 (선택, 본문 위에 표시)<input id="eNote" value="${esc(d.note || "")}"></label>
    <div class="snips"><span>끼워 넣기</span>${Object.keys(SNIPPETS).map((k) => `<button class="btn sm" data-snip="${k}">${k}</button>`).join("")}
      <button class="btn sm" data-img>이미지 올리기</button><input id="imgFile" type="file" accept="image/*" hidden>
      <button class="btn sm" data-preview>미리보기</button></div>
    <textarea id="eBody" spellcheck="false">${esc(d.body)}</textarea>
    <div id="ePreview" class="preview" hidden></div>
    <label class="chk"><input id="eDraft" type="checkbox"${d.draft ? " checked" : ""}> 비공개 초안 (나에게만 보임)</label>
    <div class="m-actions">
      ${isNew ? "" : `<button class="btn danger" data-del>삭제</button>`}
      <span class="sp"></span>
      <button class="btn" data-m="close">취소</button>
      <button class="btn primary" data-save>저장</button>
    </div>
    <p class="err" id="eErr"></p>`, true);
  const body = $("#eBody", m);
  const read = () => ({
    ...d, title: $("#eTitle", m).value.trim(), type: $("#eType", m).value, date: $("#eDate", m).value,
    status: $("#eStatus", m).value, tags: $("#eTags", m).value.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
    summary: $("#eSummary", m).value.trim(), note: $("#eNote", m).value.trim(), draft: $("#eDraft", m).checked, body: body.value.replace(/\s+$/, ""),
  });
  const keep = () => { try { localStorage.setItem(draftKey, JSON.stringify(read())); } catch (_) {} };
  m.addEventListener("input", keep);
  m.addEventListener("click", async (e) => {
    const snip = e.target.closest("[data-snip]");
    if (snip) {
      const s = SNIPPETS[snip.dataset.snip];
      const pos = body.selectionStart;
      body.value = body.value.slice(0, pos) + s + body.value.slice(body.selectionEnd);
      body.focus();
      body.selectionStart = body.selectionEnd = pos + s.length;
      keep();
    }
    if (e.target.closest("[data-preview]")) {
      const pv = $("#ePreview", m);
      pv.hidden = !pv.hidden;
      body.hidden = !pv.hidden;
      if (!pv.hidden) pv.innerHTML = renderBody(body.value);
      e.target.textContent = pv.hidden ? "미리보기" : "편집으로";
    }
    if (e.target.closest("[data-img]")) $("#imgFile", m).click();
    if (e.target.closest("[data-del]")) {
      if (!confirm("이 글을 삭제할까요? 되돌리려면 GitHub 기록에서 복구해야 합니다.")) return;
      try {
        await commit((data) => { data.posts = data.posts.filter((p) => p.id !== d.id); }, `삭제: ${d.title}`);
        try { localStorage.removeItem(draftKey); } catch (_) {}
        closeModal();
        render();
        toast("삭제했습니다 · 사이트 반영까지 1~2분");
      } catch (err) { $("#eErr", m).textContent = "삭제 실패: " + err.message; }
    }
    if (e.target.closest("[data-save]")) {
      const p = read();
      if (!p.title) { $("#eErr", m).textContent = "제목을 입력해 주세요."; return; }
      $("#eErr", m).textContent = "저장 중…";
      try {
        await commit((data) => {
          const i = data.posts.findIndex((x) => x.id === p.id);
          if (i >= 0) data.posts[i] = p; else data.posts.unshift(p);
        }, `${isNew ? "새 글" : "수정"}: ${p.title}`);
        try { localStorage.removeItem(draftKey); } catch (_) {}
        openIds.add(p.id);
        closeModal();
        render();
        toast("저장했습니다 · 사이트 반영까지 1~2분");
      } catch (err) { $("#eErr", m).textContent = "저장 실패: " + err.message; }
    }
  });
  $("#imgFile", m).addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $("#eErr", m).textContent = "이미지 올리는 중…";
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = "";
      for (const b of buf) bin += String.fromCharCode(b);
      const name = `img/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      await gh(`/contents/${name}`, { method: "PUT", body: JSON.stringify({ message: `이미지: ${f.name}`, content: btoa(bin), branch: BRANCH }) });
      const s = `\n![${f.name}](${name})\n`;
      const pos = body.selectionStart;
      body.value = body.value.slice(0, pos) + s + body.value.slice(body.selectionEnd);
      $("#eErr", m).textContent = "이미지를 넣었습니다. 저장을 눌러야 글에 반영됩니다.";
      keep();
    } catch (err) { $("#eErr", m).textContent = "이미지 업로드 실패: " + err.message; }
  });
}

// ---------- 시작 ----------
(async function init() {
  try {
    const r = await fetch(`${FILE}?v=${Date.now()}`, { cache: "no-store" });
    site = await r.json();
  } catch (e) {
    $("#main").innerHTML = `<p class="empty wrap" style="padding-top:140px">글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>`;
    return;
  }
  const hashId = location.hash.slice(1);
  if (hashId && hashId !== "admin") openIds.add(hashId);
  else { const f = sortedPosts()[0]; if (f) openIds.add(f.id); }
  render();
  if (hashId && hashId !== "admin") {
    setTimeout(() => { const el = document.getElementById(hashId); if (el) el.scrollIntoView({ behavior: "smooth" }); }, 300);
  }
  let saved = "";
  try { saved = localStorage.getItem(TOKEN_KEY) || ""; } catch (_) {}
  if (saved) {
    try { await verifyToken(saved); admin = true; render(); } catch (_) { token = ""; }
  }
  if (location.hash === "#admin" && !admin) openLogin();
})();

const onScroll = () => document.body.classList.toggle("scrolled", window.scrollY > 20);
window.addEventListener("scroll", onScroll);
onScroll();
