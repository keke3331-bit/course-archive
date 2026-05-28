/**
 * トップページ：FEATURED（最新講座）と ARCHIVES（その他）の2セクション構成。
 * 検索/タグフィルタ使用中はFEATUREDを隠して該当だけグリッド表示。
 */

(function () {
  const featuredSection = document.getElementById("featured-section");
  const featuredSlot = document.getElementById("featured-slot");
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

  // ===== ヘルパ =====
  function thumbUrl(course, hires = false) {
    if (course.thumbnail) return course.thumbnail;
    if (course.youtubeId) {
      // hiresは存在しない動画もあるためフォールバック用にonerrorで小さい方へ
      return hires
        ? `https://img.youtube.com/vi/${course.youtubeId}/maxresdefault.jpg`
        : `https://img.youtube.com/vi/${course.youtubeId}/hqdefault.jpg`;
    }
    return null;
  }
  function fallbackThumbAttr(course) {
    if (!course.youtubeId) return "";
    return ` onerror="this.onerror=null;this.src='https://img.youtube.com/vi/${course.youtubeId}/hqdefault.jpg'"`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function lecturerChipsHtml(course, size = "sm") {
    const lecturers = Array.isArray(course.lecturers) ? course.lecturers : [];
    if (!lecturers.length) return "";
    const cls = size === "lg" ? "lecturer-chip" : "lecturer-egg";
    const avatarCls = size === "lg" ? "lecturer-avatar" : "lecturer-egg-avatar";
    const nameCls = size === "lg" ? "lecturer-name" : "lecturer-egg-name";
    return lecturers.slice(0, size === "lg" ? 5 : 3).map(name => `
      <span class="${cls}" title="${escapeHtml(name)}">
        <span class="${avatarCls}" aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span>
        <span class="${nameCls}">${escapeHtml(name)}</span>
      </span>
    `).join("") + (lecturers.length > 3 && size !== "lg" ? `<span class="lecturer-egg more">+${lecturers.length - 3}</span>` : "");
  }

  // ===== FEATURED カード =====
  function renderFeatured(course) {
    if (!course) {
      featuredSection.hidden = true;
      return;
    }
    featuredSection.hidden = false;

    const thumb = thumbUrl(course, true);
    const thumbHtml = thumb
      ? `<img src="${thumb}" alt="" loading="eager"${fallbackThumbAttr(course)}>
         <span class="play-icon-lg" aria-hidden="true">▶</span>`
      : `<span class="thumb-placeholder">準備中</span>`;

    const tagsHtml = (course.tags || []).map(t =>
      `<span class="tag">${escapeHtml(t)}</span>`
    ).join("");

    const timePart = (course.startTime && course.endTime)
      ? ` ${escapeHtml(course.startTime)}〜${escapeHtml(course.endTime)}`
      : "";

    const lecturersHtml = lecturerChipsHtml(course, "lg");
    const descShort = course.description
      ? escapeHtml(course.description.split("\n")[0]).slice(0, 120) + (course.description.length > 120 ? "…" : "")
      : "";

    featuredSlot.innerHTML = `
      <a class="featured-card" href="course.html?id=${course.id}" aria-label="${escapeHtml(course.title)}を視聴する">
        <div class="featured-thumb ${thumb ? "" : "no-video"}">${thumbHtml}</div>
        <div class="featured-body">
          <div class="featured-meta">
            <span>📅 ${escapeHtml(formatDate(course.date))}${timePart}</span>
            ${course.duration ? `<span>⏱ ${escapeHtml(course.duration)}</span>` : ""}
          </div>
          <h3 class="featured-title">${escapeHtml(course.title)}</h3>
          ${descShort ? `<p class="featured-desc">${descShort}</p>` : ""}
          ${lecturersHtml ? `<div class="featured-lecturers"><span class="featured-lecturers-label">担当講師</span><div class="lecturer-chips">${lecturersHtml}</div></div>` : ""}
          <div class="featured-footer">
            <div class="featured-tags">${tagsHtml}</div>
            <span class="featured-cta">視聴する <span aria-hidden="true">→</span></span>
          </div>
        </div>
      </a>
    `;
  }

  // ===== ARCHIVE カード =====
  function renderCourseCard(course) {
    const thumb = thumbUrl(course);
    const thumbHtml = thumb
      ? `<img src="${thumb}" alt="" loading="lazy">
         <span class="play-icon" aria-hidden="true">▶</span>`
      : `<span class="thumb-placeholder">準備中</span>`;
    const thumbClass = thumb ? "course-thumb" : "course-thumb no-video";

    const tagsHtml = (course.tags || []).map(t =>
      `<span class="tag">${escapeHtml(t)}</span>`
    ).join("");

    const lecturersHtml = lecturerChipsHtml(course, "sm");

    const timePart = (course.startTime && course.endTime)
      ? ` ${escapeHtml(course.startTime)}〜${escapeHtml(course.endTime)}`
      : "";

    return `
      <a class="course-card" href="course.html?id=${course.id}" aria-label="${escapeHtml(course.title)}を見る">
        <div class="${thumbClass}">${thumbHtml}</div>
        <div class="course-body">
          <h3 class="course-title">${escapeHtml(course.title)}</h3>
          <div class="course-meta">${formatDate(course.date)}${timePart}${course.duration ? " · " + escapeHtml(course.duration) : ""}</div>
          ${lecturersHtml ? `<div class="card-lecturers">${lecturersHtml}</div>` : ""}
          <div class="course-tags">${tagsHtml}</div>
        </div>
      </a>
    `;
  }

  // ===== フィルタ適用 =====
  function applyFilters() {
    const kw = state.keyword.trim().toLowerCase();
    const tag = state.activeTag;
    const isFiltering = Boolean(kw || tag);

    const sorted = COURSES.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const filtered = sorted.filter(c => {
      if (tag && !(c.tags || []).includes(tag)) return false;
      if (kw) {
        const haystack = [
          c.title,
          c.description || "",
          (c.tags || []).join(" "),
          (c.lecturers || []).join(" ")
        ].join(" ").toLowerCase();
        if (!haystack.includes(kw)) return false;
      }
      return true;
    });

    // フィルタなし: FEATURED + 残り
    // フィルタあり: グリッドのみ
    if (isFiltering) {
      featuredSection.hidden = true;
      grid.innerHTML = filtered.map(renderCourseCard).join("");
      resultCount.textContent = `${filtered.length}件の講座`;
    } else {
      const featured = sorted[0];
      const rest = sorted.slice(1);
      renderFeatured(featured);
      grid.innerHTML = rest.map(renderCourseCard).join("");
      resultCount.textContent = rest.length > 0
        ? `他に${rest.length}件の講座`
        : "";
    }

    emptyState.hidden = filtered.length !== 0 || !isFiltering;
    grid.hidden = isFiltering && filtered.length === 0;
  }

  // ===== タグフィルタUI =====
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

  renderTagFilter();
  applyFilters();
})();
