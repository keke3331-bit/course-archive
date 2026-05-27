# 講座アーカイブサイト — 運用ガイド

## プロジェクト構成

```
course-archive/
├── src/                   ← 公開対象ファイル
│   ├── index.html         講座一覧
│   ├── course.html        講座詳細
│   ├── css/style.css
│   ├── js/main.js         一覧ページのロジック
│   ├── js/course.js       詳細ページのロジック
│   ├── data/courses.js    ★講座データ（ここを編集）
│   └── assets/materials/  ★PDFはここに置く
├── orders/                要件定義
├── design/                設計書
├── seo/                   SEOレポート
├── test/                  テストレポート
└── delivery/              この README ほか
```

---

## ローカルで確認する

### 方法A：ダブルクリック（最速）
`src/index.html` をブラウザにドラッグ＆ドロップする。
※ `file://` 環境でも動作するよう設計されている。

### 方法B：簡易ローカルサーバー（推奨）
```bash
cd ~/projects/course-archive/src
python3 -m http.server 8000
# → http://localhost:8000 をブラウザで開く
```

---

## 新しい講座を追加する

### 1. YouTube動画をアップロード
- YouTube Studio で「限定公開（Unlisted）」を選んでアップロード
- URL `https://youtu.be/abcDEF12345` の **abcDEF12345** が動画ID

### 2. 資料PDFを配置
`src/assets/materials/` にPDFを置く。命名規則：`course-<id>-<内容>.pdf`

### 3. `src/data/courses.js` の配列に追加
```js
{
  id: 4,                              // 既存と重複しない数値
  slug: "your-course-slug",
  title: "新講座タイトル",
  date: "2025-07-01",
  duration: "90分",
  tags: ["タグA", "タグB"],
  thumbnail: "",                      // 空ならYouTubeから自動取得
  youtubeId: "abcDEF12345",           // ステップ1の動画ID
  description: "講座の概要。\n改行も使える。",
  materials: [
    {
      title: "スライド資料",
      file: "course-04-slides.pdf",   // ステップ2のファイル名
      size: "2.4 MB",
      pages: 28
    }
  ]
}
```

これで完了。HTML編集は不要。

---

## GitHub Pagesで公開する

### 初回のみ
```bash
cd ~/projects/course-archive

# docs/ にコピー（GitHub Pages公開用）
mkdir -p docs && cp -r src/* docs/

# Git初期化
git init
git add docs/ src/ *.md orders/ design/ seo/ test/ delivery/
git commit -m "初回リリース"
git branch -M main

# GitHubリポジトリ作成（プライベートなら --private に変更）
gh repo create course-archive --public --description "講座アーカイブ"
git remote add origin https://github.com/keke3331-bit/course-archive.git
git push -u origin main

# GitHub Pages を docs/ から有効化
gh api repos/keke3331-bit/course-archive/pages --method POST \
  --field 'source[branch]=main' --field 'source[path]=/docs'
```

→ 公開URL：`https://keke3331-bit.github.io/course-archive/`
（有効化後1〜2分でアクセス可能）

### 2回目以降の更新
```bash
cd ~/projects/course-archive
cp -r src/* docs/
git add docs/ src/
git commit -m "講座追加：〇〇"
git push
# → GitHub Pagesが自動更新（1〜2分）
```

---

## よくある質問

**Q. 限定公開なのに公開リポジトリで動画ID出して大丈夫？**
A. リポジトリをプライベートにする場合は `gh repo create ... --private` にしてください。公開リポジトリでも YouTube側で「埋込許可ドメイン」を設定すれば、ID漏洩リスクを下げられます。最も安全なのは **リポジトリをプライベートにしてGitHub Pagesを Pro/Enterprise プランで運用** することですが、個人運用ならパブリック+限定公開で運用するケースも一般的です。

**Q. 検索エンジンに引っかからないようにしたい**
A. `src/index.html` と `src/course.html` の `<head>` に以下を追加してください：
```html
<meta name="robots" content="noindex,nofollow">
```

**Q. PDFが大きすぎてGitHubに上げられない**
A. GitHubは1ファイル100MB上限。それ以上はGoogle Drive等を使い、`file` フィールドに完全URLを書くと外部リンクとして動作します（リンクは別途実装が必要）。

**Q. デザインを変えたい**
A. `src/css/style.css` の上部 `:root { --bg: ...; --accent: ...; }` を編集すれば全体のカラーが一括変更できます。

---

## 連絡

不具合・要望があれば [Issue を立ててください](https://github.com/keke3331-bit/course-archive/issues)。
