// 내 문장 모음 — 백그라운드 (우클릭 메뉴, 저장, 아이콘 숫자)
const MENU_ID = "save-sentence";

function createMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "내 문장 모음에 저장: \"%s\"",
      contexts: ["selection"] // 글자를 선택했을 때만 메뉴가 보입니다
    });
  });
}

// 아이콘 숫자 = 팝업에서 아직 확인하지 않은 새 문장 수. 팝업을 열면 0이 됩니다.
async function refreshBadge() {
  const { unseen = 0 } = await chrome.storage.local.get("unseen");
  await chrome.action.setBadgeBackgroundColor({ color: "#C93434" });
  await chrome.action.setBadgeText({ text: unseen ? String(unseen) : "" });
}

// 저장하지 않은 경우(중복)를 아이콘에 잠깐 표시합니다. 권한을 늘리지 않으려고 알림 대신 배지를 씁니다.
async function flashBadge(text) {
  await chrome.action.setBadgeBackgroundColor({ color: "#B7791F" });
  await chrome.action.setBadgeText({ text });
  setTimeout(refreshBadge, 1500);
}

chrome.runtime.onInstalled.addListener(() => { createMenu(); refreshBadge(); });
chrome.runtime.onStartup.addListener(refreshBadge);

// 새 문장이 생기거나 팝업에서 확인하면 숫자를 다시 그립니다
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.unseen) refreshBadge();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const text = (info.selectionText || "").replace(/\s+/g, " ").trim();
  if (!text) return;

  const url = info.pageUrl || (tab && tab.url) || "";
  const title = ((tab && tab.title) || "").trim() || url || "제목 없음";

  const { sentences = [], unseen = 0 } = await chrome.storage.local.get(["sentences", "unseen"]);

  // 같은 페이지의 같은 문장은 다시 저장하지 않습니다
  if (sentences.some((s) => s.text === text && s.url === url)) {
    flashBadge("중복");
    return;
  }

  sentences.unshift({
    id: crypto.randomUUID(),
    text,
    title,
    url,
    savedAt: new Date().toISOString(),
    tag: "",     // 태그는 하나만, 없으면 빈 문자열
    marks: []    // 형광펜 위치 [시작, 끝]
  });
  await chrome.storage.local.set({ sentences, unseen: unseen + 1 }); // 숫자는 onChanged에서 갱신
});
