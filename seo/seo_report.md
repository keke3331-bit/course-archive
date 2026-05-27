# SEOレポート

| 項目 | 状態 | 備考 |
|---|---|---|
| `<title>` | ✅ OK | index.html / course.html ともに設定済み。詳細ページは JSで動的に書き換え |
| meta description | ✅ OK | 両ページに記載。詳細ページは講座概要から生成 |
| OGP (og:title / og:description / og:type) | ✅ OK | 一覧 website / 詳細 article |
| viewport | ✅ OK | レスポンシブ対応 |
| favicon | ✅ OK | SVG絵文字インライン |
| 見出し階層 | ✅ OK | h1（ページに1つ） → h2 → h3 |
| alt属性 | ✅ OK | サムネ画像は装飾扱いで alt="" + aria-label をリンクに付与 |
| 内部リンク | ✅ OK | カード→詳細ページ、詳細→一覧へ戻る |
| 構造化データ | ⚠️ 任意 | 必要に応じてVideoObject JSON-LDを追加可能（未実装） |
| robots.txt / sitemap.xml | ⚠️ 任意 | 限定公開動画を扱うため検索エンジン公開非推奨。robots noindex運用が無難 |

## 注意

- YouTubeは「限定公開」のため、検索エンジンに動画ページがインデックスされても本サイト経由でしかアクセスされない
- 本サイト全体を検索結果に出したくない場合、各HTMLの `<head>` に `<meta name="robots" content="noindex,nofollow">` を追加すること

## 推奨追加対応（必要なら）

```html
<!-- すべての .html の <head> に -->
<meta name="robots" content="noindex,nofollow">
```
