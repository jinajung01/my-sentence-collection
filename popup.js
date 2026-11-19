// 문장 서랍 — 팝업

// 문의 메일 주소: 이 한 줄만 바꾸면 됩니다
const CONTACT_EMAIL = "you@example.com";

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const p2 = (n) => String(n).padStart(2, "0");
const fmt = (iso) => { const d = new Date(iso); return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u || ""; } };
const isWeb = (u) => /^https?:\/\//i.test(u || "");

// 저장 데이터
let sentences = [];
let tags = [];

// 화면 상태 (저장하지 않음)
const ui = {
  query: "",
  filter: null,      // 고른 태그, 없으면 전체
  confirmAll: false, // 전체 삭제 확인
  confirmTag: null,  // 삭제 확인 중인 태그
  adding: false,     // 새 태그 입력칸
  newFor: null,      // 새 태그를 바로 달 문장 id
  tagError: ""
};

async function load() {
  const data = await chrome.storage.local.get(["sentences", "tags"]);
  sentences = (data.sentences || []).map((s) => ({ tag: "", marks: [], ...s }));
  tags = data.tags || [];
  if (ui.filter && !tags.includes(ui.filter)) ui.filter = null;
  render();
}
async function persist() {
  await chrome.storage.local.set({ sentences, tags });
}

/* ---------- 머리 ---------- */
function renderHeader() {
  const n = sentences.length;
  $("count").hidden = !n;
  $("count").textContent = `${n}개`;
  $("clearAll").disabled = !n;
  $("search").disabled = !n;
  if (!n) $("search").value = ui.query = "";

  // 확인 영역
  const cf = $("confirm");
  cf.replaceChildren();
  cf.hidden = true;
  if (ui.confirmAll || ui.confirmTag) {
    cf.hidden = false;
    const txt = el("div");
    const row = el("div", "row");
    const yes = el("button", "btn danger"), no = el("button", "btn ghost", "취소");
    yes.type = no.type = "button";
    if (ui.confirmAll) {
      txt.append(`저장된 문장 ${n}개를 모두 지울까요?`, el("small", "", "지운 문장은 되돌릴 수 없어요."));
      yes.textContent = "모두 삭제";
      yes.onclick = async () => { sentences = []; ui.confirmAll = false; ui.filter = null; ui.query = ""; $("search").value = ""; await persist(); render(); };
      no.onclick = () => { ui.confirmAll = false; render(); };
    } else {
      const t = ui.confirmTag, k = sentences.filter((s) => s.tag === t).length;
      txt.append(`‘${t}’ 태그를 지울까요?`, el("small", "", k ? `안의 문장 ${k}개는 지워지지 않고 태그만 빠져요.` : "이 태그에는 문장이 없어요."));
      yes.textContent = "태그 삭제";
      yes.onclick = async () => {
        sentences.forEach((s) => { if (s.tag === t) s.tag = ""; });
        tags = tags.filter((x) => x !== t);
        ui.confirmTag = null; ui.filter = null;
        await persist(); render();
      };
      no.onclick = () => { ui.confirmTag = null; render(); };
    }
    row.append(yes, no);
    cf.append(txt, row);
  }

  // 태그 칩 줄
  const chips = $("chips");
  chips.replaceChildren();
  chips.hidden = !n;
  if (!n) return;
  const chip = (label, val, count) => {
    const b = el("button", "chip", label);
    b.type = "button";
    b.append(el("b", "", String(count)));
    b.setAttribute("aria-pressed", String(ui.filter === val));
    b.onclick = () => { ui.filter = val; ui.confirmTag = null; render(); };
    return b;
  };
  if (tags.length) {
    chips.append(chip("전체", null, n));
    tags.forEach((t) => chips.append(chip(t, t, sentences.filter((s) => s.tag === t).length)));
  }
  if (ui.adding) {
    const inp = el("input", "tag-input");
    inp.id = "tagInput"; inp.placeholder = "새 태그 이름"; inp.maxLength = 10;
    inp.setAttribute("aria-label", "새 태그 이름");
    inp.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); addTag(inp.value); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancelAdd(); }
    };
    const ok = el("button", "btn soft", "추가"); ok.type = "button"; ok.onclick = () => addTag(inp.value);
    const cancel = el("button", "chip plain", "취소"); cancel.type = "button"; cancel.onclick = cancelAdd;
    chips.append(inp, ok, cancel);
    if (ui.tagError) chips.append(el("span", "error", ui.tagError));
  } else {
    const add = el("button", "chip plain", tags.length ? "+ 태그" : "+ 태그 만들기");
    add.type = "button";
    add.onclick = () => startAdd(null);
    chips.append(add);
  }
  if (ui.filter && !ui.confirmTag) {
    const d = el("button", "chip warn", "이 태그 삭제");
    d.type = "button";
    d.onclick = () => { ui.confirmTag = ui.filter; render(); };
    chips.append(d);
  }
}

