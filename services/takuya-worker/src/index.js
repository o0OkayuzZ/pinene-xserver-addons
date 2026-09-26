const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY = 12;
const MAX_CONTEXT = 6;
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 86400000;

const normalize = (value = '') =>
  String(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');

function bigrams(value) {
  const text = normalize(value);
  if (text.length < 2) return text ? [text] : [];
  return Array.from({ length: text.length - 1 }, (_, i) => text.slice(i, i + 2));
}

export function searchKnowledge(query, entries) {
  const q = normalize(query);
  const qgrams = new Set(bigrams(query));
  const identifiers = (String(query).match(/[a-z]{1,24}[-_:]?\d{1,5}/gi) || []).map(normalize);
  const wantsRecipe = /(作り方|レシピ|クラフト|材料|どう作)/.test(query);
  const scored = entries.map((entry) => {
    const title = normalize(entry.title);
    const aliases = (entry.aliases || []).map(normalize);
    const body = normalize(entry.text);
    let score = 0;
    if (title === q || aliases.includes(q)) score += 140;
    if (title.includes(q) || aliases.some((a) => a.includes(q))) score += 90;
    if (q.includes(title) && title.length > 1) score += 55;
    if (body.includes(q) && q.length > 1) score += 50;
    if (identifiers.some((id) => title.includes(id) || aliases.some((a) => a.includes(id)) || body.includes(id))) score += 120;
    const grams = new Set(bigrams([entry.title, ...(entry.aliases || []), entry.text].join(' ')));
    let overlap = 0;
    for (const gram of qgrams) if (grams.has(gram)) overlap += 1;
    score += Math.min(45, overlap * 3);
    if (wantsRecipe && entry.type === 'recipe' && overlap >= 3) score += 90;
    if (entry.type === 'update' && /(最新|更新|アップデート|変更)/.test(query)) score += 35;
    return { entry, score };
  }).filter((x) => x.score >= 9).sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  const cutoff = Math.max(9, scored[0].score * 0.35);
  return scored.filter((x) => x.score >= cutoff).slice(0, MAX_CONTEXT).map((x) => x.entry);
}

export function isAllowedOrigin(origin, allowedOrigin) {
  return origin === allowedOrigin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
}

function cors(origin, allowedOrigin) {
  const headers = {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (isAllowedOrigin(origin, allowedOrigin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
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

export function adminAuthorized(request, env) {
  const token = String(env.TAKUYA_ADMIN_TOKEN || '');
  if (!token) return false;
  const actual = request.headers.get('Authorization') || '';
  const expected = `Bearer ${token}`;
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function hashSession(sessionId) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(sessionId)));
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function recordQuestion(env, { message, sessionId, matches = [], status }) {
  if (!env.TAKUYA_LOG_DB) return;
  const createdAt = Date.now();
  const cutoff = createdAt - RETENTION_MS;
  const sessionHash = await hashSession(sessionId);
  const sources = matches.slice(0, 3).map((entry) => ({
    id: String(entry.id || '').slice(0, 160),
    title: String(entry.title || '').slice(0, 160),
    url: String(entry.url || '').slice(0, 500),
  }));
  await env.TAKUYA_LOG_DB.batch([
    env.TAKUYA_LOG_DB.prepare('DELETE FROM takuya_questions WHERE created_at < ?').bind(cutoff),
    env.TAKUYA_LOG_DB.prepare(
      'INSERT INTO takuya_questions (created_at, message, session_hash, sources_json, status, model) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      createdAt,
      String(message).slice(0, MAX_MESSAGE_LENGTH),
      sessionHash,
      JSON.stringify(sources),
      String(status || 'received'),
      String(env.MODEL || 'gpt-6-luna')
    ),
  ]);
}

function queueQuestionLog(ctx, env, payload) {
  const task = recordQuestion(env, payload).catch((error) => {
    console.error('Takuya question log error', error?.message || String(error));
  });
  if (ctx?.waitUntil) ctx.waitUntil(task);
}

async function listQuestions(env, url) {
  if (!env.TAKUYA_LOG_DB) return { status: 'unconfigured', questions: [], retentionDays: RETENTION_DAYS, hasMore: false };
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));
  const before = Number(url.searchParams.get('before') || 0);
  const cutoff = Date.now() - RETENTION_MS;
  await env.TAKUYA_LOG_DB.prepare('DELETE FROM takuya_questions WHERE created_at < ?').bind(cutoff).run();
  const query = before > 0
    ? env.TAKUYA_LOG_DB.prepare('SELECT id, created_at, message, session_hash, sources_json, status, model FROM takuya_questions WHERE id < ? ORDER BY id DESC LIMIT ?').bind(before, limit)
    : env.TAKUYA_LOG_DB.prepare('SELECT id, created_at, message, session_hash, sources_json, status, model FROM takuya_questions ORDER BY id DESC LIMIT ?').bind(limit);
  const result = await query.all();
  const questions = (result.results || []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    message: row.message,
    session_hash: row.session_hash,
    sources: (() => { try { return JSON.parse(row.sources_json || '[]'); } catch { return []; } })(),
    status: row.status,
    model: row.model,
  }));
  return {
    status: 'ok',
    questions,
    retentionDays: RETENTION_DAYS,
    hasMore: questions.length === limit,
    nextBefore: questions.length ? questions[questions.length - 1].id : null,
  };
}

