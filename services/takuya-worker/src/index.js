const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY = 12;
const MAX_CONTEXT = 6;

const normalize = (value = '') =>
  String(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');

function bigrams(value) {
  const text = normalize(value);
  if (text.length < 2) return text ? [text] : [];
  return Array.from({ length: text.length - 1 }, (_, i) => text.slice(i, i + 2));
}

function searchKnowledge(query, entries) {
  const q = normalize(query);
  const qgrams = new Set(bigrams(query));
  return entries.map((entry) => {
    const title = normalize(entry.title);
    const aliases = (entry.aliases || []).map(normalize);
    const body = normalize(entry.text);
    let score = 0;
    if (title === q || aliases.includes(q)) score += 140;
    if (title.includes(q) || aliases.some((a) => a.includes(q))) score += 90;
    if (q.includes(title) && title.length > 1) score += 55;
    if (body.includes(q) && q.length > 1) score += 50;
    const grams = new Set(bigrams([entry.title, ...(entry.aliases || []), entry.text].join(' ')));
    let overlap = 0;
    for (const gram of qgrams) if (grams.has(gram)) overlap += 1;
    score += Math.min(45, overlap * 3);
    if (entry.type === 'update' && /(最新|更新|アップデート|変更)/.test(query)) score += 35;
    return { entry, score };
  }).filter((x) => x.score >= 9).sort((a, b) => b.score - a.score).slice(0, MAX_CONTEXT).map((x) => x.entry);
}

function cors(origin, allowedOrigin) {
  const allowed = origin === allowedOrigin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

function outputText(response) {
  const chunks = [];
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part.type === 'output_text' && part.text) chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

function contextText(entries) {
  return entries.map((entry, index) => {
    const status = entry.status ? JSON.stringify(entry.status) : '{}';
    return `[${index + 1}] ${entry.title}\n種別: ${entry.type}\n状態: ${status}\nURL: ${entry.url}\n${entry.text}`;
  }).join('\n\n');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin, env.ALLOWED_ORIGIN || 'https://o0okayuzz.github.io');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, name: '拓也', model: env.MODEL || 'gpt-6-luna' }, 200, headers);
    if (url.pathname !== '/chat' || request.method !== 'POST') return json({ error: 'not_found' }, 404, headers);
    if (!env.OPENAI_API_KEY) return json({ error: 'not_configured' }, 503, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, headers); }
    const message = String(body.message || '').trim();
    const sessionId = String(body.sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!message || message.length > MAX_MESSAGE_LENGTH) return json({ error: 'invalid_message' }, 400, headers);
    if (!sessionId) return json({ error: 'invalid_session' }, 400, headers);

    if (env.TAKUYA_RATE_LIMITER) {
      const { success } = await env.TAKUYA_RATE_LIMITER.limit({ key: sessionId });
      if (!success) return json({ error: 'rate_limited' }, 429, headers);
    }

    let knowledge;
    try {
      const response = await fetch(env.KNOWLEDGE_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
      if (!response.ok) throw new Error(`knowledge ${response.status}`);
      knowledge = await response.json();
    } catch {
      return json({ error: 'knowledge_unavailable' }, 503, headers);
    }

    const matches = searchKnowledge(message, Array.isArray(knowledge.entries) ? knowledge.entries : []);
    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY)
      .filter((x) => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
      .map((x) => ({ role: x.role, content: x.content.slice(0, 1500) })) : [];

    const instructions = `あなたの名前は「拓也」です。Minecraft Bedrockのコミュニティサーバー「PINE SERVER（ピネ鯖）」の案内役です。
提供された「ピネ鯖の公開資料」を最優先し、一般的なMinecraft仕様とピネ鯖独自仕様を混同しないでください。
資料にない事実を推測で断定しないでください。確認できない場合は「現在のピネWebの情報では確認できない」と短く伝えてください。
implementation/deployment/verification等の状態があれば、実装済み・計画中・未確認を区別してください。
回答は日本語で、まず結論を短く、その後必要な補足だけを書いてください。資料番号や内部JSONは本文に出さないでください。人格は親しみやすいが、過剰なキャラ口調にはしません。`;

    const input = [
      ...history,
      {
        role: 'user',
        content: `質問:\n${message}\n\nピネ鯖の公開資料:\n${matches.length ? contextText(matches) : '関連資料は見つかりませんでした。'}`,
      },
    ];

    let apiResponse;
    try {
      apiResponse = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.MODEL || 'gpt-6-luna',
          reasoning: { effort: 'none' },
          instructions,
          input,
          max_output_tokens: 600,
          store: false,
        }),
      });
    } catch {
      return json({ error: 'model_unavailable' }, 502, headers);
    }

    if (!apiResponse.ok) {
      console.error('OpenAI error', apiResponse.status, await apiResponse.text());
      return json({ error: 'model_error' }, 502, headers);
    }

    const result = await apiResponse.json();
    const answer = outputText(result);
    if (!answer) return json({ error: 'empty_response' }, 502, headers);

    return json({
      answer,
      sources: matches.slice(0, 4).map((entry) => ({ title: entry.title, url: entry.url, type: entry.type })),
      knowledgeVersion: knowledge.sourceCommits || null,
      model: env.MODEL || 'gpt-6-luna',
    }, 200, headers);
  },
};
