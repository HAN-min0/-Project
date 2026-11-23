-- Initial public catalog for the dedicated travel-review Supabase project.
-- Creates six tables and loads 42 places / 18 public-source snapshots.
BEGIN;

-- Shared PostgreSQL schema. Local SQLite files are kept separately.
CREATE TABLE IF NOT EXISTS visitors (
  actor_hash TEXT PRIMARY KEY CHECK (actor_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  region TEXT NOT NULL CHECK (region IN ('north','central','south','east')),
  city TEXT NOT NULL, district TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(features) = 'array'),
  drawbacks JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(drawbacks) = 'array'),
  source TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(tags) = 'array'),
  tone TEXT NOT NULL, notice TEXT,
  origin TEXT NOT NULL CHECK (origin IN ('curated','community')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dedupe_key TEXT NOT NULL UNIQUE,
  created_by TEXT REFERENCES visitors(actor_hash)
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES destinations(id),
  actor_hash TEXT NOT NULL REFERENCES visitors(actor_hash),
  nickname TEXT NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 20),
  overall INTEGER NOT NULL CHECK (overall BETWEEN 1 AND 5),
  transport INTEGER CHECK (transport BETWEEN 1 AND 5),
  parking INTEGER CHECK (parking BETWEEN 1 AND 5),
  cleanliness INTEGER CHECK (cleanliness BETWEEN 1 AND 5),
  facilities INTEGER CHECK (facilities BETWEEN 1 AND 5),
  vendors INTEGER CHECK (vendors BETWEEN 1 AND 5),
  scenery INTEGER CHECK (scenery BETWEEN 1 AND 5),
  cost INTEGER CHECK (cost BETWEEN 0 AND 100000),
  content TEXT NOT NULL DEFAULT '' CHECK (char_length(content) <= 1000),
  tags JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(tags) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, actor_hash)
);
CREATE INDEX IF NOT EXISTS reviews_place_updated ON reviews(place_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS place_web_snapshots (
  place_id TEXT PRIMARY KEY REFERENCES destinations(id),
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  checked_at DATE NOT NULL
);
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (
  session_hash TEXT PRIMARY KEY CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);

-- The Node.js server is the data access layer. No direct anonymous Data API access.
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_web_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON visitors, destinations, reviews, place_web_snapshots, app_meta, admin_sessions FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON visitors, destinations, reviews, place_web_snapshots, app_meta, admin_sessions FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON visitors, destinations, reviews, place_web_snapshots, app_meta, admin_sessions FROM authenticated;
  END IF;
END $$;


INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('jiufen','九份老街','north','新北市','瑞芳','','老街文化','沿山坡展開的街巷，串連傳統小吃、茶館與山海景觀。','["山城街巷與海景","傳統小吃及茶館"]','["坡道與階梯較多，需考慮同行者體力","以步行逛街為主，購物與餐飲會增加花費"]','https://newtaipei.travel/zh-tw/attractions/detail/109990','["老街","山景"]','mountain',NULL,'curated','新北市|九份老街') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('shifen','十分老街','north','新北市','平溪','','老街文化','老街與鐵道相鄰，沿線聚集小吃與天燈工藝店。','["鐵道與老街相鄰","小吃及天燈工藝"]','["步行時需留意列車與現場管制","消費體驗需另計費，先確認價格"]','https://newtaipei.travel/zh-tw/attractions/detail/110037','["鐵道","老街"]','rail',NULL,'curated','新北市|十分老街') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('tamsui','淡水老街','north','新北市','淡水','','水岸散步','以老街商圈與淡水河岸為主，可安排步行賞景。','["河岸散步空間","老街小吃與商店"]','["戶外河岸行程受天氣影響","街區範圍較廣，需安排步行時間"]','https://newtaipei.travel/zh-tw/regional/sightseeing/18','["水岸","美食"]','water',NULL,'curated','新北市|淡水老街') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('bali','八里渡船頭老街','north','新北市','八里','','水岸散步','結合渡船頭、小吃店與河岸綠地的休閒街區。','["渡船頭與河景","可沿河岸散步"]','["搭船行程需配合當日船班與天候","不同消費活動的支出差異較大"]','https://newtaipei.travel/zh-tw/attractions/detail/110659','["水岸","散步"]','green',NULL,'curated','新北市|八里渡船頭老街') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('bitan','碧潭風景區','north','新北市','新店','','水岸散步','以新店溪水岸與吊橋為特色，可串連周邊步行空間。','["吊橋與水岸景色","可安排短程散步"]','["戶外體驗受天氣影響","額外水上或體驗活動需另外確認費用"]','https://newtaipei.travel/zh-tw/attractions/detail/109613','["水岸","風景"]','lake',NULL,'curated','新北市|碧潭風景區') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('yingge','鶯歌老街','north','新北市','鶯歌','','老街文化','以陶藝店家、老街與手作體驗為主的文化街區。','["陶藝商品與文化","可選擇手作體驗"]','["手作體驗的時間與費用需另確認","購物支出依個人選擇差異較大"]','https://newtaipei.travel/zh-tw/regional/sightseeing/6','["陶藝","文化"]','clay',NULL,'curated','新北市|鶯歌老街') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('yingge-river','鶯歌山水步道','north','新北市','鶯歌','','自然風景','位於大漢溪左岸，沿線可觀察鳶山與河面景觀。','["河景與山景","步道散步空間"]','["以戶外散步為主，需考慮日曬與雨勢","餐飲與設施資訊應另外確認"]','https://newtaipei.travel/zh-tw/attractions/detail/403561','["步道","河景"]','forest',NULL,'curated','新北市|鶯歌山水步道') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('yehliu','野柳地質公園','north','新北市','萬里','','自然風景','以海蝕、風化等作用形成的岩石地景為特色。','["特殊岩石地景","海岸觀察與攝影"]','["海岸行程受風雨與現場管制影響","門票及停車等費用應查官方資訊"]','https://newtaipei.travel/zh-tw/attractions/detail/109735','["海岸","地質"]','sea',NULL,'curated','新北市|野柳地質公園') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('gaomei','高美濕地','central','臺中市','清水','','自然風景','以濕地生態、木棧道與海岸夕陽景觀為特色。','["濕地生態觀察","海岸與夕陽景色"]','["棧道開放須配合潮汐與官方公告","海岸風勢與天氣會影響賞景體驗"]','https://travel.taichung.gov.tw/zh-tw/Attractions/Intro/54','["濕地","夕陽"]','sea',NULL,'curated','臺中市|高美濕地') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('sunmoon','日月潭水社碼頭','central','南投縣','魚池','','水岸散步','日月潭水社地區的碼頭與商圈，可由湖岸欣賞山水景色。','["湖岸與山景","水社商圈及旅遊轉運"]','["遊船與其他活動需另外確認票價","不同遊湖方式需要預留不同時間"]','https://www.sunmoonlake.gov.tw/zh-TW/Attractions/Attractions?a=20&id=148','["湖景","碼頭"]','lake',NULL,'curated','南投縣|日月潭水社碼頭') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('lukang','鹿港老街','central','彰化縣','鹿港','','老街文化','以瑤林街、埔頭街一帶的街屋與傳統聚落文化為主。','["老街建築與街屋","傳統工藝及地方小吃"]','["以步行逛街為主，需預留散步時間","購物與餐飲花費因人而異"]','https://tourism.chcg.gov.tw/AttractionsContent.aspx?chk=A85EDA86-370A-434E-B612-B04B3DC848AB&id=152&l=TW','["古街","文化"]','clay',NULL,'curated','彰化縣|鹿港老街') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('anping','安平老街','south','臺南市','安平','','老街文化','又稱延平老街，街區聚集特色店家、傳統小吃與老屋細節。','["傳統店家與小吃","老屋與劍獅文化"]','["熱門時段人潮可能影響步行體驗","附近古蹟或付費活動需另計費"]','https://www.twtainan.net/zh-tw/attractions/detail/812/','["老街","美食"]','clay',NULL,'curated','臺南市|安平老街') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('pier2','駁二藝術特區','south','高雄市','鹽埕','','藝術街區','由港邊倉庫再利用的藝文空間，結合展覽與公共藝術。','["倉庫建築與公共藝術","藝文展演空間"]','["部分展覽需購票，內容與開放依主辦方公告","園區步行範圍較廣，需留意天氣"]','https://yancheng.kcg.gov.tw/cp.aspx?n=C527413F7300192A','["藝術","港區"]','rail',NULL,'curated','高雄市|駁二藝術特區') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('dapeng','大鵬灣','south','屏東縣','東港','','水岸散步','以潟湖、環灣自行車道與濕地景觀為特色的旅遊區。','["潟湖與濕地生態","環灣自行車路線"]','["景點分布範圍較大，需先安排移動方式","遊船或租借器材的費用須另確認"]','https://www.dbnsa.gov.tw/attraction/AttractionAreaPage?a=141','["潟湖","單車"]','water',NULL,'curated','屏東縣|大鵬灣') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('qixingtan','七星潭','east','花蓮縣','新城','','自然風景','以弧形海灣、礫石海岸與步行賞景空間為特色。','["弧形海灣與礫石海岸","海岸步行與攝影"]','["海岸風雨與浪況會影響停留體驗","請遵守現場警示與管制，不以賞景評分判斷水域安全"]','https://hualien.travel/zh-tw/tour/4/','["海灣","海景"]','sea',NULL,'curated','花蓮縣|七星潭') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('liyulake','鯉魚潭','east','花蓮縣','壽豐','','水岸散步','山林環抱的湖泊，可依需求安排水岸散步或環潭活動。','["湖光與山景","水岸散步與環潭活動"]','["租借器材及活動費用需另外確認","戶外行程仍需配合當日天候"]','https://hualien.travel/zh-tw/tour/4/','["湖景","散步"]','lake',NULL,'curated','花蓮縣|鯉魚潭') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('luye','鹿野高台','east','臺東縣','鹿野','','自然風景','高台草地與縱谷景色是主要賞景特色，可安排戶外停留。','["高台草地與縱谷視野","戶外賞景與攝影"]','["戶外活動受天候影響","熱氣球等活動並非全年每日都有，須查活動公告"]','https://www.erv-nsa.gov.tw/zh-tw/attractions/detail/3','["草地","縱谷"]','forest',NULL,'curated','臺東縣|鹿野高臺') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('sanxiantai','三仙台本島遊憩區','east','臺東縣','成功','','自然風景','以岩礁海岸與離岸島地景為特色；目前僅介紹可參考的本島遊憩區。','["海岸與岩礁地景","本島園區賞景空間"]','["八拱橋整修期間封閉，無法通行至對面小島","海岸行程須配合現場警示與管制"]','https://www.eastcoast-nsa.gov.tw/zh-tw/attractions/detail/41/','["海岸","岩礁"]','sea','八拱橋封閉整修，官方預計 2027 年底完工；出發前請查最新公告。','curated','臺東縣|三仙臺本島遊憩區') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('xiangshan','象山親山步道','north','臺北市','信義','','自然風景','可沿石階登高欣賞臺北市景與台北101，適合步行賞景。','["市區登高視野","山林步道與觀景平台"]','["階梯與坡度需要體力","雨後地面與夜間照明須留意"]','https://www.travel.taipei/zh-tw/must-visit/forest','["步道","市景"]','mountain',NULL,'curated','臺北市|象山親山步道') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('daan','大安森林公園','north','臺北市','大安','','城市公園','位於市中心的大片綠地，提供散步、休憩與自然觀察空間。','["都市綠地散步","樹木與休憩空間"]','["戶外行程受日曬與雨勢影響","活動及設施使用依現場公告"]','https://www.travel.taipei/ja/attraction/details/824','["公園","散步"]','green',NULL,'curated','臺北市|大安森林公園') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('beitou','北投溫泉博物館','north','臺北市','北投','','博物展館','由歷史公共浴場轉型的博物館，可認識北投溫泉文化與建築。','["歷史浴場建築","溫泉文化展示"]','["參觀須配合開館日與入館規範","並非提供泡湯的浴場"]','https://www.travel.taipei/en/attraction/details/454','["建築","文化"]','clay',NULL,'curated','臺北市|北投溫泉博物館') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('zhengbin','正濱漁港彩色屋','north','基隆市','中正','','水岸散步','港邊的彩色建築映著漁船與水面，可在觀景空間拍攝港灣風景。','["彩色屋與漁港景觀","港邊攝影與散步"]','["戶外賞景受天候影響","拍照時仍須留意港邊道路與作業空間"]','https://www.klzz.klcg.gov.tw/tw/klzz/973-95929.html','["漁港","彩色屋"]','water',NULL,'curated','基隆市|正濱漁港彩色屋') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('fengjia','逢甲觀光夜市','central','臺中市','西屯','','夜市美食','圍繞文華路與福星路的夜市商圈，結合多樣小吃、服飾與商店。','["多樣小吃與商店","夜間逛街體驗"]','["店家營業時段各異","實際花費取決於餐飲與購物選擇"]','https://travel.taichung.gov.tw/zh-tw/Attractions/Intro/39/','["夜市","美食"]','rail',NULL,'curated','臺中市|逢甲觀光夜市') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('shenji','審計新村','central','臺中市','西區','','藝術街區','舊宿舍轉型的文創街區，結合老建築、創作店家與步行空間。','["宿舍建築再利用","文創商店與街區散步"]','["店家營業與活動需另確認","園區不大，停留內容依個人興趣而異"]','https://travel.taichung.gov.tw/zh-tw/attractions/intro/1139','["文創","老屋"]','clay',NULL,'curated','臺中市|審計新村') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('greenway','草悟道','central','臺中市','西區','','城市公園','串連科博館、綠園道與藝文空間的都市步行綠帶，可安排市區漫遊。','["帶狀綠地與步行空間","可串連周邊藝文景點"]','["串連全程需要步行時間","戶外路段受天氣影響"]','https://travel.taichung.gov.tw/zh-tw/Attractions/Intro/786/','["綠園道","散步"]','green',NULL,'curated','臺中市|草悟道') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('nmns','國立自然科學博物館','central','臺中市','北區','','博物展館','透過常設展示、劇場與園區，認識自然、生物及科學主題。','["自然與科學展示","多種主題學習空間"]','["不同展區與劇場可能分別收費","參觀須查休館與展區開放公告"]','https://www.nmns.edu.tw/ch/','["博物館","科學"]','forest',NULL,'curated','臺中市|國立自然科學博物館') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('jiji','集集車站','central','南投縣','集集','','老街文化','以日式木造外觀與鐵道文化為特色的車站，可搭配周邊小鎮散步。','["木造車站外觀","鐵道與小鎮文化"]','["列車運行與參觀範圍應先查公告","周邊活動與租借費用需另確認"]','https://travel.nantou.gov.tw/attractions/jiji-station/','["鐵道","建築"]','rail',NULL,'curated','南投縣|集集車站') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('xitou','溪頭自然教育園區','central','南投縣','鹿谷','','自然風景','以森林環境與自然教育為主的園區，可依體力選擇步行路線。','["森林步道","自然生態與環境教育"]','["入園及部分服務須付費","步道開放與山區天氣需先查公告"]','https://exfo.ntu.edu.tw/xitou/page.php?id=1','["森林","步道"]','forest',NULL,'curated','南投縣|溪頭自然教育園區') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('cingjing','清境農場','central','南投縣','仁愛','','自然風景','高山農場結合草地、山景與農牧體驗，可安排戶外賞景行程。','["高山草地與山景","農牧主題體驗"]','["入園門票與體驗費用須先確認","山區交通及天氣影響行程安排"]','https://www.cingjing.gov.tw/jp/index.php?index_id=26','["農場","山景"]','mountain',NULL,'curated','南投縣|清境農場') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('shennong','神農街','south','臺南市','中西','','老街文化','由昔日街區發展而來的文化散步路線，沿街保有老屋與創作店家。','["老街屋與巷弄","文創店家與街區文化"]','["店家各有營業時段","屬生活街區，步行拍照須尊重住戶"]','https://www.twtainan.net/en/attractions/detail/4420/','["老屋","文化"]','clay',NULL,'curated','臺南市|神農街') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('chimei','奇美博物館','south','臺南市','仁德','','博物展館','以西洋藝術、樂器與自然人文收藏為特色，可搭配戶外園區參觀。','["多元館藏與展覽","博物館建築與戶外園區"]','["館內展覽與特展可能分別購票","開館日與入場規範須查官方公告"]','https://www.chimeimuseum.org/index.php/visit','["藝術","博物館"]','clay',NULL,'curated','臺南市|奇美博物館') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('cijin','旗津海岸公園','south','高雄市','旗津','','水岸散步','沿海岸配置步道與休憩空間，可欣賞海景並串連旗津街區。','["海岸步道與海景","可搭配旗津周邊散步"]','["交通安排須考慮渡輪或道路動線","水域活動須遵守現場開放與管制"]','https://khh.travel/ja/attractions/detail/641/','["海岸","散步"]','sea',NULL,'curated','高雄市|旗津海岸公園') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('lotuspond','蓮池潭風景區','south','高雄市','左營','','水岸散步','結合湖岸步道、龍虎塔與周邊廟宇的文化水岸景區。','["湖景與環潭步行","傳統宗教建築"]','["環潭範圍較廣，須安排步行時間","各建築的開放狀態與時間可能不同"]','https://khh.travel/zh-tw/attractions/detail/11/','["湖景","文化"]','lake',NULL,'curated','高雄市|蓮池潭風景區') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('domeoflight','美麗島站光之穹頂','south','高雄市','新興','','藝術街區','位於捷運站大廳的玻璃公共藝術，以彩繪玻璃與燈光構成視覺主題。','["玻璃公共藝術","車站中的藝術空間"]','["參觀應配合車站開放與人流","燈光活動的時段須另查公告"]','https://khh.travel/zh-tw/attractions/detail/159/','["公共藝術","捷運"]','rail',NULL,'curated','高雄市|美麗島站光之穹頂') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('longpan','龍磐公園','south','屏東縣','恆春','','自然風景','草原與石灰岩台地面向太平洋，可觀察海岸與特殊地形。','["草原與海岸視野","石灰岩地形景觀"]','["臨崖區域應遵守警示與管制","戶外風勢與日曬影響停留體驗"]','https://www.ktnp.gov.tw/News_Content2.aspx?n=5C28A0E32DF925F9&s=C1E50972440D43B2&sms=C88B5251F308CE96','["草原","海景"]','sea',NULL,'curated','屏東縣|龍磐公園') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('victorystar','勝利星村創意生活園區','south','屏東縣','屏東市','','藝術街區','日式宿舍群修復再利用的文化街區，結合老屋、餐飲與創意店家。','["歷史宿舍建築","文創店家與街區散步"]','["店家與展覽各有營業時間","購物與餐飲支出依個人選擇而異"]','https://www.tad.gov.tw/m1.aspx?id=A12-00501&sNo=0001016','["老屋","文創"]','clay',NULL,'curated','屏東縣|勝利星村創意生活園區') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('hualiencreative','花蓮文化創意產業園區','east','花蓮縣','花蓮市','','藝術街區','由舊酒廠轉型的歷史建築聚落，提供展演、文化活動與街區散步。','["酒廠建築再利用","藝文展演與創作空間"]','["展覽與活動內容依當期安排","個別體驗與店家可能另收費"]','https://hualien1913.nat.gov.tw/','["文創","歷史建築"]','clay',NULL,'curated','花蓮縣|花蓮文化創意產業園區') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('danongdafu','大農大富平地森林園區','east','花蓮縣','光復','','自然風景','結合平地森林與自行車路線的園區，可依當日開放範圍散步或騎車。','["平地森林景觀","步行與自行車路線"]','["範圍較大，需先安排移動方式","步道及服務開放範圍須查官方公告"]','https://recreation.forest.gov.tw/Files/Forest/FP/DM/08001/2024%E5%A4%A7%E8%BE%B2%E5%A4%A7%E5%AF%8C%E6%91%BA%E9%A0%81%E5%9C%B0%E5%9C%96.pdf','["森林","單車"]','forest',NULL,'curated','花蓮縣|大農大富平地森林園區') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('ruisui','瑞穗牧場','east','花蓮縣','瑞穗','','自然風景','以牧場環境與鮮乳製品為主的休閒景點，可搭配戶外停留。','["牧場與草地環境","鮮乳與乳製品"]','["開放與體驗內容可能隨時節調整","餐飲與購物會增加實際花費"]','https://www.erv-nsa.gov.tw/zh-tw/Attractions/Detail/48','["牧場","親子"]','green',NULL,'curated','花蓮縣|瑞穗牧場') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('dapopond','大坡池','east','臺東縣','池上','','水岸散步','池上的淡水草澤景觀，周邊有步行與自行車路線，可觀察湖岸生態。','["湖岸與草澤生態","環湖散步與單車"]','["戶外體驗受天氣影響","季節景觀與活動須查當期資訊"]','https://www.erv-nsa.gov.tw/zh-tw/attractions/must-visit','["湖景","生態"]','lake',NULL,'curated','臺東縣|大坡池') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('brownroad','伯朗大道','east','臺東縣','池上','','自然風景','穿越池上田野的小路，以稻田、山巒與鄉間景色吸引步行和單車旅客。','["稻田與山巒視野","田間步行與單車"]','["田間日曬明顯，景觀隨農作季節改變","需遵守當地車輛管制並尊重耕作空間"]','https://tour.taitung.gov.tw/ja/attraction/details/951','["稻田","單車"]','green',NULL,'curated','臺東縣|伯朗大道') ON CONFLICT(id) DO NOTHING;

INSERT INTO destinations(id,name,region,city,district,address,category,description,features,drawbacks,source,tags,tone,notice,origin,dedupe_key) VALUES('taitungseaside','臺東海濱公園','east','臺東縣','臺東市','','水岸散步','鄰近市區的太平洋海岸空間，結合步道、廣場與公共藝術。','["海岸步行與聽浪","公共藝術與廣場空間"]','["海岸行程受風雨影響","應遵守海岸警示與現場管制"]','https://tour.taitung.gov.tw/zh-tw/attraction/details/308','["海景","公共藝術"]','sea',NULL,'curated','臺東縣|臺東海濱公園') ON CONFLICT(id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('jiufen','{"placeId":"jiufen","sourcePlaceName":"九份（九份老街）","overall":4,"reviewCount":5705,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806837-d1237188-Reviews-Chiufen_Jiufen_Old_Street-Ruifang_New_Taipei.html","author":"roy v","dateLabel":"2026年2月","summary":"喜歡山海視野、茶屋和沿街小吃；同時提醒街道窄、階梯多，人潮繁忙，行動不便者較吃力。","overall":null,"kind":"traveler-review"},{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806837-d1237188-Reviews-Chiufen_Jiufen_Old_Street-Ruifang_New_Taipei.html","author":"Sivan","dateLabel":"2026年5月","summary":"認為山城巷弄有許多食品與紀念品店，芋圓等在地小吃值得探索。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806837-d1237188-Reviews-Chiufen_Jiufen_Old_Street-Ruifang_New_Taipei.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('shifen','{"placeId":"shifen","sourcePlaceName":"十分老街","overall":4.2,"reviewCount":1576,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806784-d4367836-Reviews-Shifen_Old_Street-Pingxi_New_Taipei.html","author":"Van D","dateLabel":"2026年10月","summary":"喜歡天燈店協助拍照的互動和鐵道穿街的特色；也覺得小街活動選擇有限，當次餐食表現普通。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806784-d4367836-Reviews-Shifen_Old_Street-Pingxi_New_Taipei.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('tamsui','{"placeId":"tamsui","sourcePlaceName":"淡水老街","overall":4.1,"reviewCount":1051,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806921-d7369015-Reviews-Tamshui_Old_Street-Tamsui_New_Taipei.html","author":"TravelingFoodie","dateLabel":"發表於2026年1月22日","summary":"覺得小吃與商店讓街區很有活力，河畔散步和夕陽尤其吸引人；也形容這裡繁忙、觀光化。","overall":null,"kind":"traveler-review"},{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806921-d7369015-Reviews-Tamshui_Old_Street-Tamsui_New_Taipei.html","author":"Engkeat1992","dateLabel":"發表於2025年2月19日","summary":"接近農曆新年到訪時覺得人潮過多，對小吃的新鮮感也不如預期，較不建議假期造訪。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806921-d7369015-Reviews-Tamshui_Old_Street-Tamsui_New_Taipei.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('bali','{"placeId":"bali","sourcePlaceName":"八里渡船頭老街","overall":4,"reviewCount":27,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g1432365-d8756188-Reviews-Duchuantou_Old_Street-New_Taipei.html","author":"Claire Hsu","dateLabel":"2025年10月","summary":"肯定小吃、河岸騎車與夜景，也喜歡搭渡船串連淡水；提醒假日候船隊伍長，平日較從容。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g1432365-d8756188-Reviews-Duchuantou_Old_Street-New_Taipei.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('bitan','{"placeId":"bitan","sourcePlaceName":"碧潭風景區","overall":4.2,"reviewCount":156,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808475-d4999520-Reviews-Bitan_Scenic_Area-Xindian_New_Taipei.html","author":"KangKang","dateLabel":"2023年10月","summary":"認為捷運讓到訪更方便，整理後的水岸環境與設施更好，適合賞景、騎車和與家人喝下午茶。","overall":null,"kind":"traveler-review"},{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808475-d4999520-Reviews-Bitan_Scenic_Area-Xindian_New_Taipei.html","author":"招財貓","dateLabel":"2021年1月","summary":"喜歡吊橋上的景色，認為附近可搭配水上活動和商店街；但覺得商店街餐飲價格偏高。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808475-d4999520-Reviews-Bitan_Scenic_Area-Xindian_New_Taipei.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('yingge','{"placeId":"yingge","sourcePlaceName":"鶯歌陶瓷老街","overall":4,"reviewCount":411,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808607-d1642620-Reviews-Yingge_Ceramics_Street-Yingge_New_Taipei.html","author":"Julia K","dateLabel":"2019年11月","summary":"喜歡陶器店種類多，從日用陶到收藏作品都有，反覆到訪仍能找到新的商品與驚喜。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808607-d1642620-Reviews-Yingge_Ceramics_Street-Yingge_New_Taipei.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"採用「鶯歌陶瓷老街」頁面，並非陶瓷博物館或個別商場。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('yingge-river','{"placeId":"yingge-river","sourcePlaceName":"鶯歌山水步道","overall":4.4,"reviewCount":null,"notes":[{"url":"https://natsuphil.com/new-taipei/landscape-trail/","author":"小菲親子玩樂生活","dateLabel":"文章標示2025年11月9日","overall":null,"kind":"travel-blog","summary":"作者喜歡步道平緩、安靜且能欣賞河景與鳥類地景；提到部分景色被樹遮住，步行時需留意自行車。"}],"scale":5,"platform":"Google","publisher":"新北市觀光旅遊網轉載","url":"https://newtaipei.travel/zh-tw/attractions/detail/403561","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"4.4 分由新北旅遊網標示的 Google 評價取得，頁面未提供評論總數；文字心得另取自旅遊作者，兩者來源不同。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('yehliu','{"placeId":"yehliu","sourcePlaceName":"野柳地質公園","overall":4.3,"reviewCount":2253,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806954-d550250-Reviews-YehLiu_Geopark-Wanli_New_Taipei.html","author":"linglingdolly","dateLabel":"2024年9月","summary":"覺得奇岩與化石種類豐富、值得參觀；與女王頭合照需要排隊，遊覽時也要遵守園區警戒線。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806954-d550250-Reviews-YehLiu_Geopark-Wanli_New_Taipei.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('gaomei','{"placeId":"gaomei","sourcePlaceName":"高美濕地","overall":4.8,"reviewCount":673,"notes":[{"url":"https://www.trip.com/travel-guide/attraction/taichung/gaomei-wetlands-10758496?curr=KRW&locale=en-XX&poiType=3&rankingId=10070001369141&tagId=486029","author":"DizplayName","dateLabel":null,"summary":"到訪當天雲多，沒能看到夕陽，且風強、人多；即使如此，仍覺得整體景色漂亮。","overall":4,"kind":"traveler-review"}],"scale":5,"platform":"Trip.com","publisher":"Trip.com","url":"https://tw.trip.com/travel-guide/attraction/taichung/gaomei-wetlands-10758496?curr=TWD&locale=zh-TW&scene=ticket","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"使用 Trip.com 自有 673 則評論的 4.8 分；沒有混入頁面另列的 Tripadvisor 評論數。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('sunmoon','{"placeId":"sunmoon","sourcePlaceName":"水社碼頭","overall":3.9,"reviewCount":116,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808635-d6554270-Reviews-Sun_Moon_Lake_Shuishe_Wharf-Yuchi_Nantou.html","author":"wang2383","dateLabel":"發表於2021年10月6日","summary":"多次到日月潭時仍會停留水社碼頭，特別喜歡清晨湖面的靜謐景色。","overall":null,"kind":"traveler-review"},{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808635-d6554270-Reviews-Sun_Moon_Lake_Shuishe_Wharf-Yuchi_Nantou.html","author":"mikecat1985","dateLabel":"發表於2021年4月23日","summary":"2021年到訪時不喜歡沿途遊船攬客，並記錄當時乾旱、水位降低影響景觀的感受。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808635-d6554270-Reviews-Sun_Moon_Lake_Shuishe_Wharf-Yuchi_Nantou.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"評分僅對應「水社碼頭」，不是整個日月潭；2021年乾旱心得是歷史經驗，不代表目前水位。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('lukang','{"placeId":"lukang","sourcePlaceName":"鹿港老街","overall":4.3,"reviewCount":343,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806712-d3929016-Reviews-Lugang_Old_Street-Lukang_Changhua.html","author":"wang2383","dateLabel":"2023年1月","summary":"認為街區範圍較大、商品有地方特色，值得慢慢逛；假日前夕的週六下午則相當擁擠。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806712-d3929016-Reviews-Lugang_Old_Street-Lukang_Changhua.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('anping','{"placeId":"anping","sourcePlaceName":"安平老街","overall":3.6,"reviewCount":94,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13792460-d11865161-Reviews-Anping_Old_Street-Anping_Tainan.html","author":"wang2383","dateLabel":"發表於2023年3月13日","summary":"提到蜜餞、蝦餅等店家密集，但街道狹窄且人多，招牌與遮棚也讓老屋風貌較難看清。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13792460-d11865161-Reviews-Anping_Old_Street-Anping_Tainan.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"採用「安平老街」頁面，不與另一個「安平古堡老街」清單合併。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('pier2','{"placeId":"pier2","sourcePlaceName":"駁二藝術特區","overall":4.3,"reviewCount":1871,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808557-d2526629-Reviews-The_Pier_2_Art_Centre-Yancheng_Kaohsiung.html","author":"bryan0511","dateLabel":"2022年1月","summary":"喜歡新增藝術地景、市集與大港橋的夜間氣氛；覺得白天曝曬、假日人多，搭捷運或輕軌較方便。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808557-d2526629-Reviews-The_Pier_2_Art_Centre-Yancheng_Kaohsiung.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('dapeng','{"placeId":"dapeng","sourcePlaceName":"大鵬灣國家風景區","overall":4.1,"reviewCount":101,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806469-d2071603-Reviews-Dapeng_Bay_National_Scenic_Area-Donggang_Pingtung.html","author":"Jim","dateLabel":"2020年4月","summary":"喜歡搭船賞潟湖、夕陽和跨海橋景色，整體感受悠閒，適合放慢步調。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806469-d2071603-Reviews-Dapeng_Bay_National_Scenic_Area-Donggang_Pingtung.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"平台清單範圍為大鵬灣國家風景區；2020年遊船心得中的船班與開橋活動，仍須另查目前公告。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('qixingtan','{"placeId":"qixingtan","sourcePlaceName":"七星潭海岸風景特定區","overall":4.3,"reviewCount":1158,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808474-d7281962-Reviews-Chishingtan_Scenic_Area-Xincheng_Hualien.html","author":"wang2383","dateLabel":"2024年4月","summary":"喜歡山海同框、湛藍海景和自行車路線；提醒現場樹蔭不多，夏季停留要注意防曬。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13808474-d7281962-Reviews-Chishingtan_Scenic_Area-Xincheng_Hualien.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('liyulake','{"placeId":"liyulake","sourcePlaceName":"鯉魚潭（花蓮壽豐）","overall":4,"reviewCount":434,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806886-d550668-Reviews-Liyu_Lake-Shoufeng_Hualien.html","author":"wang2383","dateLabel":"2024年1月","summary":"喜歡湖面隨光線變化的景色，認為環潭步道與不同遊湖方式，能從多個角度欣賞山水。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13806886-d550668-Reviews-Liyu_Lake-Shoufeng_Hualien.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"已核對為花蓮縣壽豐鄉鯉魚潭，不是苗栗鯉魚潭水庫。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('luye','{"placeId":"luye","sourcePlaceName":"鹿野高台","overall":4.9,"reviewCount":101,"notes":[{"url":"https://tw.trip.com/travel-guide/attraction/taitung/luye-highland-10520773?poiType=66","author":"出門天天玩","dateLabel":null,"summary":"喜歡高台上的茶園、山巒與縱谷視野，也對活動期間看到熱氣球升空留下深刻印象。","overall":5,"kind":"traveler-review"}],"scale":5,"platform":"Trip.com","publisher":"Trip.com","url":"https://tw.trip.com/travel-guide/attraction/taitung/luye-highland-10520773?poiType=66","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"評分對應鹿野高台，不使用跨至伯朗大道的路線清單；熱氣球體驗屬活動期間，並非每天都有。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO place_web_snapshots(place_id,data,checked_at) VALUES('sanxiantai','{"placeId":"sanxiantai","sourcePlaceName":"三仙台風景區（含歷史登島經驗）","overall":4.4,"reviewCount":420,"notes":[{"url":"https://www.tripadvisor.com.tw/Attraction_Review-g13795597-d1816775-Reviews-Sanxiantai-Chenggong_Township_Taitung.html","author":"mikecat1985","dateLabel":"2020年7月","summary":"2020年到訪時喜歡礁岩海岸與藍天海景，覺得停車位充足；也提醒夏季日曬強、遮蔭少。","overall":null,"kind":"traveler-review"}],"scale":5,"platform":"Tripadvisor","publisher":"Tripadvisor","url":"https://www.tripadvisor.com.tw/Attraction_Review-g13795597-d1816775-Reviews-Sanxiantai-Chenggong_Township_Taitung.html","checkedAt":"2026-11-22","accessMethod":"public-page-or-indexed-snapshot","scopeNote":"平台分數涵蓋整個風景區及過往跨橋登島經驗，並非目前本島園區的專屬評分。八拱橋現有封閉整修公告，請以官方資訊為準，不能依舊心得安排登島。"}','2026-11-22') ON CONFLICT(place_id) DO NOTHING;

INSERT INTO app_meta(key,value) VALUES('schema-version','2'),('seed-version','2026-11-23-shared-42-v1') ON CONFLICT(key) DO NOTHING;
COMMIT;
SELECT 'destinations' AS table_name,COUNT(*) AS rows FROM destinations UNION ALL SELECT 'reviews',COUNT(*) FROM reviews UNION ALL SELECT 'place_web_snapshots',COUNT(*) FROM place_web_snapshots;