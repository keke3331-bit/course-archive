/**
 * 会議詳細ページ
 * staff.html でログイン済みのセッションでのみ閲覧可能。
 * 未認証なら staff.html にリダイレクト。
 */

(function () {
  "use strict";

  // 認証チェック（未ログインなら staff.html へ）
  if (sessionStorage.getItem("staff_authed") !== "1") {
    location.replace("staff.html");
    return;
  }

  const article = document.getElementById("meeting-article");
  const notFound = document.getElementById("not-found");
  const footerYear = document.getElementById("footer-year");
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  const params = new URLSearchParams(location.search);
  const id = parseInt(params.get("id"), 10);

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

  const meetings = (typeof MEETINGS !== "undefined" && Array.isArray(MEETINGS)) ? MEETINGS : [];
  const meeting = meetings.find(m => m.id === id);

  if (!meeting) {
    article.hidden = true;
    notFound.hidden = false;
    return;
  }

  document.title = `${meeting.title} | スタッフアーカイブ`;

  const tagsHtml = (meeting.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");

  const timeRange = (meeting.startTime && meeting.endTime)
    ? ` ${escapeHtml(meeting.startTime)}〜${escapeHtml(meeting.endTime)}`
    : (meeting.startTime ? ` ${escapeHtml(meeting.startTime)}〜` : "");

  const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : [];
  const attendeesHtml = attendees.length > 0
    ? `<div class="lecturers-block">
         <span class="lecturers-label">出席者</span>
         <div class="lecturer-chips">
           ${attendees.map(name => `
             <span class="lecturer-chip">
               <span class="lecturer-avatar" aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span>
               <span class="lecturer-name">${escapeHtml(name)}</span>
             </span>
           `).join("")}
         </div>
       </div>`
    : "";

  const videoHtml = meeting.youtubeId
    ? `<div class="video-wrap">
         <iframe
           src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(meeting.youtubeId)}?rel=0"
           title="${escapeHtml(meeting.title)}"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
           allowfullscreen
           referrerpolicy="strict-origin-when-cross-origin"
           loading="lazy"></iframe>
       </div>`
    : `<div class="video-wrap"><div class="video-placeholder">動画は準備中です</div></div>`;

  const materialsHtml = (meeting.materials && meeting.materials.length > 0)
    ? `<h2>📥 配布資料</h2>
       <div class="materials-list">
         ${meeting.materials.map(m => {
           const meta = [m.size, m.pages ? `${m.pages}ページ` : null].filter(Boolean).join(" · ");
           return `
             <a class="material-card" href="${escapeHtml(m.file)}" target="_blank" rel="noopener">
               <span class="material-icon" aria-hidden="true">📄</span>
               <span class="material-info">
                 <div class="material-title">${escapeHtml(m.title)}</div>
                 ${meta ? `<div class="material-detail">${escapeHtml(meta)}</div>` : ""}
               </span>
               <span class="material-action">開く</span>
             </a>
           `;
         }).join("")}
       </div>`
    : "";

  article.innerHTML = `
    <h1>${escapeHtml(meeting.title)}</h1>
    <div class="article-meta">
      <span>📅 ${formatDate(meeting.date)}${timeRange}</span>
      ${meeting.duration ? `<span>⏱ ${escapeHtml(meeting.duration)}</span>` : ""}
      <span class="tags-inline">${tagsHtml}</span>
    </div>
    ${attendeesHtml}
    ${videoHtml}
    <h2>📝 議事内容</h2>
    <div class="course-description">${escapeHtml(meeting.description || "")}</div>
    ${materialsHtml}
  `;
})();
