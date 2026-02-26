import axios from "axios";

const SEOUL_KEY = process.env.SEOUL_SUBWAY_KEY;
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL;

const STATION_QUERY = "삼성중앙"; // 삼성중앙역
const UPDN = "상행"; // 동작 방향(개화 방면)

function pickArrivals(rows) {
  const filtered = rows
    .filter(r => (r.updnLine || "").includes(UPDN))
    // 9호선만 더 좁히고 싶으면 응답에 subwayId가 있는지 보고 추가:
    // .filter(r => r.subwayId === "1009")
    .sort((a, b) => (Number(a.barvlDt) || 999999) - (Number(b.barvlDt) || 999999));

  return filtered.slice(0, 2);
}

async function fetchArrivals() {
  if (!SEOUL_KEY) throw new Error("SEOUL_SUBWAY_KEY missing");
  const url =
    `http://swopenAPI.seoul.go.kr/api/subway/${encodeURIComponent(SEOUL_KEY)}` +
    `/json/realtimeStationArrival/0/20/${encodeURIComponent(STATION_QUERY)}`;

  const { data } = await axios.get(url, { timeout: 8000 });
  return data?.realtimeArrivalList ?? [];
}

async function postToSlack(text) {
  if (!SLACK_TOKEN) throw new Error("SLACK_BOT_TOKEN missing");
  if (!SLACK_CHANNEL) throw new Error("SLACK_CHANNEL missing");

  const res = await axios.post(
    "https://slack.com/api/chat.postMessage",
    { channel: SLACK_CHANNEL, text },
    { headers: { Authorization: `Bearer ${SLACK_TOKEN}` }, timeout: 8000 }
  );

  if (!res.data?.ok) {
    throw new Error(`Slack API error: ${res.data?.error || "unknown"}`);
  }
}

(async () => {
  const rows = await fetchArrivals();
  const picks = pickArrivals(rows);

  let text;
  if (picks.length === 0) {
    text = "🚇 삼성중앙역 9호선(동작 방향/상행) 도착정보를 못 가져왔어. (API 응답 확인 필요)";
  } else {
    const lines = picks.map((r, i) => {
      const msg = r.arvlMsg2 ?? r.arvlMsg3 ?? "도착정보 없음";
      const dest = r.bstatnNm ? `(${r.bstatnNm}행)` : "";
      return `${i + 1}) ${msg} ${dest}`.trim();
    });

    text =
      `🏃 퇴근! 삼성중앙 → 동작 (9호선 상행/개화 방면)\n` +
      lines.join("\n");
  }

  await postToSlack(text);
})();