function startAdd(sentenceId) {
  ui.adding = true; ui.newFor = sentenceId; ui.tagError = "";
  render();
  const inp = $("tagInput");
  if (inp) { inp.scrollIntoView({ block: "nearest" }); window.scrollTo(0, 0); inp.focus(); }
}
function cancelAdd() { ui.adding = false; ui.newFor = null; ui.tagError = ""; render(); }
async function addTag(raw) {
  const name = raw.trim();
  if (!name) { cancelAdd(); return; }
  if (tags.includes(name)) { ui.tagError = "이미 있는 태그예요"; render(); const i = $("tagInput"); if (i) { i.value = name; i.focus(); } return; }
  tags.push(name);
  const s = sentences.find((x) => x.id === ui.newFor);
  if (s) s.tag = name;
  ui.adding = false; ui.newFor = null; ui.tagError = "";
  await persist(); render();
}

/* ---------- 목록 ---------- */
function quoteEl(s) {
  const q = el("p", "quote");
  q.dataset.id = s.id;
  let pos = 0;
  (s.marks || []).forEach(([a, b], i) => {
    if (a > pos) q.append(s.text.slice(pos, a));
    const m = el("mark", "", s.text.slice(a, b));
    m.title = "눌러서 형광펜 지우기";
    m.onclick = async (e) => { e.stopPropagation(); s.marks.splice(i, 1); await persist(); render(); };
    q.append(m);
    pos = b;
  });
  if (pos < s.text.length) q.append(s.text.slice(pos));
  return q;
}

function card(s) {
  const c = el("article", "card");

  // 출처: 한 줄 링크 (제목 ↗ · 도메인), 전체 주소는 마우스를 올리면 보입니다
  const src = el(isWeb(s.url) ? "a" : "span", "src");
  if (isWeb(s.url)) { src.href = s.url; src.target = "_blank"; src.rel = "noopener noreferrer"; }
  src.title = s.url;
  src.append(el("span", "src-t", s.title + (isWeb(s.url) ? " ↗" : "")));
  if (host(s.url) && host(s.url) !== s.title) src.append(el("span", "src-d", host(s.url)));

  // 태그 상자: 하나만
  const sel = el("select", "tagsel" + (s.tag ? "" : " none"));
  sel.setAttribute("aria-label", "태그");
  const first = el("option", "", s.tag ? "태그 빼기" : "+ 태그"); first.value = ""; sel.append(first);
  const list = tags.includes(s.tag) || !s.tag ? tags : [...tags, s.tag];
  list.forEach((t) => { const o = el("option", "", "#" + t); o.value = t; sel.append(o); });
  const nw = el("option", "", "새 태그 만들기…"); nw.value = "__new"; sel.append(nw);
  sel.value = s.tag || "";
  sel.onchange = async () => {
    if (sel.value === "__new") { sel.value = s.tag || ""; startAdd(s.id); return; }
    s.tag = sel.value;
    await persist(); render();
  };

  const copy = el("button", "copy", "복사"); copy.type = "button";
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(`“${s.text}” — ${s.title} (${s.url})`);
      copy.textContent = "복사됨 ✓"; copy.classList.add("done");
    } catch {
      copy.textContent = "복사 실패";
    }
    setTimeout(() => { copy.textContent = "복사"; copy.classList.remove("done"); }, 1200);
  };
  const del = el("button", "del", "삭제"); del.type = "button";
  del.onclick = async () => { sentences = sentences.filter((x) => x.id !== s.id); await persist(); render(); };

  const left = el("div", "meta-l"); left.append(sel, el("span", "date", fmt(s.savedAt)));
  const acts = el("div", "acts"); acts.append(copy, del);
  const meta = el("div", "meta"); meta.append(left, acts);

  c.append(quoteEl(s), src, meta);
  return c;
}

function emptyBox(title, desc, btnLabel, onBtn) {
  const e = el("div", "empty");
  e.append(el("h2", "", title), el("p", "", desc));
  if (btnLabel) { const b = el("button", "btn soft", btnLabel); b.type = "button"; b.onclick = onBtn; e.append(b); }
  return e;
}

