/**
 * トップページ：講座一覧のレンダリング + 検索 + タグフィルタ
 */

(function () {
  const grid = document.getElementById("courses-grid");
  const searchInput = document.getElementById("search-input");
  const tagFilter = document.getElementById("tag-filter");
  const resultCount = document.getElementById("result-count");
  const emptyState = document.getElementById("empty-state");
  const footerYear = document.getElementById("footer-year");

  if (footerYear) footerYear.textContent = new Date().getFullYear();

  const state = {
    keyword: "",
    activeTag: null
  };

  function thumbUrl(course) {
    if (course.thumbnail) return course.thumbnail;
    if (course.youtubeId) {
      return `https://img.youtube.com/vi/${course.youtubeId}/hqdefault.jpg`;
    }
    return null;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function renderCourseCard(course) {
    const thumb = thumbUrl(course);
    const thumbHtml = thumb
      ? `<img src="${thumb}" alt="" loading="lazy">
         <span class="play-icon" aria-hidden="true">▶</span>`
      : `<span>準備中</span>`;
    const thumbClass = thumb ? "course-thumb" : "course-thumb no-video";

    const tagsHtml = (course.tags || []).map(t =>
      `<span class="tag">${escapeHtml(t)}</span>`
    ).join("");

    const lecturers = Array.isArray(course.lecturers) ? course.lecturers : [];
    const lecturersHtml = lecturers.length > 0
      ? `<div class="card-lecturers" aria-label="担当講師">
           ${lecturers.slice(0, 3).map(name => `
             <span class="lecturer-egg" title="${escapeHtml(name)}">
               <span class="lecturer-egg-avatar" aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span>
               <span class="lecturer-egg-name">${escapeHtml(name)}</span>
             </span>
           `).join("")}
           ${lecturers.length > 3 ? `<span class="lecturer-egg more">+${lecturers.length - 3}</span>` : ""}
         </div>`
      : "";

    const timePart = (course.startTime && course.endTime)
      ? ` ${escapeHtml(course.startTime)}〜${escapeHtml(course.endTime)}`
      : "";

    return `
      <a class="course-card" href="course.html?id=${course.id}" aria-label="${escapeHtml(course.title)}を見る">
        <div class="${thumbClass}">${thumbHtml}</div>
        <div class="course-body">
          <h3 class="course-title">${escapeHtml(course.title)}</h3>
          <div class="course-meta">${formatDate(course.date)}${timePart}${course.duration ? " · " + escapeHtml(course.duration) : ""}</div>
          ${lecturersHtml}
          <div class="course-tags">${tagsHtml}</div>
        </div>
      </a>
    `;
  }

  function applyFilters() {
    const kw = state.keyword.trim().toLowerCase();
    const tag = state.activeTag;

    const filtered = COURSES.filter(c => {
      if (tag && !(c.tags || []).includes(tag)) return false;
      if (kw) {
        const haystack = [
          c.title,
          c.description || "",
          (c.tags || []).join(" ")
        ].join(" ").toLowerCase();
        if (!haystack.includes(kw)) return false;
      }
      return true;
    });

    grid.innerHTML = filtered.map(renderCourseCard).join("");
    resultCount.textContent = `${filtered.length}件の講座`;
    emptyState.hidden = filtered.length !== 0;
    grid.hidden = filtered.length === 0;
  }

  function renderTagFilter() {
    const allTags = Array.from(new Set(COURSES.flatMap(c => c.tags || []))).sort();
    if (allTags.length === 0) {
      tagFilter.hidden = true;
      return;
    }
    const buttons = [
      `<button type="button" class="tag-btn active" data-tag="">すべて</button>`,
      ...allTags.map(t => `<button type="button" class="tag-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    ];
    tagFilter.innerHTML = buttons.join("");
    tagFilter.addEventListener("click", e => {
      const btn = e.target.closest(".tag-btn");
      if (!btn) return;
      const tag = btn.dataset.tag || null;
      state.activeTag = tag;
      tagFilter.querySelectorAll(".tag-btn").forEach(b => {
        b.classList.toggle("active", (b.dataset.tag || null) === tag);
      });
      applyFilters();
    });
  }

  searchInput.addEventListener("input", e => {
    state.keyword = e.target.value;
    applyFilters();
  });

  // 日付降順で表示
  COURSES.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  renderTagFilter();
  applyFilters();
})();
