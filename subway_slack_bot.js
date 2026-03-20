import axios from "axios";

const SEOUL_KEY = process.env.SEOUL_SUBWAY_KEY;
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;

const STATION = "삼성중앙";
const UPDN = "상행"; // 고속터미널 방향 (개화 방면)

function pickArrivals(rows) {
  return rows
    .filter(r => (r.updnLine || "").includes(UPDN))
    .filter(r => r.subwayId === "1009") // 9호선
    .sort((a, b) => (Number(a.barvlDt) || 999999) - (Number(b.barvlDt) || 999999))
    .slice(0, 2);
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

    let text;

    if (picks.length === 0) {
      text = "🚇 삼성중앙역 도착 정보를 가져오지 못했습니다.";
    } else {
      const lines = picks.map((r, i) => {
        const sec = Number(r.barvlDt);
        let timeText = formatTime(sec);

        // 1분 이내 강조
        if (sec <= 60) {
          timeText = `🔥 ${timeText}`;
        }

        const type = r.trainLineNm?.includes("급행") ? "🚀급행" : "일반";

        return `${i + 1}) ${type} - ${timeText}`;
      });

      text =
        `🏃 삼성중앙역 → 동작 방향 (9호선 상행)\n` +
        lines.join("\n");
    }

    await postToSlack(text);

  } catch (e) {
    console.error(e);
    await postToSlack("❌ 지하철 정보 조회 중 오류 발생");
  }
})();
