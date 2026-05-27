# スタイルガイド

## カラーパレット

| 用途 | 値 | 説明 |
|---|---|---|
| 背景 | `#FAFAF7` | オフホワイト・温かみのある白 |
| サーフェス | `#FFFFFF` | カード背景 |
| 主テキスト | `#1A2540` | ディープネイビー |
| 副テキスト | `#5C6680` | 落ち着いたグレーブルー |
| ボーダー | `#E8E5DD` | 微かなウォームグレー |
| アクセント | `#D26A4E` | コーラル（CTA・リンクホバー） |
| アクセント濃 | `#A24E36` | コーラル濃（ホバー深） |
| 強調背景 | `#F1EDE3` | ヒーロー帯 |

## タイポグラフィ

- システムフォント：`-apple-system, "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif`
- 見出しh1：32px / weight 700 / line-height 1.3
- 見出しh2：24px / weight 700 / line-height 1.4
- 見出しh3：18px / weight 600
- 本文：16px / weight 400 / line-height 1.75
- メタ情報：14px / weight 400 / color副テキスト

## 余白

- セクション間：64px（モバイル48px）
- カード内パディング：20px
- コンテナ最大幅：1120px / 中央寄せ

## コンポーネント

### カード
- 背景白 / ボーダー1px / 角丸12px
- ホバーで上方向に2px浮く + 影が深くなる
- transition 200ms ease-out

### ボタン
- プライマリ：背景アクセント / 白文字 / 角丸8px / padding 12px 24px
- ホバー：アクセント濃へ遷移

### タグ
- 背景 #F1EDE3 / 主テキスト色 / 角丸999px（pill）/ padding 4px 10px / 12px

### 動画iframe
- aspect-ratio: 16/9 / 角丸12px / 影あり

## レスポンシブ

- 〜640px：1列、コンテナpadding 16px
- 641-1024px：2列グリッド、padding 24px
- 1025px〜：3-4列グリッド、padding 32px

## アクセシビリティ

- フォーカス時の outline は必ず表示（accent色）
- alt属性必須
- カード全体をリンクにする際は `aria-label`