function renderList() {
  const list = $("list");
  list.replaceChildren();

  if (!sentences.length) {
    const e = el("div", "empty");
    const ol = el("ol");
    ["웹페이지에서 문장을 드래그해 선택", "마우스 오른쪽 버튼 클릭", "‘문장 서랍에 저장’ 누르기"].forEach((t, i) => {
      const li = el("li"); li.append(el("b", "", String(i + 1)), t); ol.append(li);
    });
    e.append(el("h2", "", "아직 모은 문장이 없어요"), el("p", "", "이렇게 저장해 보세요."), ol);
    list.append(e);
    return;
  }

  const inTag = ui.filter ? sentences.filter((s) => s.tag === ui.filter) : sentences;
  if (!inTag.length) {
    list.append(emptyBox(`‘${ui.filter}’에 아직 문장이 없어요`, `카드의 태그 상자에서 ‘${ui.filter}’를 고르면 여기에 모여요.`, "전체 보기", () => { ui.filter = null; render(); }));
    return;
  }

  const k = ui.query.trim().toLowerCase();
  const shown = k ? inTag.filter((s) => `${s.text} ${s.title} ${s.url}`.toLowerCase().includes(k)) : inTag;
  if (!shown.length) {
    list.append(emptyBox(`‘${ui.query.trim()}’에 맞는 문장이 없어요`, "문장 내용이나 출처 제목, 주소로 찾을 수 있어요.", "검색어 지우기", () => { ui.query = ""; $("search").value = ""; render(); $("search").focus(); }));
    return;
  }
  shown.forEach((s) => list.append(card(s)));
}

function render() {
  renderHeader();
  renderList();
  hideHl();
}

/* ---------- 형광펜 ---------- */
let pendingHl = null;
function hideHl() { $("hlBtn").hidden = true; pendingHl = null; }
function offsetIn(root, node, off) {
  const r = document.createRange();
  r.selectNodeContents(root);
  r.setEnd(node, off);
  return r.toString().length;
}
function updateHl() {
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return hideHl();
  const r = sel.getRangeAt(0);
  const near = (n) => (n.nodeType === 1 ? n : n.parentElement);
  const q = near(r.startContainer)?.closest(".quote");
  if (!q || q !== near(r.endContainer)?.closest(".quote")) return hideHl();
  const s = sentences.find((x) => x.id === q.dataset.id);
  if (!s) return hideHl();
  let a = offsetIn(q, r.startContainer, r.startOffset);
  let b = offsetIn(q, r.endContainer, r.endOffset);
  while (a < b && /\s/.test(s.text[a])) a++;
  while (b > a && /\s/.test(s.text[b - 1])) b--;
  if (b <= a) return hideHl();
  pendingHl = { s, a, b };
  const rect = r.getBoundingClientRect();
  const btn = $("hlBtn");
  btn.style.left = Math.min(Math.max(rect.left + rect.width / 2, 50), 330) + "px";
  btn.style.top = Math.max(4, rect.top - 36) + "px";
  btn.hidden = false;
}
document.addEventListener("selectionchange", () => requestAnimationFrame(updateHl));
$("hlBtn").addEventListener("mousedown", (e) => e.preventDefault());
$("hlBtn").addEventListener("click", async () => {
  if (!pendingHl) return;
  const { s, a, b } = pendingHl;
  const all = [...(s.marks || []), [a, b]].sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const m of all) {
    const last = merged[merged.length - 1];
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push([m[0], m[1]]);
  }
  s.marks = merged;
  getSelection().removeAllRanges();
  await persist();
  render();
});
$("list").addEventListener("scroll", hideHl);

/* ---------- 이벤트 ---------- */
$("version").textContent = "v" + chrome.runtime.getManifest().version;
$("search").addEventListener("input", (e) => { ui.query = e.target.value; renderList(); });
$("clearAll").addEventListener("click", () => { ui.confirmAll = true; ui.confirmTag = null; render(); });

// 우클릭으로 저장하면 열린 팝업도 바로 갱신
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.sentences || changes.tags) load();
  // 팝업이 열려 있는 동안 저장된 문장은 이미 본 것으로 칩니다
  if (changes.unseen && changes.unseen.newValue) markSeen();
});

// 팝업을 열면 새 문장을 확인한 것으로 보고 아이콘 숫자를 지웁니다
function markSeen() {
  chrome.storage.local.set({ unseen: 0 });
  chrome.action.setBadgeText({ text: "" });
}
markSeen();

// 하단 email: 주소는 누를 때만 보입니다
$("emailAddr").textContent = CONTACT_EMAIL;
$("emailLink").href = "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent("[문장 서랍] 문의");
$("emailBtn").addEventListener("click", () => {
  const open = $("contact").hidden;
  $("contact").hidden = !open;
  $("emailBtn").setAttribute("aria-expanded", String(open));
});
$("emailCopy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(CONTACT_EMAIL); $("emailCopy").textContent = "복사됨 ✓"; }
  catch { $("emailCopy").textContent = "복사 실패"; }
  setTimeout(() => { $("emailCopy").textContent = "복사"; }, 1200);
});

load();
