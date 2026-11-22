/** Read-only public-web snapshots, checked manually. These are not local user reviews. */
export type PublicReviewNote = {
  author: string;
  dateLabel: string | null;
  overall: number | null;
  summary: string;
  url: string;
  kind: 'traveler-review' | 'travel-blog';
};
export type WebReviewSnapshot = {
  placeId: string;
  sourcePlaceName: string;
  platform: 'Tripadvisor' | 'Trip.com' | 'Google';
  publisher: string;
  url: string;
  overall: number;
  scale: 5;
  reviewCount: number | null;
  checkedAt: string;
  accessMethod: 'public-page-or-indexed-snapshot';
  scopeNote?: string;
  notes: PublicReviewNote[];
};
export const WEB_CHECKED_AT = '2026-11-22';
export const WEB_DATA_NOTICE = '公開網頁與搜尋快照的查核整理，非即時同步；平台分數與評論數可能變動。不同平台的樣本與計算方式不同。心得為少量人工改寫摘要，不代表全部旅客意見。';
const ta = (path: string) => `https://www.tripadvisor.com.tw/${path}`;
const urls = {
  jiufen: ta('Attraction_Review-g13806837-d1237188-Reviews-Chiufen_Jiufen_Old_Street-Ruifang_New_Taipei.html'),
  shifen: ta('Attraction_Review-g13806784-d4367836-Reviews-Shifen_Old_Street-Pingxi_New_Taipei.html'),
  tamsui: ta('Attraction_Review-g13806921-d7369015-Reviews-Tamshui_Old_Street-Tamsui_New_Taipei.html'),
  bali: ta('Attraction_Review-g1432365-d8756188-Reviews-Duchuantou_Old_Street-New_Taipei.html'),
  bitan: ta('Attraction_Review-g13808475-d4999520-Reviews-Bitan_Scenic_Area-Xindian_New_Taipei.html'),
  yingge: ta('Attraction_Review-g13808607-d1642620-Reviews-Yingge_Ceramics_Street-Yingge_New_Taipei.html'),
  yehliu: ta('Attraction_Review-g13806954-d550250-Reviews-YehLiu_Geopark-Wanli_New_Taipei.html'),
  gaomei: 'https://tw.trip.com/travel-guide/attraction/taichung/gaomei-wetlands-10758496?curr=TWD&locale=zh-TW&scene=ticket',
  sunmoon: ta('Attraction_Review-g13808635-d6554270-Reviews-Sun_Moon_Lake_Shuishe_Wharf-Yuchi_Nantou.html'),
  lukang: ta('Attraction_Review-g13806712-d3929016-Reviews-Lugang_Old_Street-Lukang_Changhua.html'),
  anping: ta('Attraction_Review-g13792460-d11865161-Reviews-Anping_Old_Street-Anping_Tainan.html'),
  pier2: ta('Attraction_Review-g13808557-d2526629-Reviews-The_Pier_2_Art_Centre-Yancheng_Kaohsiung.html'),
  dapeng: ta('Attraction_Review-g13806469-d2071603-Reviews-Dapeng_Bay_National_Scenic_Area-Donggang_Pingtung.html'),
  qixingtan: ta('Attraction_Review-g13808474-d7281962-Reviews-Chishingtan_Scenic_Area-Xincheng_Hualien.html'),
  liyulake: ta('Attraction_Review-g13806886-d550668-Reviews-Liyu_Lake-Shoufeng_Hualien.html'),
  luye: 'https://tw.trip.com/travel-guide/attraction/taitung/luye-highland-10520773?poiType=66',
  sanxiantai: ta('Attraction_Review-g13795597-d1816775-Reviews-Sanxiantai-Chenggong_Township_Taitung.html'),
};
const note = (url: string, author: string, dateLabel: string | null, summary: string, overall: number | null = null): PublicReviewNote =>
  ({url, author, dateLabel, summary, overall, kind: 'traveler-review'});
