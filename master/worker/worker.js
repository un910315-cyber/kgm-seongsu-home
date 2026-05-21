// KGM 자비스 — Cloudflare Worker (Claude API 중계 서버)
// ─────────────────────────────────────────────────────────────
// 역할: 자비스 PWA의 질문을 받아 Claude(Anthropic API)로 중계.
//   - Anthropic API 키는 Cloudflare의 Secret(ANTHROPIC_API_KEY)으로 보관 → 코드·깃에 노출 안 됨
//   - 날씨 질문이면 Open-Meteo(키 불필요·무료)에서 성수동 날씨를 받아 함께 전달
//   - 정비소 데이터는 PWA가 context로 보내줌 (Firebase에서 읽은 요약)
// 배포: Cloudflare Workers 또는 Deno Deploy 둘 다 가능 (코드 동일).
//   - Deno Deploy: dash.deno.com → GitHub 로그인 → New Playground → 붙여넣기
//   - 필수 환경변수: ANTHROPIC_API_KEY
//   - 선택 환경변수: ELEVENLABS_API_KEY (있으면 자연스러운 사람 음성으로 답변),
//                    ELEVENLABS_VOICE_ID (특정 목소리 지정; 없으면 계정 첫 목소리 사용)

// 모델 — claude-sonnet-4-6(똑똑함) / claude-haiku-4-5(저렴·빠름) / claude-opus-4-7(최상)
const MODEL = 'claude-sonnet-4-6';

// CORS 허용 출처
const ALLOWED_ORIGINS = [
  'https://kgm-seongsu.co.kr',
  'https://www.kgm-seongsu.co.kr',
  'https://un910315-cyber.github.io',
];

// 성수동 좌표 (Open-Meteo 날씨 조회용)
const LAT = 37.5446;
const LON = 127.0560;

// 자비스 페르소나 — 정적(매 요청 동일) → 프롬프트 캐싱 대상
const SYSTEM_PROMPT = [
  "당신은 'KGM 성수서비스센터'의 음성 비서 '자비스'입니다. 정비소 대표님을 보좌합니다.",
  '',
  '말투와 형식:',
  '- 항상 한국어 존댓말로, 짧고 명확하게 답하세요.',
  '- 답변은 음성으로 읽히므로 보통 2~4문장 이내로 간결하게 합니다.',
  '- 이모지, 마크다운 기호(*, #, - 등), 표는 절대 쓰지 마세요. 음성으로 읽기 때문입니다.',
  '- 금액은 "삼십이만 원"처럼 또는 "32만 원"처럼 자연스럽게 읽히도록 표현하세요.',
  '',
  '답변 근거:',
  '- 정비소 관련 질문(차량 현황, 매출, 연차, 블랙리스트 등)은 사용자 메시지의 [정비소 현황]만 근거로 답하세요.',
  '- 데이터에 없는 내용은 추측하지 말고 "그 정보는 아직 없습니다"라고 솔직히 답하세요. 숫자를 지어내지 마세요.',
  '- 날씨 정보가 함께 주어지면 그 값을 사용해 답하세요.',
  '- 일반 상식이나 잡담 질문에는 비서답게 친절히 도와드리세요.',
  '- 대표님을 "대표님"이라고 부르세요.',
  '',
  '음성 인식 대응 (중요):',
  '- 질문은 음성을 받아쓴 것이라 부정확할 수 있습니다. 특히 차량번호가 자주 틀립니다.',
  '- 차량번호 숫자는 한국어 말로 인식될 수 있습니다 — 한자어 숫자(일이삼사오육칠팔구), 고유어 숫자(하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉), 자릿수(십·백·천)가 섞여 들어옵니다. 예: "백이십이러 팔오오하나"=122러8551, "이십오보 칠팔팔구"=25보7889. 모두 아라비아 숫자로 바꿔 [정비소 현황]의 차량번호와 매칭하세요.',
  '- [음성 인식 후보]가 주어지면, 그 후보들 중 [정비소 현황]의 차량번호·차종에 가장 잘 맞는 것을 골라 해석하세요.',
  '- 인식이 조금 어긋나도, [정비소 현황]에 비슷한 차량번호가 하나뿐이면 그 차량으로 간주하고 답하세요.',
  '- 못 알아들었을 때 "못 알아들었어요"라고만 하지 마세요. 데이터에서 비슷한 차량을 찾아 "혹시 122러8551 차량 말씀이신가요?"처럼 구체적으로 되물으세요.',
].join('\n');

// Open-Meteo weather_code → 한국어
const WEATHER_CODES = {
  0: '맑음', 1: '대체로 맑음', 2: '구름 조금', 3: '흐림',
  45: '안개', 48: '서리 안개',
  51: '약한 이슬비', 53: '이슬비', 55: '강한 이슬비',
  56: '어는 이슬비', 57: '강한 어는 이슬비',
  61: '약한 비', 63: '비', 65: '강한 비',
  66: '어는 비', 67: '강한 어는 비',
  71: '약한 눈', 73: '눈', 75: '강한 눈', 77: '싸락눈',
  80: '소나기', 81: '소나기', 82: '강한 소나기',
  85: '약한 눈소나기', 86: '강한 눈소나기',
  95: '천둥번개', 96: '천둥번개와 우박', 99: '강한 천둥번개와 우박',
};

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function round(n) {
  return (typeof n === 'number' && isFinite(n)) ? Math.round(n) : '?';
}