function contextText(entries) {
  return entries.map((entry, index) => {
    const status = entry.status ? JSON.stringify(entry.status) : '{}';
    return `[${index + 1}] ${entry.title}\n種別: ${entry.type}\n状態: ${status}\nURL: ${entry.url}\n${entry.text}`;
  }).join('\n\n');
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://o0okayuzz.github.io';
    const headers = cors(origin, allowedOrigin);
    const url = new URL(request.url);

    if (url.pathname === '/health') return json({ ok: true, name: '拓也', model: env.MODEL || 'gpt-6-luna' }, 200, headers);
    if (url.pathname === '/admin/questions') {
      const adminHeaders = {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      };
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, adminHeaders);
      if (!adminAuthorized(request, env)) return json({ error: 'unauthorized' }, 401, adminHeaders);
      try {
        return json(await listQuestions(env, url), 200, adminHeaders);
      } catch (error) {
        console.error('Takuya admin log read error', error?.message || String(error));
        return json({ error: 'log_unavailable' }, 503, adminHeaders);
      }
    }
    if (url.pathname !== '/chat') return json({ error: 'not_found' }, 404, headers);
    if (!isAllowedOrigin(origin, allowedOrigin)) return json({ error: 'origin_forbidden' }, 403, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);
    if (!env.OPENAI_API_KEY) return json({ error: 'not_configured' }, 503, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, headers); }
    const message = String(body.message || '').trim();
    const sessionId = String(body.sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!message || message.length > MAX_MESSAGE_LENGTH) return json({ error: 'invalid_message' }, 400, headers);
    if (!sessionId) return json({ error: 'invalid_session' }, 400, headers);

    if (env.TAKUYA_RATE_LIMITER) {
      const clientIp = request.headers.get('CF-Connecting-IP');
      const rateKey = clientIp ? `ip:${clientIp}` : `session:${sessionId}`;
      const { success } = await env.TAKUYA_RATE_LIMITER.limit({ key: rateKey });
      if (!success) return json({ error: 'rate_limited' }, 429, headers);
    }

    let knowledge;
    try {
      const response = await fetch(env.KNOWLEDGE_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
      if (!response.ok) throw new Error(`knowledge ${response.status}`);
      knowledge = await response.json();
    } catch {
      queueQuestionLog(ctx, env, { message, sessionId, status: 'knowledge_error' });
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
回答は日本語で、まず結論を短く、その後必要な補足だけを書いてください。Markdown記法（#、*、表、コードブロック等）は使わず、プレーンテキストだけで回答してください。配置を示す場合は各行を「空 / 矢 / 空」のように普通の文字で書いてください。資料番号や内部JSONは本文に出さないでください。人格は親しみやすいが、過剰なキャラ口調にはしません。`;

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
      queueQuestionLog(ctx, env, { message, sessionId, matches, status: 'model_error' });
      return json({ error: 'model_unavailable' }, 502, headers);
    }

    if (!apiResponse.ok) {
      console.error('OpenAI error', apiResponse.status, await apiResponse.text());
      queueQuestionLog(ctx, env, { message, sessionId, matches, status: 'model_error' });
      return json({ error: 'model_error' }, 502, headers);
    }

    const result = await apiResponse.json();
    const answer = outputText(result);
    if (!answer) {
      queueQuestionLog(ctx, env, { message, sessionId, matches, status: 'empty_response' });
      return json({ error: 'empty_response' }, 502, headers);
    }

    queueQuestionLog(ctx, env, { message, sessionId, matches, status: 'answered' });
    return json({
      answer,
      sources: matches.slice(0, 3).map((entry) => ({ title: entry.title, url: entry.url, type: entry.type })),
      knowledgeVersion: knowledge.sourceCommits || null,
      model: env.MODEL || 'gpt-6-luna',
    }, 200, headers);
  },
};
