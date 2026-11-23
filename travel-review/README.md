# 旅評小站 共用線上版

這是 React + TypeScript + Vite 前端、Node.js HTTP 後端與 PostgreSQL 資料庫的旅遊評價系統。正式部署使用 Render Free 執行網站、Supabase Free 保存共用資料。GitHub 保存程式與資料表定義；實際景點與心得儲存在 Supabase。

正式網站已於 2026-11-23 完成部署，可直接開啟 [線上 Demo](https://travel-review-hanmin0.onrender.com/)；[管理頁](https://travel-review-hanmin0.onrender.com/admin)使用擁有者在 Render 設定的管理密碼。使用者不需要下載、安裝 Node.js 或執行指令。不同裝置可讀取同一份共用資料，免費主機閒置後首次開啟可能需等待約一分鐘。

## 目前功能

- 北部 12、中部 10、南部 10、東部 10，共 42 個初始景點。
- 景點介紹、特色、缺點、公開評價來源、六項細分評分與平均花費。
- 18 筆已查核來源星等與 22 則公開心得改寫，查核日期 2026-11-22。
- 多條件交集篩選、三景點比較、CSV 與 JSON 匯出。
- 多個瀏覽器訪客共用景點和公開評價，各自可新增、更新與刪除自己的評價。
- 文字心得可留空，沒有分項資料保存 NULL，明確零元支出保存 0。
- `/admin` 提供有密碼保護的唯讀資料庫檢視，可查看資料表、欄位、筆數與分頁資料。
- 正式 Supabase 專案亦可透過自己的 Dashboard → Table Editor 直接查看資料。

匿名訪客以 HttpOnly Cookie 識別，沒有跨裝置帳號登入。同一暱稱不代表同一身分；換電腦或清除 Cookie 後會是新的訪客，之前發表的內容仍保存在共用資料庫。另一台電腦可看到公開內容，但不會自動取得舊訪客的編輯權。按「更新資料」或重新整理，可讀到其他訪客新增的內容，沒有實作即時推播。

## 正式部署

完整操作見 [部署說明](docs/部署說明.md)。儲存庫根目錄的 `render.yaml` 已設定 `rootDir: travel-review`，符合目前 `HAN-min0/-Project` 的目錄結構。

目前 Demo 使用 Render 的 Public Git Repository 手動部署方式，服務為 `travel-review-hanmin0`、Free、新加坡，資料庫位於 Supabase 東京。自動部署已關閉；日後更新程式碼後，需在 Render 使用 Manual Deploy → Deploy latest commit。以下 Blueprint 步驟是重新建立服務的另一種方式。

1. 在自己的 Supabase 帳號建立專用 Free 專案。
2. 從 Connect 複製 **Session pooler** 的 PostgreSQL URI，填入 Render 的 `DATABASE_URL`。URI 可保留 `[YOUR-PASSWORD]`；在 Render 的 `DATABASE_PASSWORD` 另填自己的資料庫密碼，程式會正確編碼特殊字元。
3. 在 Render 建立 Blueprint，連接此儲存庫根目錄的 `render.yaml`。
4. 填入 `SUPABASE_PROJECT_REF`；`ADMIN_PASSWORD` 由 Blueprint 產生，可在 Render 的 Environment 查看或更改。
5. 部署完成後，用 Render 提供的 HTTPS 網址開啟網站，用同網址的 `/admin` 開啟資料庫檢視。

正式 `npm start` 必須有 `DATABASE_URL`、至少 16 字元的 `ADMIN_PASSWORD`，以及網站網址。Render 自動提供 `RENDER_EXTERNAL_URL`，其他主機需設定 `PUBLIC_ORIGIN`。後端監聽 `0.0.0.0` 及主機提供的 `PORT`，健康檢查為 `/healthz`。

資料庫初次啟動會建立六張表並匯入初始資料；之後啟動不會清空既有資料。正式模式缺少雲端連線時會停止啟動，避免將資料誤存到短暫的本機檔案。

目前專用 Supabase 專案位於東京，已建立六張表與 42 個景點。專案擁有者可開啟 [實際資料表](https://supabase.com/dashboard/project/hlyjdffarxstlgvsdtul/editor)。中文名稱與心得可正常保存；官方 Dashboard 為英文，網站與本系統管理頁使用繁體中文。

## 資料庫在哪裡

| 位置 | 負責內容 |
| --- | --- |
| Supabase 專案的 PostgreSQL | 正式共用景點、心得、訪客識別與管理登入 |
| Supabase Dashboard → Table Editor | 以專案擁有者身分查看資料表與實際內容 |
| 網站 `/admin` | 管理者登入後的唯讀資料檢視 |
| `server/cloud-schema.sql` | 六張 PostgreSQL 表、關聯、唯一值與 RLS 設定 |
| `server/cloud-bootstrap.sql` | 可在專用新專案 SQL Editor 執行的完整建表與初始景點資料 |
| `server/cloud-store.mjs` | 種子資料、參數化 SQL、共用讀寫、訪客所有權與管理查詢 |
| `server/postgres.mjs` | pg 連線池、TLS 驗證、同一連線內的交易與本機測試引擎 |
| `server/cloud.mjs` | 公網 HTTP、訪客 Cookie、管理者登入與 API |

六表為 `destinations`、`reviews`、`place_web_snapshots`、`app_meta`、`visitors`、`admin_sessions`。景點新增者及評價以訪客雜湊關聯；每個景點每位訪客可有一筆評價。公開 API 不回傳訪客雜湊或管理登入資料。瀏覽器不直接使用資料庫密碼，也不需要 Supabase 的 service-role key。

資料表已啟用 RLS，未提供匿名 Data API 政策。資料由 Node.js 後端的 PostgreSQL 連線讀寫，Supabase 專案擁有者仍可使用 Table Editor 與 SQL Editor 管理。TLS 驗證伺服器憑證。此 Supabase 專案需要官方根憑證，已在 Render 的 `DATABASE_CA_CERT` 設定完整 PEM 內容，並保留 `rejectUnauthorized: true`。官方下載來源見部署說明。

## 本機驗證

安裝 Node.js 24 或 26，在有 `package.json` 的資料夾執行：

```powershell
npm ci
npm run build
npm run demo
```

Windows 亦可雙擊 `啟動旅評小站.cmd`。開啟 `http://127.0.0.1:3000/`，管理頁為 `/admin`。未設定 `.env` 的 ADMIN_PASSWORD 時，本機驗證密碼為 `local-demo-admin-only`；此預設值僅用於明確指定的 `--demo`，正式模式不使用預設密碼。

本機驗證使用 **PGlite 的真正 PostgreSQL 引擎**，資料保存在 `data/postgres-demo/`，介面清楚標示「本機驗證模式」。它不會自動連線 Supabase，亦不是 GitHub Pages 或跨電腦共用資料庫。開發可使用 `npm run dev`，網址為 `http://127.0.0.1:5173/`。

## 原 SQLite 版本與資料移轉

原本機版的 `server/index.mjs`、`server/database.mjs`、`server/schema.sql` 仍保留。建置後執行 `npm run local` 可使用原本的 `data/travel.sqlite`；它與正式雲端資料庫分開。舊說明保存在 `docs/本機SQLite版說明.md`。

舊版個人 JSON 可由管理者在已設定雲端環境的終端機匯入：

```powershell
npm run db:import-cloud -- "C:\資料夾\舊版個人資料.json"
```

匯入會去重、排除虛構示範並以交易回滾錯誤，舊紀錄歸入獨立匯入身分，保留公開閱讀。這不是多人備份還原工具；共用版完整備份請使用 PostgreSQL 資料庫備份。網站 JSON 匯出不含訪客 Cookie 與管理登入，不能恢復原訪客的編輯權。

## AI 與來源

未設定金鑰時提供規則統計。共用版一般訪客一律使用規則；管理者已登入且後端設定 OPENAI_API_KEY 時，才允許模型呼叫。每次最多最近 30 則心得，輸出引用需能對應資料 ID。交付前沒有設定真實 API 金鑰，也沒有完成模型語意效果實驗。

72 則虛構示範評論預設關閉，不會匯入正式評價表。網路整體星等、公開短文改寫與本站細項評價分開呈現；缺少資料不填造假分數。來源日期、作者與連結仍保留。

## 測試與版本管理

```powershell
npm test
npm run build
```

已完成 43 項程式測試、14 項本機瀏覽器檢查、11 項正式網站 API 與共用資料檢查，以及 5 項正式網站介面檢查。GitHub Actions 測試與建置亦已通過。正式檢查確認 HTTPS、Supabase 連線、兩個獨立訪客的評價共存、空白心得與零元支出、編輯與刪除所有權、跨來源拒絕，以及未登入管理頁的保護。兩位測試訪客的暫時評價已移除。紀錄見 `docs/共用版驗證紀錄.json`。

管理者以正確正式密碼登入後的表格操作，仍由專案擁有者自行操作；本機驗證已涵蓋登入、登出與六表檢視。`docs/期末報告.pdf` 及可編輯 HTML 保留原本機 SQLite 版內容，線上版的技術與部署狀態請以本 README、部署說明及共用版驗證紀錄為準。

`.gitignore` 排除套件、建置結果、實際 `.env`、SQLite 與本機 PGlite 資料。個人密碼與正式資料不放進 GitHub。免費方案的閒置休眠及額度以各平台目前規則為準，示範前請先確認網站與 Supabase 專案已喚醒。
