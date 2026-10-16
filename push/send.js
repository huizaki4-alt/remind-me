// 由 GitHub Actions 執行：隨機決定今個鐘發唔發，發就推一個「抽卡」訊號去手機。
// 卡嘅內容唔經 GitHub，手機收到訊號後喺本地自己抽卡。
const webpush = require("web-push");

const raw = process.env.PUSH_CONFIG;
if (!raw) {
  console.log("未設定 PUSH_CONFIG secret，略過。請喺 app「設定」頁開啟通知並複製設定碼。");
  process.exit(0);
}

const chance = Number(process.env.CHANCE || "0.3");
const force = process.env.FORCE === "true";
if (!force && Math.random() >= chance) {
  console.log(`今次唔發（機率 ${chance}）。`);
  process.exit(0);
}

let cfg;
try {
  cfg = JSON.parse(Buffer.from(raw.trim(), "base64").toString("utf8"));
} catch (e) {
  console.error("PUSH_CONFIG 格式唔啱，請由 app 重新複製設定碼。");
  process.exit(1);
}

webpush.setVapidDetails(cfg.subject || "mailto:noreply@example.com", cfg.publicKey, cfg.privateKey);

webpush
  .sendNotification(cfg.subscription, JSON.stringify({ type: "random" }), { TTL: 3600, urgency: "normal" })
  .then(res => console.log("已推送，狀態", res.statusCode))
  .catch(err => {
    console.error("推送失敗", err.statusCode, err.body || err.message);
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.error("手機訂閱已失效：請喺 app「設定」頁再撳「開啟通知」，複製新設定碼更新 PUSH_CONFIG。");
    }
    process.exit(1);
  });
