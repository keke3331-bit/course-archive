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
  const MEETINGS_PATH_SRC = "src/data/meetings.js";
  const MEETINGS_PATH_DOCS = "docs/data/meetings.js";
  const VAULT_PATH_SRC = "src/data/admin-vault.js";
  const VAULT_PATH_DOCS = "docs/data/admin-vault.js";
  const PBKDF2_ITERS = 100000;

  // ====== ステート ======
  // 注：courses.js / meetings.js は `const COURSES = [...]` 形式。top-level const は
  //     window.COURSES に登録されないため、bare reference か typeof で参照する。
  const initialCourses = (typeof COURSES !== "undefined" && Array.isArray(COURSES)) ? COURSES : [];
  const initialMeetings = (typeof MEETINGS !== "undefined" && Array.isArray(MEETINGS)) ? MEETINGS : [];
  /** @type {Array<Course>} 編集中の講座配列（深いコピー） */
  let courses = JSON.parse(JSON.stringify(initialCourses));
  /** @type {Array<Course>} 公開済みの講座配列（dirty判定用） */
  let pristineCourses = JSON.parse(JSON.stringify(initialCourses));
  /** @type {Array<Meeting>} 編集中の社内会議配列 */
  let meetings = JSON.parse(JSON.stringify(initialMeetings));
  /** @type {Array<Meeting>} 公開済みの社内会議配列 */
  let pristineMeetings = JSON.parse(JSON.stringify(initialMeetings));
  let editingIdx = -1; // -1 = 新規追加, 0以上 = 編集中のインデックス
  /** @type {"courses"|"meetings"} 現在表示中のタブ */
  let activeTab = "courses";

  // タブ別のラベル・キー定義
  const TAB_CONFIG = {
    courses: {
      listTitle: "講座一覧",
      newBtn: "+ 新規追加",
      emptyMsg: "講座がまだありません。「新規追加」から作成してください。",
      modalAdd: "講座を追加",
      modalEdit: "講座を編集",
      titleLabel: "講座タイトル",
      peopleLabel: "担当講師（複数登録可）",
      peopleKey: "lecturers",
      peoplePlaceholder: "名前を入力してEnter（または , ）で追加",
      descriptionLabel: "講座概要",
      descriptionPlaceholder: "講座の内容、ゴール、対象などを記述"
    },
    meetings: {
      listTitle: "社内会議一覧",
      newBtn: "+ 新規追加",
      emptyMsg: "社内会議がまだありません。「新規追加」から作成してください。",
      modalAdd: "社内会議を追加",
      modalEdit: "社内会議を編集",
      titleLabel: "会議タイトル",
      peopleLabel: "出席者（複数登録可）",
      peopleKey: "attendees",
      peoplePlaceholder: "出席者名を入力してEnter（または , ）で追加",
      descriptionLabel: "議事内容",
      descriptionPlaceholder: "議題、論点、決定事項などを記述"
    }
  };

  function currentList() { return activeTab === "courses" ? courses : meetings; }
  function currentPristine() { return activeTab === "courses" ? pristineCourses : pristineMeetings; }
  function setCurrentList(arr) {
    if (activeTab === "courses") courses = arr;
    else meetings = arr;
  }
  function currentConfig() { return TAB_CONFIG[activeTab]; }

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
  const syncToVaultBtn = $("sync-to-vault-btn");
  const showPatBtn = $("show-pat-btn");
  const patStatus = $("pat-status");
  const settingsBlock = $("settings-block");

  const courseList = $("course-list");
  const courseCount = $("course-count");
  const emptyCourses = $("empty-courses");
  const newCourseBtn = $("new-course-btn");
  const tabCoursesBtn = $("tab-courses");
  const tabMeetingsBtn = $("tab-meetings");
  const tabCountCourses = $("tab-count-courses");
  const tabCountMeetings = $("tab-count-meetings");
  const listTitle = $("list-title");
  const formTitleLabel = $("form-title-label");
  const peopleLabel = $("people-label");
  const formDescriptionLabel = $("form-description-label");

  const editModal = $("edit-modal");
  const modalTitle = $("modal-title");
  const courseForm = $("course-form");
  const materialsEditor = $("materials-editor");
  const addMaterialBtn = $("add-material-btn");
  const lecturersChips = $("lecturers-chips");
  const lecturerInput = $("lecturer-input");
  const youtubeInput = $("form-youtube");
  const durationInput = $("form-duration");
  const fetchDurationBtn = $("fetch-duration-btn");
  const durationStatus = $("duration-status");

  /** @type {string[]} 編集中の人物リスト（講師 or 出席者） */
  let people = [];

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
    return currentList().reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;
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

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return "";
    const totalMin = Math.round(seconds / 60);
    if (totalMin < 60) return `${totalMin}分`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h}時間` : `${h}時間${m}分`;
  }

  // YouTube IFrame APIの遅延読み込み（必要になったときだけ）
  let ytApiPromise = null;
  function loadYouTubeApi() {
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise(resolve => {
      if (window.YT && window.YT.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prev === "function") prev();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    });
    return ytApiPromise;
  }

  async function fetchYouTubeDuration(videoId) {
    if (!videoId) throw new Error("動画IDが空です");
    await loadYouTubeApi();
    return new Promise((resolve, reject) => {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(host);

      let done = false;
      let player = null;
      const cleanup = () => {
        try { if (player && player.destroy) player.destroy(); } catch (_) {}
        host.remove();
      };
      const timeout = setTimeout(() => {
        if (!done) { done = true; cleanup(); reject(new Error("読込タイムアウト（10秒）")); }
      }, 10000);

      player = new window.YT.Player(host, {
        videoId,
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: () => {
            try {
              const dur = player.getDuration();
              if (!done) {
                done = true;
                clearTimeout(timeout);
                cleanup();
                if (dur > 0) resolve(Math.round(dur));
                else reject(new Error("動画の長さを取得できませんでした"));
              }
            } catch (e) {
              if (!done) { done = true; clearTimeout(timeout); cleanup(); reject(e); }
            }
          },
          onError: (ev) => {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            cleanup();
            const msg = {
              2: "動画IDが無効です",
              5: "HTML5プレーヤーで再生できない動画です",
              100: "動画が見つかりません（削除済みかプライベート）",
              101: "埋め込みが許可されていません",
              150: "埋め込みが許可されていません"
            }[ev.data] || `読込エラー（code: ${ev.data}）`;
            reject(new Error(msg));
          }
        }
      });
    });
  }

  async function autofillDuration({ silent = false } = {}) {
    const id = parseYouTube(youtubeInput.value);
    if (!id) {
      if (!silent) setDurationStatus("YouTube URLまたはIDを入力してください", "error");
      return;
    }
    setDurationStatus("⏳ 取得中...", "loading");
    try {
      const seconds = await fetchYouTubeDuration(id);
      const formatted = formatDuration(seconds);
      durationInput.value = formatted;
      setDurationStatus(`✅ 自動取得：${seconds}秒 → ${formatted}`, "success");
    } catch (err) {
      console.warn("Duration fetch failed:", err);
      setDurationStatus(`⚠️ 自動取得失敗：${err.message}（手動入力してください）`, "error");
    }
  }

  function setDurationStatus(msg, level) {
    if (!durationStatus) return;
    durationStatus.textContent = msg || "";
    durationStatus.className = `duration-status${level ? " " + level : ""}`;
  }

  function isDirty() {
    return JSON.stringify(courses) !== JSON.stringify(pristineCourses)
        || JSON.stringify(meetings) !== JSON.stringify(pristineMeetings);
  }

  function coursesDirty() {
    return JSON.stringify(courses) !== JSON.stringify(pristineCourses);
  }
  function meetingsDirty() {
    return JSON.stringify(meetings) !== JSON.stringify(pristineMeetings);
  }

  function countDirtyIn(curr, pristine) {
    const pristineById = new Map(pristine.map(c => [c.id, c]));
    let n = 0;
    const seen = new Set();
    curr.forEach(c => {
      seen.add(c.id);
      const orig = pristineById.get(c.id);
      if (!orig || JSON.stringify(orig) !== JSON.stringify(c)) n++;
    });
    pristine.forEach(c => { if (!seen.has(c.id)) n++; });
    return n;
  }
  function countDirty() {
    return countDirtyIn(courses, pristineCourses) + countDirtyIn(meetings, pristineMeetings);
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

  // ====== 暗号化（PAT vault） ======
  function bufToB64(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToBuf(s) {
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }

  async function deriveKey(password, saltBuf) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBuf, iterations: PBKDF2_ITERS, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptPat(pat, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const plaintext = new TextEncoder().encode(
      JSON.stringify({ pat, savedAt: new Date().toISOString() })
    );
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return {
      version: 1,
      salt: bufToB64(salt),
      iv: bufToB64(iv),
      ciphertext: bufToB64(ct),
      updatedAt: new Date().toISOString()
    };
  }

  async function decryptPat(vault, password) {
    if (!vault || vault.version !== 1) throw new Error("vault形式が不正です");
    const salt = b64ToBuf(vault.salt);
    const iv = b64ToBuf(vault.iv);
    const ct = b64ToBuf(vault.ciphertext);
    const key = await deriveKey(password, salt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    const obj = JSON.parse(new TextDecoder().decode(pt));
    return obj.pat;
  }

  function getLoginPassword() {
    // ログイン時にsessionStorageに保存（vault暗号化のため・タブを閉じれば消える）
    return sessionStorage.getItem("admin_pwd_for_vault") || "";
  }

  async function syncFromVault(password) {
    // ADMIN_VAULT グローバルは admin-vault.js から
    if (typeof ADMIN_VAULT === "undefined" || !ADMIN_VAULT) return null;
    try {
      const pat = await decryptPat(ADMIN_VAULT, password);
      if (pat) {
        const existing = localStorage.getItem("github_pat");
        if (existing !== pat) {
          localStorage.setItem("github_pat", pat);
        }
        return pat;
      }
    } catch (e) {
      console.warn("Vault decryption failed:", e);
      return null;
    }
    return null;
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
      // vault暗号化用にパスワードをsessionStorageに退避（タブ閉じると消える）
      sessionStorage.setItem("admin_pwd_for_vault", pwd);
      passwordInput.value = "";
      // vaultからPATを自動復元
      const synced = await syncFromVault(pwd);
      showAdmin();
      if (synced) {
        setStatus("☁️ 他PCで設定済みのGitHub Tokenを取り込みました。", "success");
      }
    } else {
      loginError.textContent = "パスワードが違います";
      loginError.hidden = false;
      passwordInput.select();
    }
  });

  logoutBtn.addEventListener("click", () => {
    if (isDirty() && !confirm("未保存の変更があります。本当にログアウトしますか？")) return;
    sessionStorage.removeItem("admin_authed");
    sessionStorage.removeItem("admin_pwd_for_vault");
    courses = JSON.parse(JSON.stringify(pristineCourses));
    meetings = JSON.parse(JSON.stringify(pristineMeetings));
    showLogin();
  });

  // ====== PAT管理 ======
  function loadPatStatus() {
    const pat = localStorage.getItem("github_pat");
    const pill = $("pat-state-pill");
    const hasVault = (typeof ADMIN_VAULT !== "undefined" && ADMIN_VAULT);
    if (pat) {
      const vaultNote = hasVault ? "・☁️ 全PC同期済み" : "・このPCのみ（次回保存時にvault同期）";
      patStatus.textContent = `✅ トークン保存済み（末尾4文字: ...${pat.slice(-4)}${vaultNote}）`;
      patStatus.className = "hint success-msg";
      if (pill) { pill.textContent = "設定済み"; pill.className = "pat-pill ok"; }
      settingsBlock.classList.remove("warn");
    } else if (hasVault) {
      patStatus.textContent = "ℹ️ このPCには未設定ですが、vault（他PC）に登録あり。再ログインで自動取り込みされます。";
      patStatus.className = "hint";
      if (pill) { pill.textContent = "vault待機"; pill.className = "pat-pill warn"; }
      settingsBlock.classList.add("warn");
    } else {
      patStatus.textContent = "⚠️ トークン未設定です。下の入力欄に貼り付けて「保存」を押すと、自動で全PCに同期されます。";
      patStatus.className = "hint";
      if (pill) { pill.textContent = "未設定"; pill.className = "pat-pill warn"; }
      settingsBlock.classList.add("warn");
    }
  }

  savePatBtn.addEventListener("click", async () => {
    const v = patInput.value.trim();
    if (!v) {
      alert("Tokenを入力してください");
      return;
    }
    try {
      localStorage.setItem("github_pat", v);
      const stored = localStorage.getItem("github_pat");
      if (stored !== v) {
        alert("⚠️ Tokenの保存に失敗しました。ブラウザのプライベートモードや「全てのCookieをブロック」設定を無効にしてください。");
        return;
      }
      patInput.value = "";
      loadPatStatus();

      // vaultにも同期（他のPCに引き継ぐため）
      const pwd = getLoginPassword();
      if (pwd) {
        savePatBtn.disabled = true;
        setStatus("☁️ 他PCにも同期中...", "info");
        try {
          const vault = await encryptPat(v, pwd);
          await uploadVault(vault, v);
          setStatus("✅ Tokenを保存し、他PCにも同期しました。", "success");
        } catch (e) {
          console.error(e);
          setStatus("⚠️ ローカル保存はOKですが、他PC同期に失敗：" + e.message, "error");
        } finally {
          savePatBtn.disabled = false;
        }
      } else {
        setStatus("✅ このPCにTokenを保存しました。", "success");
      }
    } catch (e) {
      alert(`⚠️ Tokenの保存中にエラー：${e.message}\nブラウザのストレージ設定を確認してください。`);
    }
  });

  // 「現在のTokenをvaultに同期」ボタン
  syncToVaultBtn.addEventListener("click", async () => {
    const pat = localStorage.getItem("github_pat");
    if (!pat) {
      alert("このPCにTokenが保存されていません。上の入力欄からTokenを保存してください。");
      return;
    }
    const pwd = getLoginPassword();
    if (!pwd) {
      alert("vault同期にはログインセッションが必要です。一度ログアウトして再ログインしてください。");
      return;
    }
    syncToVaultBtn.disabled = true;
    setStatus("☁️ vaultに同期中...", "info");
    try {
      const vault = await encryptPat(pat, pwd);
      const sha = await uploadVault(vault, pat);
      setStatus(
        `✅ vaultに同期しました（コミット: ${sha.slice(0, 7)}）。次回から他PCで自動取り込みされます。`,
        "success"
      );
    } catch (e) {
      console.error(e);
      setStatus("⚠️ vault同期失敗：" + e.message, "error");
    } finally {
      syncToVaultBtn.disabled = false;
    }
  });

  // 「保存済みTokenを表示」ボタン
  showPatBtn.addEventListener("click", () => {
    const pat = localStorage.getItem("github_pat");
    if (!pat) {
      alert("このPCにTokenが保存されていません。");
      return;
    }
    const ok = confirm(
      "保存済みのGitHub Token値を表示します。\n" +
      "周囲に人がいない、画面共有していないことを確認してください。\n" +
      "OKを押すと表示します。"
    );
    if (!ok) return;
    // モーダル代わりに patStatus の下に表示
    let resultEl = document.getElementById("pat-show-result");
    if (!resultEl) {
      resultEl = document.createElement("div");
      resultEl.id = "pat-show-result";
      resultEl.className = "pat-show-result";
      patStatus.parentNode.insertBefore(resultEl, patStatus.nextSibling);
    }
    resultEl.innerHTML = `
      <strong>Token:</strong> <span id="pat-value-shown"></span>
      <button type="button" id="copy-pat-btn" class="btn-secondary btn-sm" style="margin-left:8px">📋 コピー</button>
      <button type="button" id="hide-pat-btn" class="btn-ghost btn-sm" style="margin-left:4px">隠す</button>
    `;
    document.getElementById("pat-value-shown").textContent = pat;
    document.getElementById("copy-pat-btn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pat);
        document.getElementById("copy-pat-btn").textContent = "✅ コピーしました";
        setTimeout(() => {
          const b = document.getElementById("copy-pat-btn");
          if (b) b.textContent = "📋 コピー";
        }, 2000);
      } catch (e) {
        alert("クリップボードへのコピーに失敗：" + e.message);
      }
    });
    document.getElementById("hide-pat-btn").addEventListener("click", () => {
      resultEl.remove();
    });
  });

  clearPatBtn.addEventListener("click", async () => {
    const choice = prompt(
      "Tokenの削除範囲を選択してください：\n" +
      "  1 = このPCだけ削除（他PCはそのまま）\n" +
      "  2 = 全PC（vault）から削除\n" +
      "キャンセルは空のままOK",
      "1"
    );
    if (!choice) return;
    if (choice === "1") {
      localStorage.removeItem("github_pat");
      loadPatStatus();
      setStatus("✅ このPCのTokenを削除しました。", "success");
    } else if (choice === "2") {
      const pwd = getLoginPassword();
      const currentPat = localStorage.getItem("github_pat");
      if (!pwd || !currentPat) {
        alert("vaultから削除するには、現在のセッションでログインし、Tokenが保存されている必要があります。");
        return;
      }
      clearPatBtn.disabled = true;
      setStatus("☁️ vaultから削除中...", "info");
      try {
        await uploadVault(null, currentPat);
        localStorage.removeItem("github_pat");
        loadPatStatus();
        setStatus("✅ 全PCのTokenを削除しました（vaultクリア完了）。", "success");
      } catch (e) {
        setStatus("⚠️ 削除失敗：" + e.message, "error");
      } finally {
        clearPatBtn.disabled = false;
      }
    } else {
      alert("「1」または「2」を入力してください");
    }
  });

  // ====== 一覧レンダリング ======
  function renderAll() {
    const list = currentList();
    const pristine = currentPristine();
    const cfg = currentConfig();

    list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // タブのカウント・アクティブ状態
    tabCountCourses.textContent = courses.length;
    tabCountMeetings.textContent = meetings.length;
    tabCoursesBtn.classList.toggle("is-active", activeTab === "courses");
    tabCoursesBtn.setAttribute("aria-selected", activeTab === "courses" ? "true" : "false");
    tabMeetingsBtn.classList.toggle("is-active", activeTab === "meetings");
    tabMeetingsBtn.setAttribute("aria-selected", activeTab === "meetings" ? "true" : "false");

    // ツールバーのタイトル・件数・ボタンラベル
    listTitle.innerHTML = `${cfg.listTitle} <span class="count-pill"><span id="course-count">0</span> 件</span>`;
    document.getElementById("course-count").textContent = list.length;
    newCourseBtn.textContent = cfg.newBtn;

    emptyCourses.textContent = cfg.emptyMsg;
    emptyCourses.hidden = list.length > 0;
    courseList.hidden = list.length === 0;

    const peopleKey = cfg.peopleKey;
    const pristineById = new Map(pristine.map(c => [c.id, c]));

    courseList.innerHTML = list.map((c, idx) => {
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
      const timePart = (c.startTime && c.endTime)
        ? ` ${escapeHtml(c.startTime)}〜${escapeHtml(c.endTime)}`
        : (c.startTime ? ` ${escapeHtml(c.startTime)}〜` : "");
      const peopleArr = Array.isArray(c[peopleKey]) ? c[peopleKey] : [];
      const peoplePart = peopleArr.length
        ? ` · 👤 ${peopleArr.map(escapeHtml).join(" / ")}`
        : "";
      return `
        <div class="admin-course-card ${status}">
          <div class="course-info">
            <h3>${escapeHtml(c.title || "(無題)")}</h3>
            <div class="meta">
              ${escapeHtml(c.date || "日付未設定")}${timePart}${peoplePart} ·
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

  // ====== タブ切替 ======
  function switchTab(tab) {
    if (tab === activeTab) return;
    if (!editModal.hidden) closeModal();
    activeTab = tab;
    renderAll();
  }
  tabCoursesBtn.addEventListener("click", () => switchTab("courses"));
  tabMeetingsBtn.addEventListener("click", () => switchTab("meetings"));

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
    const cfg = currentConfig();
    const list = currentList();
    const peopleKey = cfg.peopleKey;

    const item = idx === -1
      ? {
          id: nextId(),
          slug: "",
          title: "",
          date: new Date().toISOString().slice(0, 10),
          startTime: "",
          endTime: "",
          duration: "",
          [peopleKey]: [],
          tags: [],
          thumbnail: "",
          youtubeId: "",
          description: "",
          materials: []
        }
      : list[idx];

    // タブに応じてモーダルのラベル類を更新
    modalTitle.textContent = idx === -1 ? cfg.modalAdd : cfg.modalEdit;
    formTitleLabel.textContent = cfg.titleLabel;
    peopleLabel.textContent = cfg.peopleLabel;
    formDescriptionLabel.textContent = cfg.descriptionLabel;
    lecturerInput.placeholder = cfg.peoplePlaceholder;
    $("form-description").placeholder = cfg.descriptionPlaceholder;

    $("form-id").value = item.id;
    $("form-title").value = item.title || "";
    $("form-date").value = item.date || "";
    $("form-start").value = item.startTime || "";
    $("form-end").value = item.endTime || "";
    $("form-duration").value = item.duration || "";
    $("form-tags").value = (item.tags || []).join(", ");
    $("form-youtube").value = item.youtubeId || "";
    $("form-description").value = item.description || "";

    people = Array.isArray(item[peopleKey]) ? item[peopleKey].slice() : [];
    renderPeople();
    lecturerInput.value = "";
    setDurationStatus("");

    renderMaterials(item.materials || []);
    openModal();
  }

  // ===== 人物チップ入力（講師 or 出席者） =====
  function renderPeople() {
    lecturersChips.innerHTML = people.map((name, i) => `
      <span class="chip">
        <span>${escapeHtml(name)}</span>
        <button type="button" data-rm-person="${i}" aria-label="${escapeHtml(name)}を削除">×</button>
      </span>
    `).join("");
  }
  function addPersonFromInput() {
    const raw = lecturerInput.value.trim().replace(/,+$/, "").trim();
    if (!raw) return;
    raw.split(/[,、]/).map(s => s.trim()).filter(Boolean).forEach(name => {
      if (!people.includes(name)) people.push(name);
    });
    lecturerInput.value = "";
    renderPeople();
  }
  lecturerInput.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addPersonFromInput();
    } else if (e.key === "Backspace" && !lecturerInput.value && people.length > 0) {
      people.pop();
      renderPeople();
    }
  });
  lecturerInput.addEventListener("blur", () => {
    if (lecturerInput.value.trim()) addPersonFromInput();
  });
  lecturersChips.addEventListener("click", e => {
    const btn = e.target.closest("[data-rm-person]");
    if (!btn) return;
    people.splice(parseInt(btn.dataset.rmPerson, 10), 1);
    renderPeople();
  });
  $("lecturers-chip-input").addEventListener("click", e => {
    if (e.target === e.currentTarget || e.target === lecturersChips) lecturerInput.focus();
  });

  // ===== YouTube所要時間自動取得 =====
  let lastFetchedId = "";
  let fetchTimer = null;
  youtubeInput.addEventListener("input", () => {
    const id = parseYouTube(youtubeInput.value);
    if (!id || id === lastFetchedId) return;
    if (id.length !== 11) return; // 完成形になったときだけ
    clearTimeout(fetchTimer);
    fetchTimer = setTimeout(() => {
      lastFetchedId = id;
      autofillDuration({ silent: true });
    }, 400);
  });
  fetchDurationBtn.addEventListener("click", () => {
    lastFetchedId = parseYouTube(youtubeInput.value);
    autofillDuration();
  });

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
    // フォーカス未確定の名前があれば確定
    if (lecturerInput.value.trim()) addPersonFromInput();

    const cfg = currentConfig();
    const peopleKey = cfg.peopleKey;
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
      startTime: $("form-start").value || "",
      endTime: $("form-end").value || "",
      [peopleKey]: people.slice(),
      duration: $("form-duration").value.trim(),
      tags: $("form-tags").value.split(",").map(s => s.trim()).filter(Boolean),
      thumbnail: "",
      youtubeId: parseYouTube($("form-youtube").value),
      description: $("form-description").value.trim(),
      materials: readMaterialsFromDom().filter(m => m.title || m.file)
    };

    const list = currentList();
    if (editingIdx === -1) {
      list.push(data);
    } else {
      list[editingIdx] = data;
    }
    closeModal();
    renderAll();
  }, false);

  function deleteCourse(idx) {
    const list = currentList();
    const c = list[idx];
    if (!confirm(`「${c.title}」を削除します。よろしいですか？`)) return;
    list.splice(idx, 1);
    renderAll();
  }

  // ====== 公開（GitHub API） ======
  discardBtn.addEventListener("click", () => {
    if (!confirm("未保存の変更をすべて破棄します。よろしいですか？（講座・社内会議の両方）")) return;
    courses = JSON.parse(JSON.stringify(pristineCourses));
    meetings = JSON.parse(JSON.stringify(pristineMeetings));
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
      pristineMeetings = JSON.parse(JSON.stringify(meetings));
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

  function generateVaultFile(vault) {
    const value = vault ? JSON.stringify(vault, null, 2) : "null";
    return `/**
 * 管理画面用のPAT vault — 自動生成
 * 最終更新: ${new Date().toISOString()}
 *
 * 管理画面のパスワードで暗号化されたGitHub Personal Access Tokenが格納されます。
 * 他のPCでログインすると、このファイルから自動でTokenが復元されます。
 *
 * 暗号化方式：PBKDF2(SHA-256, ${PBKDF2_ITERS}回) → AES-GCM 256bit
 */

const ADMIN_VAULT = ${value};
`;
  }

  async function uploadVault(vault, pat) {
    const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
    const fileContent = generateVaultFile(vault);

    const ref = await ghFetch(`${api}/git/ref/heads/${BRANCH}`, {}, pat);
    const baseCommitSha = ref.object.sha;

    const commit = await ghFetch(`${api}/git/commits/${baseCommitSha}`, {}, pat);
    const baseTreeSha = commit.tree.sha;

    const blob = await ghFetch(`${api}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: utf8ToBase64(fileContent),
        encoding: "base64"
      })
    }, pat);

    const tree = await ghFetch(`${api}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          { path: VAULT_PATH_SRC, mode: "100644", type: "blob", sha: blob.sha },
          { path: VAULT_PATH_DOCS, mode: "100644", type: "blob", sha: blob.sha }
        ]
      })
    }, pat);

    const newCommit = await ghFetch(`${api}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: vault
          ? `admin-vault更新（PAT同期 ${new Date().toISOString().slice(0, 16)}）`
          : `admin-vaultクリア（${new Date().toISOString().slice(0, 16)}）`,
        tree: tree.sha,
        parents: [baseCommitSha]
      })
    }, pat);

    await ghFetch(`${api}/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha })
    }, pat);

    return newCommit.sha;
  }

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

  function generateMeetingsJsFile(arr) {
    return `/**
 * 社内会議の映像アーカイブ — 管理画面から自動生成
 * 最終更新: ${new Date().toISOString()}
 *
 * 直接編集も可能ですが、管理画面 (admin.html) の「社内会議」タブからの編集を推奨します。
 * 形式は courses.js とほぼ同じ。lecturers の代わりに attendees（出席者）を使用。
 */

const MEETINGS = ${JSON.stringify(arr, null, 2)};

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEETINGS;
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
    const includeCourses = coursesDirty();
    const includeMeetings = meetingsDirty();
    if (!includeCourses && !includeMeetings) {
      throw new Error("変更がありません");
    }

    // 1) 現在のmainブランチのコミットSHA
    const ref = await ghFetch(`${api}/git/ref/heads/${BRANCH}`, {}, pat);
    const baseCommitSha = ref.object.sha;

    // 2) コミットのツリーSHA
    const commit = await ghFetch(`${api}/git/commits/${baseCommitSha}`, {}, pat);
    const baseTreeSha = commit.tree.sha;

    // 3) 変更対象ごとに blob 作成 → ツリーエントリを構築
    const treeEntries = [];
    if (includeCourses) {
      const coursesBlob = await ghFetch(`${api}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: utf8ToBase64(generateCoursesJsFile(courses)),
          encoding: "base64"
        })
      }, pat);
      treeEntries.push(
        { path: COURSES_PATH_SRC, mode: "100644", type: "blob", sha: coursesBlob.sha },
        { path: COURSES_PATH_DOCS, mode: "100644", type: "blob", sha: coursesBlob.sha }
      );
    }
    if (includeMeetings) {
      const meetingsBlob = await ghFetch(`${api}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: utf8ToBase64(generateMeetingsJsFile(meetings)),
          encoding: "base64"
        })
      }, pat);
      treeEntries.push(
        { path: MEETINGS_PATH_SRC, mode: "100644", type: "blob", sha: meetingsBlob.sha },
        { path: MEETINGS_PATH_DOCS, mode: "100644", type: "blob", sha: meetingsBlob.sha }
      );
    }

    // 4) 差し替えツリー
    const tree = await ghFetch(`${api}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries
      })
    }, pat);

    // 5) コミット作成
    const targets = [];
    if (includeCourses) targets.push("講座");
    if (includeMeetings) targets.push("社内会議");
    const newCommit = await ghFetch(`${api}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: `${targets.join("・")}データ更新 (${new Date().toISOString().slice(0, 16)})`,
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
