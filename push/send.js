// 由 GitHub Actions 定時執行：每日喺指定時區嘅時段內，隨機揀幾個時間推送「抽卡」訊號去手機。
// GitHub 嘅定時工作經常延遲或者被跳過，所以唔靠「準時」：每次有機會運行，就睇吓今日排咗嘅時間
// 過咗幾多個、已經發咗幾多個，未夠就補發一個。卡嘅內容唔經 GitHub，手機收到訊號後喺本地自己抽卡。
const fs = require("fs");
const path = require("path");
const webpush = require("web-push");

const TZ = process.env.TZ_NAME || "Europe/London";
const PER_DAY = Number(process.env.PER_DAY || 3);
const START = Number(process.env.START_HOUR || 9) * 60;   // 分鐘
const END = Number(process.env.END_HOUR || 22) * 60;
const MIN_GAP = Number(process.env.MIN_GAP_MIN || 120);
const FORCE = process.env.FORCE === "true";
const STATE_DIR = path.join(__dirname, "state");
const STATE_FILE = path.join(STATE_DIR, "state.json");

// 指定時區嘅今日日期同而家幾點（分鐘）
function localNow(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// 用日期做種子，每日排出固定嘅幾個隨機時間（每次運行計出嚟都一樣）
function dailyPlan(date) {
  let seed = 0;
  for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const span = END - START - 15;
  for (let tries = 0; tries < 500; tries++) {
    const times = Array.from({ length: PER_DAY }, () => START + Math.floor(rand() * span)).sort((a, b) => a - b);
    if (times.every((t, i) => i === 0 || t - times[i - 1] >= MIN_GAP)) return times;
  }
  // 揀唔到就平均分佈
  return Array.from({ length: PER_DAY }, (_, i) => START + Math.round((span * (i + 0.5)) / PER_DAY));
}

const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}
function writeState(s) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s));
}

async function main() {
  const now = localNow();
  let state = readState();
  if (state.date !== now.date) state = { date: now.date, sent: 0, last: 0 };
  writeState(state);

  const plan = dailyPlan(now.date);
  const due = plan.filter(t => t <= now.minutes).length;
  console.log(`${TZ} ${now.date} ${hhmm(now.minutes)}｜今日時間表：${plan.map(hhmm).join("、")}｜已發 ${state.sent}，應發 ${due}`);

  if (!FORCE) {
    if (now.minutes >= END || now.minutes < START) { console.log("唔喺推送時段，今次唔發。"); return; }
    if (state.sent >= due) { console.log("未到時間，今次唔發。"); return; }
    if (state.last && Date.now() - state.last < (MIN_GAP - 30) * 60000) { console.log("同上一張太近，遲啲先發。"); return; }
  }

  const raw = process.env.PUSH_CONFIG;
  if (!raw) {
    console.log("未設定 PUSH_CONFIG secret，略過。請喺 app「設定」頁開啟通知並複製設定碼。");
    return;
  }
  let cfg;
  try {
    cfg = JSON.parse(Buffer.from(raw.trim(), "base64").toString("utf8"));
  } catch {
    console.error("PUSH_CONFIG 格式唔啱，請由 app 重新複製設定碼。");
    process.exit(1);
  }

  webpush.setVapidDetails(cfg.subject || "mailto:noreply@example.com", cfg.publicKey, cfg.privateKey);
  try {
    const res = await webpush.sendNotification(cfg.subscription, JSON.stringify({ type: "random" }), { TTL: 3600, urgency: "normal" });
    console.log("已推送，狀態", res.statusCode);
    if (!FORCE) { state.sent += 1; state.last = Date.now(); writeState(state); }
  } catch (err) {
    console.error("推送失敗", err.statusCode, err.body || err.message);
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.error("手機訂閱已失效：請喺 app「設定」頁再撳「開啟通知」，複製新設定碼更新 PUSH_CONFIG。");
    }
    process.exit(1);
  }
}

main();