// 환경변수 읽기 — Cloudflare(env 인자) / Deno Deploy(Deno.env) 양쪽 지원
function getEnv(env, name) {
  if (env && env[name]) return env[name];
  if (typeof Deno !== 'undefined' && Deno.env) {
    try { return Deno.env.get(name); } catch (e) {}
  }
  return null;
}
function getApiKey(env) { return getEnv(env, 'ANTHROPIC_API_KEY'); }

// ── ElevenLabs 음성 합성 (선택) ──
// ELEVENLABS_API_KEY 환경변수가 있으면 답변을 자연스러운 사람 음성으로 변환.
// 없으면 audio 없이 텍스트만 반환 → 자비스가 폰 기본 음성으로 읽음.
let cachedVoiceId = null;
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
// { audio, error } 반환 — error는 진단용 짧은 코드
async function synthVoice(text, env) {
  const key = getEnv(env, 'ELEVENLABS_API_KEY');
  if (!key) return { audio: null, error: 'no-key' };
  try {
    let voiceId = getEnv(env, 'ELEVENLABS_VOICE_ID') || cachedVoiceId;
    if (!voiceId) {
      const vr = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
      if (!vr.ok) {
        const vdet = (await vr.text()).slice(0, 220);
        return { audio: null, error: 'voices-' + vr.status + ' ' + vdet };
      }
      const vd = await vr.json();
      const v = (vd.voices || [])[0];
      if (!v) return { audio: null, error: 'voices-empty' };
      voiceId = cachedVoiceId = v.voice_id;
    }
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!r.ok) {
      const det = (await r.text()).slice(0, 140);
      return { audio: null, error: 'tts-' + r.status + ':' + det };
    }
    const buf = await r.arrayBuffer();
    return { audio: 'data:audio/mpeg;base64,' + bufToBase64(buf), error: null };
  } catch (e) {
    return { audio: null, error: 'exception:' + (e && e.message ? e.message : 'unknown') };
  }
}

async function getWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + LAT + '&longitude=' + LON
    + '&current=temperature_2m,apparent_temperature,weather_code'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=Asia%2FSeoul&forecast_days=1';
  const r = await fetch(url);
  if (!r.ok) return '';
  const d = await r.json();
  const c = d.current || {};
  const day = d.daily || {};
  const desc = WEATHER_CODES[c.weather_code] || '';
  const hi = (day.temperature_2m_max || [])[0];
  const lo = (day.temperature_2m_min || [])[0];
  const pop = (day.precipitation_probability_max || [])[0];
  return '[오늘 성수동 날씨] ' + desc
    + ', 현재 ' + round(c.temperature_2m) + '도'
    + '(체감 ' + round(c.apparent_temperature) + '도)'
    + ', 최고 ' + round(hi) + '도 / 최저 ' + round(lo) + '도'
    + ', 강수확률 ' + (pop == null ? '?' : pop) + '%.';
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, origin);
    }
    const apiKey = getApiKey(env);
    if (!apiKey) {
      return json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' }, 500, origin);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'invalid json' }, 400, origin); }

    const question = String(body.question || '').trim().slice(0, 1000);
    const context = String(body.context || '').slice(0, 200000);
    const alternatives = Array.isArray(body.alternatives)
      ? body.alternatives.slice(0, 6).map((a) => String(a).slice(0, 200)).filter((a) => a)
      : [];
    if (!question) return json({ error: 'no question' }, 400, origin);

    // 날씨 관련 질문이면 Open-Meteo 조회
    let weather = '';
    if (/날씨|기온|비\s|비가|비\?|눈\s|눈이|더운|더워|추운|추워|따뜻|쌀쌀|우산|미세먼지/.test(question)) {
      try { weather = await getWeather(); } catch (e) { weather = ''; }
    }

    const userContent =
      '[정비소 현황]\n' + (context || '(데이터 없음)')
      + (weather ? '\n\n' + weather : '')
      + '\n\n[질문]\n' + question
      + (alternatives.length > 1
        ? '\n\n[음성 인식 후보] 위 질문은 음성 인식 결과라 부정확할 수 있습니다. 같은 말의 다른 인식 후보들이니, 정비소 데이터에 가장 잘 맞는 것으로 해석하세요:\n'
          + alternatives.map((a, i) => (i + 1) + ') ' + a).join('\n')
        : '');

    const payload = {
      model: MODEL,
      max_tokens: 1024,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userContent }],
    };

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return json({ error: 'Claude 서버에 연결하지 못했습니다.' }, 502, origin);
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return json({ error: 'Claude 오류 (' + res.status + ')', detail }, 502, origin);
    }

    const data = await res.json();
    const answer = (data.content || [])
      .filter((b) => b && b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const finalAnswer = answer || '죄송해요 대표님, 답을 만들지 못했어요.';

    // 자연스러운 음성으로 변환 (ELEVENLABS_API_KEY 가 있을 때만; 실패해도 텍스트는 반환)
    let audio = null, ttsError = null;
    try {
      const t = await synthVoice(finalAnswer, env);
      audio = t.audio; ttsError = t.error;
    } catch (e) { ttsError = 'wrap'; }

    return json({ answer: finalAnswer, audio: audio, ttsError: ttsError }, 200, origin);
  },
};
