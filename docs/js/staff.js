/**
 * スタッフ用アーカイブ：パスワード認証 + 講座/会議タブ切替
 *
 * 認証はadmin画面と同じパスワード（Kamagaya1123）を使用。
 * クライアント側ハッシュ比較（カジュアル防御）。
 */

(function () {
  "use strict";

  const PASSWORD_HASH = "9cf0f6e5a5783fa90a378450ca92eda97a269e35265124aa43fd08b5bdca671f"; // SHA-256("Kamagaya1123")

  const $ = id => document.getElementById(id);
  const loginScreen = $("login-screen");
  const loginForm = $("login-form");
  const passwordInput = $("password-input");
  const loginError = $("login-error");
  const staffMain = $("staff-main");
  const logoutBtn = $("logout-btn");
  const itemsGrid = $("items-grid");
  const searchInput = $("search-input");
  const tagFilter = $("tag-filter");
  const resultCount = $("result-count");
  const emptyState = $("empty-state");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const countCourses = $("count-courses");
  const countMeetings = $("count-meetings");
  const footerYear = $("footer-year");

  if (footerYear) footerYear.textContent = new Date().getFullYear();

  // 単一ステート
  const state = {
    tab: "courses",       // "courses" | "meetings"
    keyword: "",
    activeTag: null
  };

  const courses = (typeof COURSES !== "undefined" && Array.isArray(COURSES)) ? COURSES : [];
  const meetings = (typeof MEETINGS !== "undefined" && Array.isArray(MEETINGS)) ? MEETINGS : [];

  countCourses.textContent = courses.length;
  countMeetings.textContent = meetings.length;

  // ===== ユーティリティ =====
  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function thumbUrl(item) {
    if (item.thumbnail) return item.thumbnail;
    if (item.youtubeId) return `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`;
    return null;
  }

  // ===== 認証 =====
  function showLogin() {
    loginScreen.hidden = false;
    staffMain.hidden = true;
    logoutBtn.hidden = true;
    setTimeout(() => passwordInput.focus(), 50);
  }
  function showMain() {
    loginScreen.hidden = true;
    staffMain.hidden = false;
    logoutBtn.hidden = false;
    render();
    renderTagFilter();
  }
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    loginError.hidden = true;
    const pwd = passwordInput.value;
    const hash = await sha256(pwd);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem("staff_authed", "1");
      passwordInput.value = "";
      showMain();
    } else {
      loginError.textContent = "パスワードが違います";
      loginError.hidden = false;
      passwordInput.select();
    }
  });
  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("staff_authed");
    showLogin();
  });

  // ===== タブ切替 =====
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab === state.tab) return;
      state.tab = tab;
      state.activeTag = null;
      state.keyword = "";
      searchInput.value = "";
      tabBtns.forEach(b => {
        const active = b.dataset.tab === tab;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      renderTagFilter();
      render();
    });
  });

  // ===== レンダリング =====
  function currentItems() {
    return state.tab === "courses" ? courses : meetings;
  }
  function currentDetailHref(item) {
    return state.tab === "courses"
      ? `course.html?id=${item.id}`
      : `staff-meeting.html?id=${item.id}`;
  }
  function personLabel() { return state.tab === "courses" ? "講師" : "出席者"; }
  function personField() { return state.tab === "courses" ? "lecturers" : "attendees"; }

  function renderCard(item) {
    const thumb = thumbUrl(item);
    const thumbHtml = thumb
      ? `<img src="${thumb}" alt="" loading="lazy"><span class="play-icon" aria-hidden="true">▶</span>`
      : `<span class="thumb-placeholder">準備中</span>`;
    const thumbClass = thumb ? "course-thumb" : "course-thumb no-video";

    const tagsHtml = (item.tags || []).map(t =>
      `<span class="tag">${escapeHtml(t)}</span>`
    ).join("");

    const people = Array.isArray(item[personField()]) ? item[personField()] : [];
    const peopleHtml = people.length > 0
      ? `<div class="card-lecturers">
           ${people.slice(0, 3).map(name => `
             <span class="lecturer-egg" title="${escapeHtml(name)}">
               <span class="lecturer-egg-avatar" aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span>
               <span class="lecturer-egg-name">${escapeHtml(name)}</span>
             </span>
           `).join("")}
           ${people.length > 3 ? `<span class="lecturer-egg more">+${people.length - 3}</span>` : ""}
         </div>`
      : "";

    const timePart = (item.startTime && item.endTime)
      ? ` ${escapeHtml(item.startTime)}〜${escapeHtml(item.endTime)}`
      : "";

    return `
      <a class="course-card" href="${currentDetailHref(item)}" aria-label="${escapeHtml(item.title)}を見る">
        <div class="${thumbClass}">${thumbHtml}</div>
        <div class="course-body">
          <h3 class="course-title">${escapeHtml(item.title)}</h3>
          <div class="course-meta">${formatDate(item.date)}${timePart}${item.duration ? " · " + escapeHtml(item.duration) : ""}</div>
          ${peopleHtml}
          <div class="course-tags">${tagsHtml}</div>
        </div>
      </a>
    `;
  }

  function render() {
    const kw = state.keyword.trim().toLowerCase();
    const tag = state.activeTag;
    const items = currentItems().slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const filtered = items.filter(c => {
      if (tag && !(c.tags || []).includes(tag)) return false;
      if (kw) {
        const haystack = [
          c.title,
          c.description || "",
          (c.tags || []).join(" "),
          (c[personField()] || []).join(" ")
        ].join(" ").toLowerCase();
        if (!haystack.includes(kw)) return false;
      }
      return true;
    });

    itemsGrid.innerHTML = filtered.map(renderCard).join("");
    resultCount.textContent = `${filtered.length}件`;
    emptyState.hidden = filtered.length !== 0;
    emptyState.textContent = state.tab === "courses"
      ? "該当する講座が見つかりませんでした。"
      : "該当する会議が見つかりませんでした。";
    itemsGrid.hidden = filtered.length === 0;
  }

  function renderTagFilter() {
    const allTags = Array.from(new Set(currentItems().flatMap(c => c.tags || []))).sort();
    if (allTags.length === 0) {
      tagFilter.innerHTML = "";
      tagFilter.hidden = true;
      return;
    }
    tagFilter.hidden = false;
    const buttons = [
      `<button type="button" class="tag-btn active" data-tag="">すべて</button>`,
      ...allTags.map(t => `<button type="button" class="tag-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    ];
    tagFilter.innerHTML = buttons.join("");
  }

  tagFilter.addEventListener("click", e => {
    const btn = e.target.closest(".tag-btn");
    if (!btn) return;
    const tag = btn.dataset.tag || null;
    state.activeTag = tag;
    tagFilter.querySelectorAll(".tag-btn").forEach(b => {
      b.classList.toggle("active", (b.dataset.tag || null) === tag);
    });
    render();
  });

  searchInput.addEventListener("input", e => {
    state.keyword = e.target.value;
    render();
  });

  // ===== 起動 =====
  if (sessionStorage.getItem("staff_authed") === "1") {
    showMain();
  } else {
    showLogin();
  }
})();
