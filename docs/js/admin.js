/**
 * 管理画面ロジック
 *
 * 機能:
 *   - パスワード認証（SHA-256ハッシュ比較・クライアント側のみ）
 *   - 講座のCRUD（メモリ + sessionStorageでドラフト保持）
 *   - GitHub Trees APIで src/data/courses.js と docs/data/courses.js を
 *     1コミットで同時更新
 *
 * セキュリティ注意:
 *   - パスワードはJSハッシュ比較のため「カジュアルゲート」レベル。
 *     真の安全境界はGitHub PAT（localStorage保存）。
 *   - PATは外部送信されず、api.github.comにのみ送られる。
 */

(function () {
  "use strict";

  // ====== 定数 ======
  const PASSWORD_HASH = "9cf0f6e5a5783fa90a378450ca92eda97a269e35265124aa43fd08b5bdca671f"; // SHA-256("Kamagaya1123")
  const REPO_OWNER = "keke3331-bit";
  const REPO_NAME = "course-archive";
  const BRANCH = "main";
  const COURSES_PATH_SRC = "src/data/courses.js";
  const COURSES_PATH_DOCS = "docs/data/courses.js";

  // ====== ステート ======
  /** @type {Array<Course>} 編集中の講座配列（深いコピー） */
  let courses = JSON.parse(JSON.stringify(Array.isArray(window.COURSES) ? window.COURSES : []));
  /** @type {Array<Course>} 公開済みの講座配列（dirty判定用） */
  let pristineCourses = JSON.parse(JSON.stringify(courses));
  let editingIdx = -1; // -1 = 新規追加, 0以上 = 編集中のインデックス

  // ====== DOM要素キャッシュ ======
  const $ = id => document.getElementById(id);
  const loginScreen = $("login-screen");
  const loginForm = $("login-form");
  const passwordInput = $("password-input");
  const loginError = $("login-error");
  const adminPanel = $("admin-panel");
  const logoutBtn = $("logout-btn");

  const patInput = $("pat-input");
  const savePatBtn = $("save-pat-btn");
  const clearPatBtn = $("clear-pat-btn");
  const patStatus = $("pat-status");
  const settingsBlock = $("settings-block");

  const courseList = $("course-list");
  const courseCount = $("course-count");
  const emptyCourses = $("empty-courses");
  const newCourseBtn = $("new-course-btn");

  const editModal = $("edit-modal");
  const modalTitle = $("modal-title");
  const courseForm = $("course-form");
  const materialsEditor = $("materials-editor");
  const addMaterialBtn = $("add-material-btn");

  const publishBar = $("publish-bar");
  const dirtyCount = $("dirty-count");
  const discardBtn = $("discard-btn");
  const publishBtn = $("publish-btn");
  const publishStatus = $("publish-status");

  $("footer-year").textContent = new Date().getFullYear();

  // ====== ユーティリティ ======
  async function sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function nextId() {
    return courses.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;
  }

  function slugify(s) {
    return String(s)
      .toLowerCase()
      .replace(/[^a-z0-9぀-ヿ一-鿿-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "course";
  }

  function parseYouTube(input) {
    const s = (input || "").trim();
    if (!s) return "";
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : s;
  }

  function normalizeDriveUrl(input) {
    const s = (input || "").trim();
    if (!s) return "";
    const m = s.match(/\/file\/d\/([^/]+)/);
    if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
    return s;
  }

  function isDirty() {
    return JSON.stringify(courses) !== JSON.stringify(pristineCourses);
  }

  function countDirty() {
    const pristineById = new Map(pristineCourses.map(c => [c.id, c]));
    let n = 0;
    const seen = new Set();
    courses.forEach(c => {
      seen.add(c.id);
      const orig = pristineById.get(c.id);
      if (!orig || JSON.stringify(orig) !== JSON.stringify(c)) n++;
    });
    pristineCourses.forEach(c => { if (!seen.has(c.id)) n++; });
    return n;
  }

  function setStatus(msg, type) {
    publishStatus.textContent = msg;
    publishStatus.className = `status-msg ${type || "info"}`;
    publishStatus.hidden = false;
  }

  function clearStatus() {
    publishStatus.hidden = true;
    publishStatus.textContent = "";
  }

  // ====== 認証 ======
  async function tryLogin(pwd) {
    const hash = await sha256(pwd);
    return hash === PASSWORD_HASH;
  }

  function showLogin() {
    loginScreen.hidden = false;
    adminPanel.hidden = true;
    logoutBtn.hidden = true;
    setTimeout(() => passwordInput.focus(), 50);
  }

  function showAdmin() {
    loginScreen.hidden = true;
    adminPanel.hidden = false;
    logoutBtn.hidden = false;
    renderAll();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const pwd = passwordInput.value;
    const ok = await tryLogin(pwd);
    if (ok) {
      sessionStorage.setItem("admin_authed", "1");
      passwordInput.value = "";
      showAdmin();
    } else {
      loginError.textContent = "パスワードが違います";
      loginError.hidden = false;
      passwordInput.select();
    }
  });

  logoutBtn.addEventListener("click", () => {
    if (isDirty() && !confirm("未保存の変更があります。本当にログアウトしますか？")) return;
    sessionStorage.removeItem("admin_authed");
    courses = JSON.parse(JSON.stringify(pristineCourses));
    showLogin();
  });

  // ====== PAT管理 ======
  function loadPatStatus() {
    const pat = localStorage.getItem("github_pat");
    const pill = $("pat-state-pill");
    if (pat) {
      patStatus.textContent = `✅ トークン保存済み（末尾4文字: ...${pat.slice(-4)}）`;
      patStatus.className = "hint success-msg";
      if (pill) { pill.textContent = "設定済み"; pill.className = "pat-pill ok"; }
      settingsBlock.classList.remove("warn");
    } else {
      patStatus.textContent = "⚠️ トークン未設定です。下の入力欄に貼り付けて「保存」を押してください。";
      patStatus.className = "hint";
      if (pill) { pill.textContent = "未設定"; pill.className = "pat-pill warn"; }
      settingsBlock.classList.add("warn");
    }
  }

  savePatBtn.addEventListener("click", () => {
    const v = patInput.value.trim();
    if (!v) return;
    localStorage.setItem("github_pat", v);
    patInput.value = "";
    loadPatStatus();
  });

  clearPatBtn.addEventListener("click", () => {
    if (!confirm("保存済みのGitHubトークンを削除します。よろしいですか？")) return;
    localStorage.removeItem("github_pat");
    loadPatStatus();
  });

  // ====== 一覧レンダリング ======
  function renderAll() {
    courses.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    courseCount.textContent = courses.length;
    emptyCourses.hidden = courses.length > 0;
    courseList.hidden = courses.length === 0;

    const pristineById = new Map(pristineCourses.map(c => [c.id, c]));

    courseList.innerHTML = courses.map((c, idx) => {
      const orig = pristineById.get(c.id);
      const status = !orig ? "new" : (JSON.stringify(orig) !== JSON.stringify(c) ? "dirty" : "");
      const statusBadge = status === "new"
        ? '<span class="badge" style="background:#E6F4EC;color:#2E7D5B;">新規</span>'
        : status === "dirty"
        ? '<span class="badge" style="background:#FFF2D9;color:#8B6B1F;">変更</span>'
        : "";
      const videoBadge = c.youtubeId
        ? '<span class="badge">🎥 動画</span>'
        : '<span class="badge warn">動画未設定</span>';
      const matBadge = (c.materials || []).length > 0
        ? `<span class="badge">📄 資料 ${(c.materials || []).length}件</span>`
        : "";
      return `
        <div class="admin-course-card ${status}">
          <div class="course-info">
            <h3>${escapeHtml(c.title || "(無題)")}</h3>
            <div class="meta">
              ${escapeHtml(c.date || "日付未設定")} ·
              ${escapeHtml((c.tags || []).join(", ") || "タグなし")}
              <span class="badges">${statusBadge}${videoBadge}${matBadge}</span>
            </div>
          </div>
          <div class="course-actions">
            <button type="button" data-action="edit" data-idx="${idx}" class="btn-secondary">編集</button>
            <button type="button" data-action="delete" data-idx="${idx}" class="btn-danger">削除</button>
          </div>
        </div>
      `;
    }).join("");

    const n = countDirty();
    if (n > 0) {
      publishBar.hidden = false;
      dirtyCount.textContent = n;
    } else {
      publishBar.hidden = true;
    }
  }

  courseList.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const action = btn.dataset.action;
    if (action === "edit") openEditModal(idx);
    if (action === "delete") deleteCourse(idx);
  });

  // ====== 編集モーダル ======
  function openModal() {
    editModal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("form-title").focus(), 50);
  }

  function closeModal() {
    editModal.hidden = true;
    document.body.style.overflow = "";
  }

  editModal.addEventListener("click", e => {
    if (e.target.matches("[data-modal-close]")) closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !editModal.hidden) closeModal();
  });

  newCourseBtn.addEventListener("click", () => openEditModal(-1));

  function openEditModal(idx) {
    editingIdx = idx;
    const course = idx === -1
      ? { id: nextId(), slug: "", title: "", date: new Date().toISOString().slice(0, 10), duration: "", tags: [], thumbnail: "", youtubeId: "", description: "", materials: [] }
      : courses[idx];

    modalTitle.textContent = idx === -1 ? "講座を追加" : "講座を編集";
    $("form-id").value = course.id;
    $("form-title").value = course.title || "";
    $("form-date").value = course.date || "";
    $("form-duration").value = course.duration || "";
    $("form-tags").value = (course.tags || []).join(", ");
    $("form-youtube").value = course.youtubeId || "";
    $("form-description").value = course.description || "";
    renderMaterials(course.materials || []);
    openModal();
  }

  function renderMaterials(mats) {
    materialsEditor.innerHTML = mats.map((m, i) => materialRowHtml(m, i)).join("");
  }

  function materialRowHtml(m, i) {
    return `
      <div class="material-row" data-mat-idx="${i}">
        <div>
          <label>タイトル</label>
          <input type="text" class="mat-title" value="${escapeHtml(m.title || "")}" placeholder="例：スライド資料">
        </div>
        <div>
          <label>Google Driveリンク</label>
          <input type="text" class="mat-url" value="${escapeHtml(m.file || "")}" placeholder="https://drive.google.com/file/d/.../view">
        </div>
        <button type="button" class="btn-danger btn-sm material-remove">削除</button>
      </div>
    `;
  }

  addMaterialBtn.addEventListener("click", () => {
    const current = readMaterialsFromDom();
    current.push({ title: "", file: "" });
    renderMaterials(current);
  });

  materialsEditor.addEventListener("click", e => {
    if (e.target.classList.contains("material-remove")) {
      const row = e.target.closest(".material-row");
      const idx = parseInt(row.dataset.matIdx, 10);
      const current = readMaterialsFromDom();
      current.splice(idx, 1);
      renderMaterials(current);
    }
  });

  function readMaterialsFromDom() {
    return Array.from(materialsEditor.querySelectorAll(".material-row")).map(row => ({
      title: row.querySelector(".mat-title").value.trim(),
      file: normalizeDriveUrl(row.querySelector(".mat-url").value)
    }));
  }

  courseForm.addEventListener("submit", e => {
    e.preventDefault();
    const id = parseInt($("form-id").value, 10);
    const title = $("form-title").value.trim();
    const date = $("form-date").value;
    if (!title || !date) {
      alert("タイトルと開催日は必須です");
      return;
    }
    const data = {
      id,
      slug: slugify(title),
      title,
      date,
      duration: $("form-duration").value.trim(),
      tags: $("form-tags").value.split(",").map(s => s.trim()).filter(Boolean),
      thumbnail: "",
      youtubeId: parseYouTube($("form-youtube").value),
      description: $("form-description").value.trim(),
      materials: readMaterialsFromDom().filter(m => m.title || m.file)
    };

    if (editingIdx === -1) {
      courses.push(data);
    } else {
      courses[editingIdx] = data;
    }
    closeModal();
    renderAll();
  });

  function deleteCourse(idx) {
    const c = courses[idx];
    if (!confirm(`「${c.title}」を削除します。よろしいですか？`)) return;
    courses.splice(idx, 1);
    renderAll();
  }

  // ====== 公開（GitHub API） ======
  discardBtn.addEventListener("click", () => {
    if (!confirm("未保存の変更をすべて破棄します。よろしいですか？")) return;
    courses = JSON.parse(JSON.stringify(pristineCourses));
    renderAll();
    clearStatus();
  });

  publishBtn.addEventListener("click", async () => {
    const pat = localStorage.getItem("github_pat");
    if (!pat) {
      setStatus("先に「⚙️ GitHub接続設定」でPersonal Access Tokenを保存してください。", "error");
      settingsBlock.classList.add("warn");
      settingsBlock.scrollIntoView({ behavior: "smooth", block: "start" });
      $("pat-input").focus();
      return;
    }
    publishBtn.disabled = true;
    setStatus("⏳ 公開中...（GitHubに更新を送信）", "info");
    try {
      const sha = await publish(pat);
      pristineCourses = JSON.parse(JSON.stringify(courses));
      window.COURSES = JSON.parse(JSON.stringify(courses));
      renderAll();
      setStatus(
        `✅ 公開しました（コミット: ${sha.slice(0, 7)}）。GitHub Pagesは1〜2分で反映されます。`,
        "success"
      );
    } catch (err) {
      console.error(err);
      setStatus(`❌ エラー：${err.message}`, "error");
    } finally {
      publishBtn.disabled = false;
    }
  });

  function generateCoursesJsFile(arr) {
    return `/**
 * 講座データ — 管理画面から自動生成
 * 最終更新: ${new Date().toISOString()}
 *
 * 直接編集も可能ですが、管理画面 (admin.html) からの編集を推奨します。
 */

const COURSES = ${JSON.stringify(arr, null, 2)};

if (typeof module !== "undefined" && module.exports) {
  module.exports = COURSES;
}
`;
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function ghFetch(url, options, pat) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${pat}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options?.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  async function publish(pat) {
    const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
    const fileContent = generateCoursesJsFile(courses);

    // 1) 現在のmainブランチのコミットSHA
    const ref = await ghFetch(`${api}/git/ref/heads/${BRANCH}`, {}, pat);
    const baseCommitSha = ref.object.sha;

    // 2) コミットのツリーSHA
    const commit = await ghFetch(`${api}/git/commits/${baseCommitSha}`, {}, pat);
    const baseTreeSha = commit.tree.sha;

    // 3) blob作成
    const blob = await ghFetch(`${api}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: utf8ToBase64(fileContent),
        encoding: "base64"
      })
    }, pat);

    // 4) src/data/courses.js と docs/data/courses.js を同時に差し替えるツリー
    const tree = await ghFetch(`${api}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          { path: COURSES_PATH_SRC, mode: "100644", type: "blob", sha: blob.sha },
          { path: COURSES_PATH_DOCS, mode: "100644", type: "blob", sha: blob.sha }
        ]
      })
    }, pat);

    // 5) コミット作成
    const newCommit = await ghFetch(`${api}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: `講座データ更新 (${new Date().toISOString().slice(0, 16)})`,
        tree: tree.sha,
        parents: [baseCommitSha]
      })
    }, pat);

    // 6) ref更新（push相当）
    await ghFetch(`${api}/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha })
    }, pat);

    return newCommit.sha;
  }

  // ====== ページロード時の振り分け ======
  if (sessionStorage.getItem("admin_authed") === "1") {
    showAdmin();
  } else {
    showLogin();
  }
  loadPatStatus();
})();
