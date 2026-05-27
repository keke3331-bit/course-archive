# 手元資料の置き場

ここに講座のPDF/PPT/その他資料を配置してください。

## ファイル名規則
`course-<id>-<内容>.pdf`

例：
- `course-01-slides.pdf`
- `course-01-worksheet.pdf`
- `course-02-slides.pdf`

## 参照方法
`src/data/courses.js` の `materials` 配列で参照します。

```js
materials: [
  {
    title: "スライド資料",
    file: "course-01-slides.pdf",
    size: "2.4 MB",
    pages: 32
  }
]
```

ファイル名（`file` フィールド）はこのフォルダ内の相対パスです。
