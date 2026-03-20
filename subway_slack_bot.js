import axios from "axios";

const SEOUL_KEY = process.env.SEOUL_SUBWAY_KEY;
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;

const STATION = "삼성중앙";
const UPDN = "상행"; // 동작 방향

// 🔥 명언 리스트
const QUOTES = [
  "오늘도 버틴 너, 진짜 잘했다.",
  "작은 전진도 결국 큰 차이를 만든다.",
  "지금 이 순간도 충분히 가치 있다.",
  "오늘 하루도 무사히 끝냈다는 게 대단한 거야.",
  "천천히 가도 괜찮아, 멈추지만 않으면 된다.",
  "너는 생각보다 훨씬 잘하고 있어.",
  "오늘의 피로는 내일의 성장을 만든다.",
  "지금 이 순간, 충분히 잘 살고 있다.",
  "고생했어. 오늘은 너를 위해 쉬어도 된다.",
  "하루를 버텨낸 것만으로도 이미 성공이다."
];

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

function pickArrivals(rows) {
  return rows
    .filter(r => (r.updnLine || "").includes(UPDN))
    .filter(r => r.subwayId === "1009")
    .sort((a, b) => (Number(a.barvlDt) || 999999) - (Number(b.barvlDt) || 999999))
    .slice(0, 2);
}

function applyCorrection(sec, r) {
  if (sec > 300 && r.arvlMsg2?.includes("전역")) {
    return sec - 300;
  }
  return sec;
}

function formatTime(sec) {
  if (!sec || sec <= 0) return "곧 도착";

  const min = Math.floor(sec / 60);
  const s = sec % 60;

  if (min === 0) return `${s}초 후 도착`;
  return `${min}분 ${s}초 후 도착`;
}

async function fetchArrivals() {
  const url = `http://swopenAPI.seoul.go.kr/api/subway/${SEOUL_KEY}/json/realtimeStationArrival/0/10/${encodeURIComponent(STATION)}`;
  const { data } = await axios.get(url, { timeout: 8000 });
  return data?.realtimeArrivalList ?? [];
}

async function postToSlack(text) {
  await axios.post(
    "https://slack.com/api/chat.postMessage",
    {
      channel: SLACK_CHANNEL,
      text
    },
    {
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`
      }
    }
  );
}

(async () => {
  try {
    const rows = await fetchArrivals();
    const picks = pickArrivals(rows);

    const quote = getRandomQuote();

    let text;

    if (picks.length === 0) {
      text = `🚇 삼성중앙역 도착 정보를 가져오지 못했습니다.\n\n💬 "${quote}"`;
    } else {
      const lines = picks.map((r, i) => {
        let sec = Number(r.barvlDt);
        sec = applyCorrection(sec, r);

        let timeText = formatTime(sec);

        if (sec <= 60) {
          timeText = `🔥 ${timeText}`;
        }

        const type = r.trainLineNm?.includes("급행") ? "🚀급행" : "일반";

        return `• ${type} | ${timeText}`;
      });

      text =
`🏃 *퇴근 알림*  
━━━━━━━━━━━━━━━
🚇 삼성중앙 → 동작 (9호선)

${lines.join("\n")}

━━━━━━━━━━━━━━━
💬 "${quote}"`;
    }

    await postToSlack(text);

  } catch (e) {
    console.error(e);
    await postToSlack("❌ 지하철 정보 조회 중 오류 발생");
  }
})();
