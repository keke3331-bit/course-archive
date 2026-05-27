/**
 * 講座データ
 *
 * 新しい講座を追加するときは、この配列の先頭に1エントリ追加してください。
 *
 * フィールド:
 *   id           ユニークID（数値・重複不可）
 *   slug         URL用識別子（英数ハイフン）
 *   title        講座タイトル
 *   date         開催日 (YYYY-MM-DD)
 *   duration     所要時間 (例: "90分")
 *   tags         タグ配列 (任意)
 *   thumbnail    サムネ画像 (任意・空ならYouTubeの hqdefault を自動取得)
 *   youtubeId    YouTube動画ID (限定公開URL "https://youtu.be/XXXX" のXXXX部分)
 *   description  講座概要（複数行可・改行は \n）
 *   materials    手元資料の配列 [{title, file, size, pages}]
 *                ファイルは src/assets/materials/ 配下に置く
 */

const COURSES = [
  {
    id: 1,
    slug: "sample-course-01",
    title: "サンプル講座01：はじめての〇〇",
    date: "2025-04-15",
    duration: "90分",
    tags: ["入門", "基礎"],
    thumbnail: "",
    youtubeId: "dQw4w9WgXcQ",
    description: "ここに講座の概要を書きます。\n複数行に分けて書けます。\n\n章立てや学習ゴールなども記載してください。",
    materials: [
      {
        title: "スライド資料",
        file: "course-01-slides.pdf",
        size: "2.4 MB",
        pages: 32
      },
      {
        title: "ワークシート",
        file: "course-01-worksheet.pdf",
        size: "0.5 MB",
        pages: 4
      }
    ]
  },
  {
    id: 2,
    slug: "sample-course-02",
    title: "サンプル講座02：応用編〇〇の実践",
    date: "2025-05-20",
    duration: "120分",
    tags: ["応用", "ハンズオン"],
    thumbnail: "",
    youtubeId: "dQw4w9WgXcQ",
    description: "応用編の概要をここに記述します。\n前提知識やゴール、扱うトピックを書きましょう。",
    materials: [
      {
        title: "スライド資料",
        file: "course-02-slides.pdf",
        size: "3.1 MB",
        pages: 48
      }
    ]
  },
  {
    id: 3,
    slug: "sample-course-03",
    title: "サンプル講座03：ケーススタディ",
    date: "2025-06-10",
    duration: "60分",
    tags: ["事例", "ディスカッション"],
    thumbnail: "",
    youtubeId: "",
    description: "ケーススタディの概要。動画IDが空のときはプレースホルダが表示されます。",
    materials: []
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = COURSES;
}
