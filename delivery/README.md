# 講座アーカイブサイト — 運用ガイド

## プロジェクト構成

```
course-archive/
├── src/                   ← 公開対象ファイル
│   ├── index.html         講座一覧
│   ├── course.html        講座詳細
│   ├── admin.html         🔐 管理画面
│   ├── css/style.css
│   ├── css/admin.css
│   ├── js/main.js         一覧ページのロジック
│   ├── js/course.js       詳細ページのロジック
│   ├── js/admin.js        管理画面ロジック
│   ├── data/courses.js    ★講座データ（管理画面から自動更新）
│   └── assets/materials/  PDFを直接ホストする場合のフォルダ
├── docs/                  GitHub Pages公開フォルダ（src/と同期）
├── orders/                要件定義
├── design/                設計書
├── seo/                   SEOレポート
├── test/                  テストレポート
└── delivery/              この README ほか
```

---

## 🔐 管理画面の使い方（推奨）

### URL
- 本番：`https://keke3331-bit.github.io/course-archive/admin.html`
- ローカル：`http://localhost:8765/admin.html`

### パスワード
- **Kamagaya1123**

### 初回セットアップ（GitHub Token登録）
公開を有効にするため、GitHub Personal Access Token を一度だけ登録します。

1. https://github.com/settings/tokens/new?scopes=repo&description=course-archive-admin
   にアクセス
2. **Expiration**: 任意（推奨：1年）
3. **Select scopes**: `repo` にチェック
4. ページ最下部の **Generate token** を押下
5. 表示されたトークン（`ghp_...`）をコピー
6. 管理画面の「⚙️ GitHub接続設定」を開き、トークンを貼って「保存」

→ このトークンは**お使いのブラウザにのみ保存**され、GitHub以外には送信されません。

### 講座を追加・編集する
1. 管理画面にログイン
2. 「+ 新規追加」または既存講座の「編集」を押す
3. フォームに入力
   - **タイトル / 開催日** ：必須
   - **YouTube動画リンク** ：限定公開URLをそのまま貼ればOK（IDも可）
   - **手元資料**：Google Driveで「リンクを知っている全員」共有にしたファイルのURLを貼る
4. 「保存」で**ローカル下書き**として保持
5. 編集が完了したら下部の「💾 保存して公開」を押す
6. GitHubに自動コミット → 1〜2分後にサイトに反映

### YouTubeリンクの形式（どれでもOK）
```
https://www.youtube.com/watch?v=abcDEF12345
https://youtu.be/abcDEF12345
https://www.youtube.com/embed/abcDEF12345
abcDEF12345  ← IDだけでも可
```

### Google Driveリンクの形式
```
https://drive.google.com/file/d/FILE_ID/view
```
（管理画面が自動でダウンロード用URLに変換します）

⚠️ Drive側で「**リンクを知っている全員が閲覧者**」共有設定にしてください。

### ログアウト
画面右上の「ログアウト」を押す。未保存変更がある場合は確認が出ます。

---

## 手動で講座を追加する（管理画面を使わない場合）

### 1. YouTube動画をアップロード
- YouTube Studio で「限定公開（Unlisted）」を選んでアップロード
- URL `https://youtu.be/abcDEF12345` の **abcDEF12345** が動画ID

### 2. 資料をGoogle Driveにアップロード
- ファイルを右クリック → 「共有」→ 「リンクを知っている全員」→ 「閲覧者」
- 「リンクをコピー」で `https://drive.google.com/file/d/FILE_ID/view` の形式のURLを取得

### 3. `src/data/courses.js` の配列に追加
```js
{
  id: 4,
  slug: "your-course-slug",
  title: "新講座タイトル",
  date: "2025-07-01",
  duration: "90分",
  tags: ["タグA", "タグB"],
  thumbnail: "",
  youtubeId: "abcDEF12345",
  description: "講座の概要。\n改行も使える。",
  materials: [
    {
      title: "スライド資料",
      file: "https://drive.google.com/uc?export=download&id=FILE_ID"
    }
  ]
}
```

### 4. docs/に反映してpush
```bash
cd ~/projects/course-archive
cp -r src/* docs/
git add -A && git commit -m "講座追加：〇〇" && git push
```

---

## ローカルで確認する

### 簡易ローカルサーバー（推奨）
```bash
cd ~/projects/course-archive/src
python3 -m http.server 8765
# → http://localhost:8765 をブラウザで開く
# → 管理画面は http://localhost:8765/admin.html
```

※ 管理画面の「保存して公開」機能は、ローカル/本番どちらからでも動作します。

---

## GitHub Pages公開（初回のみ・既に実施済み）

```bash
# 既にセットアップ済み：
# - リポジトリ: https://github.com/keke3331-bit/course-archive
# - 公開URL: https://keke3331-bit.github.io/course-archive/
```

---

## セキュリティについて

### 管理画面のパスワード
- パスワード「Kamagaya1123」はクライアント側でハッシュ照合（SHA-256）しています
- ブラウザのソースを見れば「ハッシュ値」は見えますが、元のパスワードは見えません
- ただし、パスワードを変更する場合は `src/js/admin.js` の `PASSWORD_HASH` を更新してください

### パスワードを変更したい
ターミナルで以下を実行してハッシュ値を取得：
```bash
printf '新しいパスワード' | shasum -a 256 | awk '{print $1}'
```
→ 出力された64文字を `src/js/admin.js` の `PASSWORD_HASH` に貼り付けて、docs/に同期してpush。

### GitHub Token
- 管理画面で保存したPATは、お使いのブラウザの `localStorage` にのみ保存されます
- 共有PCで使った場合は、管理画面の「⚙️ GitHub接続設定」→「削除」で消してください

### 検索エンジンへの非公開
- `admin.html` には `<meta name="robots" content="noindex,nofollow">` が入っているため、検索結果には出ません
- 講座本体ページ（index.html / course.html）も検索エンジンに出したくない場合は、同様のmetaタグを追加してください

---

## よくある質問

**Q. 「保存して公開」で 401 / 403 エラーが出る**
A. PATが期限切れか権限不足です。新しいPATを `repo` 権限で発行し直してください。

**Q. 公開したのにサイトに反映されない**
A. GitHub Pagesのビルドに1〜2分かかります。それでも反映されない場合はブラウザのキャッシュをクリア（Cmd+Shift+R）してください。

**Q. 資料をDriveではなくサイトに直接置きたい**
A. PDFを `src/assets/materials/` に置き、`file` フィールドに `assets/materials/course-01-slides.pdf` のような相対パスを書けばOKです。

**Q. デザインを変えたい**
A. `src/css/style.css` の上部 `:root { --bg: ...; --accent: ...; }` を編集すれば全体のカラーが一括変更できます。変更後はdocs/に同期してpushしてください。
