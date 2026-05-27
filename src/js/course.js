/**
 * 講座詳細ページ：?id=<N> から該当講座をレンダリング
 */

(function () {
  const article = document.getElementById("course-article");
  const notFound = document.getElementById("not-found");
  const footerYear = document.getElementById("footer-year");

  if (footerYear) footerYear.textContent = new Date().getFullYear();

  const params = new URLSearchParams(location.search);
  const id = parseInt(params.get("id"), 10);

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const course = COURSES.find(c => c.id === id);

  if (!course) {
    article.hidden = true;
    notFound.hidden = false;
    return;
  }

  // <title> 更新
  document.title = `${course.title} | 講座アーカイブ`;
  document.querySelector('meta[name="description"]')
    ?.setAttribute("content", (course.description || "").slice(0, 120));

  const tagsHtml = (course.tags || []).map(t =>
    `<span class="tag">${escapeHtml(t)}</span>`
  ).join("");

  const timeRange = (course.startTime && course.endTime)
    ? ` ${escapeHtml(course.startTime)}〜${escapeHtml(course.endTime)}`
    : (course.startTime ? ` ${escapeHtml(course.startTime)}〜` : "");

  const lecturers = Array.isArray(course.lecturers) ? course.lecturers : [];
  const lecturersHtml = lecturers.length > 0
    ? `<div class="lecturers-block">
         <span class="lecturers-label">担当講師</span>
         <div class="lecturer-chips">
           ${lecturers.map(name => `
             <span class="lecturer-chip">
               <span class="lecturer-avatar" aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span>
               <span class="lecturer-name">${escapeHtml(name)}</span>
             </span>
           `).join("")}
         </div>
       </div>`
    : "";

  const videoHtml = course.youtubeId
    ? `<div class="video-wrap">
         <iframe
           src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(course.youtubeId)}?rel=0"
           title="${escapeHtml(course.title)}"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
           allowfullscreen
           referrerpolicy="strict-origin-when-cross-origin"
           loading="lazy"></iframe>
       </div>`
    : `<div class="video-wrap"><div class="video-placeholder">動画は準備中です</div></div>`;

  const materialsHtml = (course.materials && course.materials.length > 0)
    ? `<h2>📥 手元資料</h2>
       <div class="materials-list">
         ${course.materials.map(m => {
           const meta = [m.size, m.pages ? `${m.pages}ページ` : null].filter(Boolean).join(" · ");
           return `
             <a class="material-card" href="assets/materials/${encodeURIComponent(m.file)}" download>
               <span class="material-icon" aria-hidden="true">📄</span>
               <span class="material-info">
                 <div class="material-title">${escapeHtml(m.title)}</div>
                 ${meta ? `<div class="material-detail">${escapeHtml(meta)}</div>` : ""}
               </span>
               <span class="material-action">ダウンロード</span>
             </a>
           `;
         }).join("")}
       </div>`
    : "";

  article.innerHTML = `
    <h1>${escapeHtml(course.title)}</h1>
    <div class="article-meta">
      <span>📅 ${formatDate(course.date)}${timeRange}</span>
      ${course.duration ? `<span>⏱ ${escapeHtml(course.duration)}</span>` : ""}
      <span class="tags-inline">${tagsHtml}</span>
    </div>
    ${lecturersHtml}
    ${videoHtml}
    <h2>📝 講座概要</h2>
    <div class="course-description">${escapeHtml(course.description || "")}</div>
    ${materialsHtml}
  `;
})();
