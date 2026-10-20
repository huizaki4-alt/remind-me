# 知識抽卡（PWA）

記低想記住嘅嘢，隨機抽一張重溫。可以加到 iPhone 主畫面，好似 app 咁用，離線都用得。

- **卡存喺手機本地**（IndexedDB），唔經任何伺服器；「設定」頁可以匯出／匯入備份（.json）
- **影相／相簿揀相 → 轉文字**：用 Tesseract.js 喺手機入面辨識，相片唔上載、轉完即刻丟棄
- **羊皮紙卡**：冇橫線、冇日期
- **抽卡頁同全部頁都可以修改、刪除**
- **不定時推送隨機卡通知**：由呢個 repo 嘅 GitHub Actions 免費發送
- **全程免費**：GitHub Pages、GitHub Actions、文字辨識都喺免費範圍內，唔使信用卡

## 檔案

| 位置 | 用途 |
| --- | --- |
| `docs/` | 成個 app（GitHub Pages 由呢度發佈） |
| `docs/vendor/` | 文字辨識程式同中英文辨識資料（自己 host，唔靠第三方 CDN） |
| `push/send.js` | 發推送嘅小程式 |
| `.github/workflows/random-card.yml` | 定時隨機推送 |

## 設定步驟（只做一次）

### 1. 發佈 app（GitHub Pages，免費）

GitHub Pages 喺**免費帳戶只支援 public repo**。repo 入面冇你張卡嘅內容（卡淨係喺手機），通知鎖匙放喺 Secret，公開都唔會外洩，所以建議：

1. 將呢個 branch 合併入 `main`（定時通知都一定要喺 `main` 先會跑）
2. repo →「Settings」→「General」→ 最底「Change visibility」→ 改做 **Public**
3. 「Settings」→「Pages」→ Source 揀「Deploy from a branch」，Branch 揀 `main`、資料夾揀 `/docs` → Save
4. 等一兩分鐘，網址會係 `https://huizaki4-alt.github.io/remind-me/`

> 想保持 private：可以改用 Cloudflare Pages（免費）連接呢個 repo，Build output directory 填 `docs`。

### 2. 加到 iPhone 主畫面

用 **Safari** 開上面網址 → 撳「分享」→「加至主畫面」。之後一律由主畫面圖示打開。

### 3. 匯入舊卡

喺「設定」→「匯入備份」，揀由舊版 artifact 匯出嘅 `.json` 檔。

### 4. 開通知（需要 iOS 16.4 或以上）

1. 由主畫面圖示打開 app →「設定」→「開啟通知」→ 允許
2. 撳「複製設定碼」
3. GitHub repo →「Settings」→「Secrets and variables」→「Actions」→「New repository secret」
   - Name：`PUSH_CONFIG`
   - Secret：貼上設定碼
4. 想即刻試：「Actions」→「隨機卡通知」→「Run workflow」

之後每日喺英國時間 9am–10pm 之間，隨機揀 3 個時間（相隔最少 2 個鐘）推送，自動跟夏令／冬令時間。GitHub 嘅定時工作經常延遲或者跳過，所以每 20 分鐘檢查一次，過咗預定時間未發就會補發。想改數量、時段或者時區，改 `random-card.yml` 入面嘅 `PER_DAY`、`START_HOUR`、`END_HOUR`、`TZ_NAME`。

推送內容只係一個「抽卡」訊號，**卡嘅文字唔會經 GitHub**：手機收到之後喺本地自己抽一張顯示。

## 費用

- GitHub Pages、public repo 嘅 Actions：免費、冇上限
- private repo 嘅 Actions：每月 2000 分鐘免費，呢個 workflow 每月最多大約用 1400 分鐘；冇設付款方式嘅話，超額只會停，唔會收錢
- 文字辨識喺手機入面運行，冇 API 費用

## 注意

- 卡只存喺嗰部手機。刪除 app、或者喺 Safari 清除網站資料，卡會冇咗，**記得定期匯出備份**
- 如果收唔到通知：返去「設定」再撳「開啟通知」，複製新設定碼更新 `PUSH_CONFIG`
- public repo 如果 60 日冇任何改動，GitHub 會暫停定時 workflow；去「Actions」撳「Enable workflow」就會恢復
- 文字辨識第一次要下載約 16MB 資料，之後會快取。印刷字辨識效果最好，手寫字唔準；記得轉完核對
