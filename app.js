// Dev Archive 화면 그리기 — 데이터는 data.js 의 ARCHIVE
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function br(s) { return esc(s).replace(/\n/g, "<br>"); }

function blockHTML(b) {
  if (b.t === "field") return `<div class="af"><b>${esc(b.label)}</b><p>${br(b.text)}</p></div>`;
  if (b.t === "p") return `<p class="ap">${br(b.text)}</p>`;
  if (b.t === "ol" || b.t === "ul") {
    let li = "";
    for (const t of b.items) li += `<li>${br(t)}</li>`;
    return `<${b.t} class="al-list">${li}</${b.t}>`;
  }
  if (b.t === "table") {
    let th = "";
    for (const h of b.head) th += `<th>${br(h)}</th>`;
    let tr = "";
    for (const r of b.rows) {
      let td = "";
      for (const cell of r) td += `<td>${br(cell)}</td>`;
      tr += `<tr>${td}</tr>`;
    }
    return `<div class="at-wrap"><table class="at"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }
  if (b.t === "loop") {
    let dl = "";
    for (const [k, v] of b.pairs) dl += `<div><dt>${esc(k)}</dt><dd>${br(v)}</dd></div>`;
    return `<div class="aloop"><span>${esc(b.label)}</span><dl>${dl}</dl></div>`;
  }
  return "";
}

let rows = "";
let n = 1;
for (const it of ARCHIVE.items) {
  let body = it.note ? `<p class="anote">${esc(it.note)}</p>` : "";
  for (const s of it.sections) {
    let inner = "";
    for (const b of s.blocks) inner += blockHTML(b);
    body += `<section class="asec"><h4>${esc(s.title)}</h4><div>${inner}</div></section>`;
  }
  let tags = "";
  for (const t of it.tags) tags += `<span>#${esc(t)}</span>`;
  rows += `
    <article class="arc" id="${it.id}">
      <button class="arc-head" type="button" aria-expanded="false">
        <span class="arc-meta"><i>${String(n).padStart(2, "0")}</i><span>${esc(it.date)}</span><span>${esc(it.type)}</span><em>${esc(it.status)}</em></span>
        <span class="arc-main"><h3>${esc(it.title)}</h3><p>${br(it.summary)}</p><span class="arc-tags">${tags}</span></span>
        <span class="arc-plus" aria-hidden="true"></span>
      </button>
      <div class="arc-body"><div class="arc-body-in">${body}</div></div>
    </article>`;
  n += 1;
}

document.getElementById("main").innerHTML = `
  <section class="page-head wrap">
    <p class="eyebrow">${ARCHIVE.eyebrow}</p>
    <h1>Dev Archive</h1>
    <p class="desc">${ARCHIVE.desc}</p>
  </section>
  <section class="wrap arcs">${rows}</section>`;

const arcs = document.querySelectorAll(".arc");
for (const el of arcs) {
  el.querySelector(".arc-head").addEventListener("click", () => {
    const open = el.classList.toggle("open");
    el.querySelector(".arc-head").setAttribute("aria-expanded", open);
  });
}
// 주소 끝 #id 로 들어오면 그 글을 펼침 (포트폴리오 메뉴에서 바로 연결). 없으면 첫 글
const hashEl = location.hash ? document.querySelector(location.hash) : null;
const first = hashEl && hashEl.classList.contains("arc") ? hashEl : arcs[0];
if (first) {
  first.classList.add("open");
  first.querySelector(".arc-head").setAttribute("aria-expanded", "true");
  if (hashEl) setTimeout(() => first.scrollIntoView({ behavior: "smooth" }), 400);
}

// 헤더: 조금 스크롤하면 반투명 배경
const onScroll = () => document.body.classList.toggle("scrolled", window.scrollY > 20);
window.addEventListener("scroll", onScroll);
onScroll();