const snapshot = (placeId: string, sourcePlaceName: string, overall: number, reviewCount: number | null, notes: PublicReviewNote[], extra: Partial<WebReviewSnapshot> = {}): WebReviewSnapshot => ({
  placeId, sourcePlaceName, overall, reviewCount, notes, scale: 5, platform: 'Tripadvisor', publisher: 'Tripadvisor',
  url: urls[placeId as keyof typeof urls], checkedAt: WEB_CHECKED_AT, accessMethod: 'public-page-or-indexed-snapshot', ...extra,
});
export const webReviewSnapshots: WebReviewSnapshot[] = [
  snapshot('jiufen', '九份（九份老街）', 4.0, 5705, [
    note(urls.jiufen, 'roy v', '2026年2月', '喜歡山海視野、茶屋和沿街小吃；同時提醒街道窄、階梯多，人潮繁忙，行動不便者較吃力。'),
    note(urls.jiufen, 'Sivan', '2026年5月', '認為山城巷弄有許多食品與紀念品店，芋圓等在地小吃值得探索。'),
  ]),
  snapshot('shifen', '十分老街', 4.2, 1576, [
    note(urls.shifen, 'Van D', '2026年10月', '喜歡天燈店協助拍照的互動和鐵道穿街的特色；也覺得小街活動選擇有限，當次餐食表現普通。'),
  ]),
  snapshot('tamsui', '淡水老街', 4.1, 1051, [
    note(urls.tamsui, 'TravelingFoodie', '發表於2026年1月22日', '覺得小吃與商店讓街區很有活力，河畔散步和夕陽尤其吸引人；也形容這裡繁忙、觀光化。'),
    note(urls.tamsui, 'Engkeat1992', '發表於2025年2月19日', '接近農曆新年到訪時覺得人潮過多，對小吃的新鮮感也不如預期，較不建議假期造訪。'),
  ]),
  snapshot('bali', '八里渡船頭老街', 4.0, 27, [
    note(urls.bali, 'Claire Hsu', '2025年10月', '肯定小吃、河岸騎車與夜景，也喜歡搭渡船串連淡水；提醒假日候船隊伍長，平日較從容。'),
  ]),
  snapshot('bitan', '碧潭風景區', 4.2, 156, [
    note(urls.bitan, 'KangKang', '2023年10月', '認為捷運讓到訪更方便，整理後的水岸環境與設施更好，適合賞景、騎車和與家人喝下午茶。'),
    note(urls.bitan, '招財貓', '2021年1月', '喜歡吊橋上的景色，認為附近可搭配水上活動和商店街；但覺得商店街餐飲價格偏高。'),
  ]),
  snapshot('yingge', '鶯歌陶瓷老街', 4.0, 411, [
    note(urls.yingge, 'Julia K', '2019年11月', '喜歡陶器店種類多，從日用陶到收藏作品都有，反覆到訪仍能找到新的商品與驚喜。'),
  ], {scopeNote: '採用「鶯歌陶瓷老街」頁面，並非陶瓷博物館或個別商場。'}),
  snapshot('yingge-river', '鶯歌山水步道', 4.4, null, [
    {url: 'https://natsuphil.com/new-taipei/landscape-trail/', author: '小菲親子玩樂生活', dateLabel: '文章標示2025年11月9日', overall: null, kind: 'travel-blog', summary: '作者喜歡步道平緩、安靜且能欣賞河景與鳥類地景；提到部分景色被樹遮住，步行時需留意自行車。'},
  ], {platform: 'Google', publisher: '新北市觀光旅遊網轉載', url: 'https://newtaipei.travel/zh-tw/attractions/detail/403561', scopeNote: '4.4 分由新北旅遊網標示的 Google 評價取得，頁面未提供評論總數；文字心得另取自旅遊作者，兩者來源不同。'}),
  snapshot('yehliu', '野柳地質公園', 4.3, 2253, [
    note(urls.yehliu, 'linglingdolly', '2024年9月', '覺得奇岩與化石種類豐富、值得參觀；與女王頭合照需要排隊，遊覽時也要遵守園區警戒線。'),
  ]),
  snapshot('gaomei', '高美濕地', 4.8, 673, [
    note('https://www.trip.com/travel-guide/attraction/taichung/gaomei-wetlands-10758496?curr=KRW&locale=en-XX&poiType=3&rankingId=10070001369141&tagId=486029', 'DizplayName', null, '到訪當天雲多，沒能看到夕陽，且風強、人多；即使如此，仍覺得整體景色漂亮。', 4),
  ], {platform: 'Trip.com', publisher: 'Trip.com', scopeNote: '使用 Trip.com 自有 673 則評論的 4.8 分；沒有混入頁面另列的 Tripadvisor 評論數。'}),
  snapshot('sunmoon', '水社碼頭', 3.9, 116, [
    note(urls.sunmoon, 'wang2383', '發表於2021年10月6日', '多次到日月潭時仍會停留水社碼頭，特別喜歡清晨湖面的靜謐景色。'),
    note(urls.sunmoon, 'mikecat1985', '發表於2021年4月23日', '2021年到訪時不喜歡沿途遊船攬客，並記錄當時乾旱、水位降低影響景觀的感受。'),
  ], {scopeNote: '評分僅對應「水社碼頭」，不是整個日月潭；2021年乾旱心得是歷史經驗，不代表目前水位。'}),
  snapshot('lukang', '鹿港老街', 4.3, 343, [
    note(urls.lukang, 'wang2383', '2023年1月', '認為街區範圍較大、商品有地方特色，值得慢慢逛；假日前夕的週六下午則相當擁擠。'),
  ]),
  snapshot('anping', '安平老街', 3.6, 94, [
    note(urls.anping, 'wang2383', '發表於2023年3月13日', '提到蜜餞、蝦餅等店家密集，但街道狹窄且人多，招牌與遮棚也讓老屋風貌較難看清。'),
  ], {scopeNote: '採用「安平老街」頁面，不與另一個「安平古堡老街」清單合併。'}),
  snapshot('pier2', '駁二藝術特區', 4.3, 1871, [
    note(urls.pier2, 'bryan0511', '2022年1月', '喜歡新增藝術地景、市集與大港橋的夜間氣氛；覺得白天曝曬、假日人多，搭捷運或輕軌較方便。'),
  ]),
  snapshot('dapeng', '大鵬灣國家風景區', 4.1, 101, [
    note(urls.dapeng, 'Jim', '2020年4月', '喜歡搭船賞潟湖、夕陽和跨海橋景色，整體感受悠閒，適合放慢步調。'),
  ], {scopeNote: '平台清單範圍為大鵬灣國家風景區；2020年遊船心得中的船班與開橋活動，仍須另查目前公告。'}),
  snapshot('qixingtan', '七星潭海岸風景特定區', 4.3, 1158, [
    note(urls.qixingtan, 'wang2383', '2024年4月', '喜歡山海同框、湛藍海景和自行車路線；提醒現場樹蔭不多，夏季停留要注意防曬。'),
  ]),
  snapshot('liyulake', '鯉魚潭（花蓮壽豐）', 4.0, 434, [
    note(urls.liyulake, 'wang2383', '2024年1月', '喜歡湖面隨光線變化的景色，認為環潭步道與不同遊湖方式，能從多個角度欣賞山水。'),
  ], {scopeNote: '已核對為花蓮縣壽豐鄉鯉魚潭，不是苗栗鯉魚潭水庫。'}),
  snapshot('luye', '鹿野高台', 4.9, 101, [
    note(urls.luye, '出門天天玩', null, '喜歡高台上的茶園、山巒與縱谷視野，也對活動期間看到熱氣球升空留下深刻印象。', 5),
  ], {platform: 'Trip.com', publisher: 'Trip.com', scopeNote: '評分對應鹿野高台，不使用跨至伯朗大道的路線清單；熱氣球體驗屬活動期間，並非每天都有。'}),
  snapshot('sanxiantai', '三仙台風景區（含歷史登島經驗）', 4.4, 420, [
    note(urls.sanxiantai, 'mikecat1985', '2020年7月', '2020年到訪時喜歡礁岩海岸與藍天海景，覺得停車位充足；也提醒夏季日曬強、遮蔭少。'),
  ], {scopeNote: '平台分數涵蓋整個風景區及過往跨橋登島經驗，並非目前本島園區的專屬評分。八拱橋現有封閉整修公告，請以官方資訊為準，不能依舊心得安排登島。'}),
];
export const webReviewsByPlace: Record<string, WebReviewSnapshot> = Object.fromEntries(webReviewSnapshots.map(s => [s.placeId, s]));
export const publicNoteCount = webReviewSnapshots.reduce((n, s) => n + s.notes.length, 0);
