# 旅評小站 共用線上版

React 與 Node.js 旅遊評價系統，正式資料保存於 Supabase PostgreSQL，網站由 Render 執行。

直接開啟 [線上 Demo](https://travel-review-hanmin0.onrender.com/)，不需下載或安裝程式。資料由不同電腦共用。

- [網站資料庫管理頁](https://travel-review-hanmin0.onrender.com/admin)：使用專案擁有者設定的管理密碼。
- [Supabase 真實資料庫](https://supabase.com/dashboard/project/hlyjdffarxstlgvsdtul/editor)：需登入專案擁有者的 Supabase 帳號。
- [GitHub 自動測試與建置](https://github.com/HAN-min0/-Project/actions/workflows/verify.yml)。

免費主機閒置後會休眠，首次開啟可能需要等待約一分鐘。

- [專案說明與本機驗證](travel-review/README.md)
- [線上部署與資料庫查看](travel-review/docs/部署說明.md)
- [PostgreSQL 資料表](travel-review/server/cloud-schema.sql)
- [部署設定](render.yaml)

程式位於 `travel-review` 子資料夾。此 Demo 已完成部署、官方 CA 憑證設定與線上共用資料驗證；重建方式見部署說明。
