/**
 * 社内会議の映像アーカイブ
 *
 * 管理画面から将来的に管理予定（現状は手動編集）。
 * 形式は courses.js とほぼ同じ。lecturers の代わりに attendees（出席者）を使用。
 */

const MEETINGS = [
  {
    id: 1,
    slug: "sample-meeting-01",
    title: "サンプル：月次営業会議",
    date: "2026-05-15",
    startTime: "10:00",
    endTime: "11:30",
    attendees: ["田中（営業部）", "鈴木（マーケ）", "佐藤（管理）"],
    duration: "90分",
    tags: ["営業", "月次"],
    thumbnail: "",
    youtubeId: "",
    description: "5月度の営業会議。\n• 4月の振り返り\n• 5月の重点施策\n• 各拠点の進捗共有\n\nこのカードはサンプルです。実際の会議データに置き換えてください。",
    materials: []
  },
  {
    id: 2,
    slug: "sample-meeting-02",
    title: "サンプル：全社キックオフ",
    date: "2026-04-03",
    startTime: "14:00",
    endTime: "16:00",
    attendees: ["全社員"],
    duration: "120分",
    tags: ["全社", "四半期"],
    thumbnail: "",
    youtubeId: "",
    description: "Q2キックオフミーティング。\n会社方針・KPI共有・各部発表。",
    materials: []
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEETINGS;
}
