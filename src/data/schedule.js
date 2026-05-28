/**
 * 次回のサークル活動スケジュール
 *
 * 月ごとに更新してください。
 * target: "all" = 全会員対象 / "specialty" = 専門聴講生・DXコース対象 / "default" = 通常
 */

const SCHEDULE = {
  campus: "北総校 鎌ヶ谷キャンパス",
  monthLabel: "6月",
  year: 2026,
  title: "アカデミックサークル スケジュール",
  notice: "Community College生、AO聴講生が参加できます（初回は他コースの方も参加できます）",
  bookingHint: "完全予約制 ・ ご参加の3日前までにご予約ください",
  durationHint: "講座所要時間 60〜90分 ・ 開始10分前を目安にお越しください",
  cancelHint: "都合が悪くなった場合はお早めにご連絡ください",
  items: [
    { day: 6,  weekday: "土", time: "11:00", lecturer: "玉井", circle: "〈一般向け〉生成AI体験会",         title: "今日からわが家もアップデート！", sub: "家事や趣味に活かす「はじめてのAI活用術」", target: "default" },
    { day: 7,  weekday: "日", time: "13:00", lecturer: "関根", circle: "学びのAIくらし活用サークル",       title: "家族で遊ぶ、AIの世界",         sub: "写真編集をしてプレゼントしよう",          target: "default" },
    { day: 9,  weekday: "火", time: "13:00", lecturer: "柴",   circle: "学びデジタル安全生活サークル",     title: "知っておきたい！今の時代のためのデジタル安全講習", sub: "",                              target: "all" },
    { day: 13, weekday: "土", time: "13:00", lecturer: "入江", circle: "学びのe-sportsサークル",           title: "パズル感覚でプログラミング！",  sub: "スクラッチで作るオリジナルゲーム",        target: "default" },
    { day: 14, weekday: "日", time: "13:00", lecturer: "新田", circle: "学びデジタル安全生活サークル",     title: "その投稿、大丈夫？",            sub: "家族みんなで考えたい SNSリテラシー講座",   target: "default" },
    { day: 15, weekday: "月", time: "13:00", lecturer: "片桐", circle: "学びのAIくらし活用サークル",       title: "使うだけから一歩先へ。生成AIで暮らしの質向上", sub: "〜食事の健康管理編〜",          target: "default" },
    { day: 20, weekday: "土", time: "13:00", lecturer: "関根", circle: "学びの商店主サークル",             title: "いろんなデザインに応用が効く！", sub: "Canva講座 第2回",                       target: "specialty" },
    { day: 21, weekday: "日", time: "11:00", lecturer: "井戸", circle: "〈個人事業主・商店主向け〉生成AI活用実践セミナー", title: "AI活用で個人事業の構造アップデート", sub: "", target: "default" },
    { day: 27, weekday: "土", time: "13:00", lecturer: "玉井", circle: "学びの写真メディア活用サークル",   title: "写真と短い動画で、日常を楽しく残そう", sub: "〜Instagram体験〜",                   target: "default" },
    { day: 28, weekday: "日", time: "11:00", lecturer: "柴",   circle: "学びデジタル安全生活サークル",     title: "知っておきたい！今の時代のためのデジタル安全講習", sub: "",                              target: "all" }
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SCHEDULE;
}
