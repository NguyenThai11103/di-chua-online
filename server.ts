import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createClient } from 'redis';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

interface ChatMessage {
  id: string;
  name: string;
  text: string;
  createdAt: number;
}

interface VisitorPresence {
  id: string;
  name: string;
  lastSeen: number;
  x?: number;
  y?: number;
}

interface TempleAction {
  id: string;
  visitorId: string;
  name: string;
  kind: 'prayer' | 'offering' | 'reaction';
  choice?: 'incense' | 'lotus' | 'candle';
  reaction?: '🙏' | '👋' | '🪷' | '❤️';
  text?: string;
  createdAt: number;
}

type RedisClient = ReturnType<typeof createClient>;

const INSTANCE_ID = randomUUID();
const EVENT_CHANNEL = 'temple:events';
const CHAT_MESSAGES_KEY = 'temple:chat:messages';
const PRESENCE_KEY = 'temple:presence';
const PRESENCE_NAMES_KEY = 'temple:presence:names';
const PRESENCE_POSITIONS_KEY = 'temple:presence:positions';
const PRESENCE_TTL_MS = 45_000;

const localMessages: ChatMessage[] = [];
const localVisitors = new Map<string, VisitorPresence>();
const localRateLimit = new Map<string, number[]>();
const eventClients = new Set<express.Response>();

let redisPromise: Promise<RedisClient> | null = null;
let subscriberPromise: Promise<RedisClient> | null = null;

const getRedis = (): Promise<RedisClient> | null => {
  if (!process.env.REDIS_URL) return null;
  if (!redisPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (error) => console.error('Redis error:', error));
    redisPromise = client.connect().then(() => client);
  }
  return redisPromise;
};

const cleanText = (value: unknown, maxLength: number) =>
  String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const broadcastLocal = (event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  eventClients.forEach((client) => client.write(payload));
};

const ensureSubscriber = async () => {
  const clientPromise = getRedis();
  if (!clientPromise || subscriberPromise) return subscriberPromise;
  subscriberPromise = clientPromise.then(async (client) => {
    const subscriber = client.duplicate();
    subscriber.on('error', (error) => console.error('Redis subscriber error:', error));
    await subscriber.connect();
    await subscriber.subscribe(EVENT_CHANNEL, (raw) => {
      try {
        const payload = JSON.parse(raw) as { origin?: string; event?: string; data?: unknown };
        if (payload.origin !== INSTANCE_ID && payload.event) broadcastLocal(payload.event, payload.data);
      } catch (error) {
        console.warn('Ignored malformed Redis event:', error);
      }
    });
    return subscriber;
  });
  return subscriberPromise;
};

const publishEvent = async (event: string, data: unknown) => {
  broadcastLocal(event, data);
  const redis = await getRedis();
  if (redis) await redis.publish(EVENT_CHANNEL, JSON.stringify({ origin: INSTANCE_ID, event, data }));
};

const readMessages = async (): Promise<ChatMessage[]> => {
  const redis = await getRedis();
  if (!redis) return localMessages;
  const rows = await redis.lRange(CHAT_MESSAGES_KEY, 0, -1);
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row) as ChatMessage];
    } catch {
      return [];
    }
  });
};

const saveMessage = async (message: ChatMessage) => {
  const redis = await getRedis();
  if (!redis) {
    localMessages.push(message);
    if (localMessages.length > 100) localMessages.shift();
    return;
  }
  await redis.rPush(CHAT_MESSAGES_KEY, JSON.stringify(message));
  await redis.lTrim(CHAT_MESSAGES_KEY, -100, -1);
};

const checkRateLimit = async (ip: string) => {
  const redis = await getRedis();
  if (!redis) {
    const now = Date.now();
    const recent = (localRateLimit.get(ip) ?? []).filter((timestamp) => now - timestamp < 60_000);
    if (recent.length >= 12) return false;
    recent.push(now);
    localRateLimit.set(ip, recent);
    return true;
  }
  const key = `temple:chat:rate:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= 12;
};

const readOnlineVisitors = async (): Promise<{
  visitors: Array<{ id: string; name: string; x?: number; y?: number }>;
  removed: boolean;
}> => {
  const redis = await getRedis();
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  if (!redis) {
    let removed = false;
    localVisitors.forEach((visitor, id) => {
      if (visitor.lastSeen < cutoff) {
        localVisitors.delete(id);
        removed = true;
      }
    });
    return {
      visitors: [...localVisitors.values()].map(({ id, name, x, y }) => ({ id, name, x, y })),
      removed,
    };
  }

  const expired = await redis.zRangeByScore(PRESENCE_KEY, 0, cutoff);
  if (expired.length) {
    await redis.zRem(PRESENCE_KEY, expired);
    await redis.hDel(PRESENCE_NAMES_KEY, expired);
    await redis.hDel(PRESENCE_POSITIONS_KEY, expired);
  }
  const ids = await redis.zRangeByScore(PRESENCE_KEY, cutoff + 1, '+inf');
  const names = ids.length ? await redis.hmGet(PRESENCE_NAMES_KEY, ids) : [];
  const positions = ids.length ? await redis.hmGet(PRESENCE_POSITIONS_KEY, ids) : [];
  return {
    visitors: ids.map((id, index) => {
      let position: { x?: number; y?: number } = {};
      try {
        position = positions[index] ? JSON.parse(positions[index]!) : {};
      } catch {
        position = {};
      }
      return { id, name: names[index] || 'Người hữu duyên', ...position };
    }),
    removed: expired.length > 0,
  };
};

const publishPresence = async () => {
  const { visitors } = await readOnlineVisitors();
  await publishEvent('presence', { visitors });
  return visitors;
};

app.get('/api/chat/messages', async (_req, res) => res.json({ messages: await readMessages() }));

app.get('/api/chat/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  eventClients.add(res);
  await ensureSubscriber();
  const { visitors } = await readOnlineVisitors();
  res.write(': connected\n\n');
  res.write(`event: presence\ndata: ${JSON.stringify({ visitors })}\n\n`);

  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 20_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    eventClients.delete(res);
  });
});

app.post('/api/visitors/join', async (req, res) => {
  const id = cleanText(req.body?.id, 64);
  const name = cleanText(req.body?.name, 36);
  if (!id || !name) return res.status(400).json({ error: 'Thiếu thông tin người tham gia.' });
  const redis = await getRedis();
  if (redis) {
    await redis.zAdd(PRESENCE_KEY, { score: Date.now(), value: id });
    await redis.hSet(PRESENCE_NAMES_KEY, id, name);
  } else {
    localVisitors.set(id, { ...localVisitors.get(id), id, name, lastSeen: Date.now() });
  }
  return res.json({ visitors: await publishPresence() });
});

app.post('/api/visitors/heartbeat', async (req, res) => {
  const id = cleanText(req.body?.id, 64);
  const name = cleanText(req.body?.name, 36);
  const redis = await getRedis();
  if (redis) {
    if (id) {
      await redis.zAdd(PRESENCE_KEY, { score: Date.now(), value: id });
      if (name) await redis.hSet(PRESENCE_NAMES_KEY, id, name);
    }
  } else {
    const visitor = localVisitors.get(id);
    if (visitor) Object.assign(visitor, { lastSeen: Date.now(), name: name || visitor.name });
  }
  const online = await readOnlineVisitors();
  if (online.removed) await publishEvent('presence', { visitors: online.visitors });
  return res.status(204).end();
});

app.post('/api/visitors/move', async (req, res) => {
  const id = cleanText(req.body?.id, 64);
  const x = Math.min(88, Math.max(12, Number(req.body?.x)));
  const y = Math.min(96, Math.max(68, Number(req.body?.y)));
  if (!id || !Number.isFinite(x) || !Number.isFinite(y)) {
    return res.status(400).json({ error: 'Tọa độ di chuyển không hợp lệ.' });
  }
  const redis = await getRedis();
  if (redis) {
    const movement = { id, x, y };
    broadcastLocal('movement', movement);
    await redis
      .multi()
      .zAdd(PRESENCE_KEY, { score: Date.now(), value: id })
      .hSet(PRESENCE_POSITIONS_KEY, id, JSON.stringify({ x, y }))
      .publish(EVENT_CHANNEL, JSON.stringify({ origin: INSTANCE_ID, event: 'movement', data: movement }))
      .exec();
  } else {
    const visitor = localVisitors.get(id);
    if (visitor) Object.assign(visitor, { x, y, lastSeen: Date.now() });
    broadcastLocal('movement', { id, x, y });
  }
  return res.status(204).end();
});

app.post('/api/visitors/leave', async (req, res) => {
  const id = cleanText(req.body?.id, 64);
  const redis = await getRedis();
  if (redis) {
    if (id) {
      await redis.zRem(PRESENCE_KEY, id);
      await redis.hDel(PRESENCE_NAMES_KEY, id);
      await redis.hDel(PRESENCE_POSITIONS_KEY, id);
    }
  } else if (id) {
    localVisitors.delete(id);
  }
  await publishPresence();
  return res.status(204).end();
});

app.post('/api/chat/messages', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!(await checkRateLimit(ip))) {
    return res.status(429).json({ error: 'Bạn gửi hơi nhanh. Vui lòng chờ một chút.' });
  }
  const name = cleanText(req.body?.name, 36) || 'Người hữu duyên';
  const text = cleanText(req.body?.text, 300);
  if (!text) return res.status(400).json({ error: 'Tin nhắn không được để trống.' });
  const message: ChatMessage = { id: randomUUID(), name, text, createdAt: Date.now() };
  await saveMessage(message);
  await publishEvent('message', message);
  return res.status(201).json({ message });
});

app.post('/api/temple/actions', async (req, res) => {
  const id = cleanText(req.body?.id, 64);
  const visitorId = cleanText(req.body?.visitorId, 64);
  const name = cleanText(req.body?.name, 36);
  const kind = cleanText(req.body?.kind, 16);
  const choice = cleanText(req.body?.choice, 16);
  const reaction = cleanText(req.body?.reaction, 8);
  const text = cleanText(req.body?.text, 180);
  if (!id || !visitorId || !name || !['prayer', 'offering', 'reaction'].includes(kind)) {
    return res.status(400).json({ error: 'Tương tác không hợp lệ.' });
  }
  if (kind === 'offering' && !['incense', 'lotus', 'candle'].includes(choice)) {
    return res.status(400).json({ error: 'Nghi thức không hợp lệ.' });
  }
  if (kind === 'reaction' && !['🙏', '👋', '🪷', '❤️'].includes(reaction)) {
    return res.status(400).json({ error: 'Biểu tượng tương tác không hợp lệ.' });
  }
  const action: TempleAction = {
    id,
    visitorId,
    name,
    kind: kind as TempleAction['kind'],
    choice: kind === 'offering' ? (choice as TempleAction['choice']) : undefined,
    reaction: kind === 'reaction' ? (reaction as TempleAction['reaction']) : undefined,
    text: kind === 'prayer' ? text : undefined,
    createdAt: Date.now(),
  };
  await publishEvent('temple-action', action);
  return res.status(202).json({ action });
});

function splitTtsText(text: string, max = 190): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    let cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
    if (cut < max / 2) cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '));
    if (cut < max / 2) cut = window.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

const TTS_VOICE = 'vi-VN-NamMinhNeural';
const TTS_PITCH = '-4%';
const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function edgeTts(text: string, rate: number): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), {
      rate: `${Math.round((rate - 1) * 100)}%`,
      pitch: TTS_PITCH,
    });
    const chunks: Buffer[] = [];
    const read = (async () => {
      for await (const chunk of audioStream) chunks.push(chunk as Buffer);
    })();
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Edge TTS timeout')), 20_000)
    );
    await Promise.race([read, timeout]);
    if (chunks.length === 0) throw new Error('Edge TTS returned no audio');
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

async function googleTts(text: string): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (const chunk of splitTtsText(text)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    });
    if (!response.ok) throw new Error(`TTS upstream error: ${response.status}`);
    parts.push(Buffer.from(await response.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

const ttsCache = new Map<string, Buffer>();

app.get('/api/tts', async (req, res) => {
  try {
    const text = ((req.query.text as string) || '').trim().slice(0, 1500);
    if (!text) return res.status(400).send('Missing text parameter');
    const rate = Math.min(1.5, Math.max(0.5, Number(req.query.rate) || 1));
    const cacheKey = `${rate}|${text}`;
    let audio = ttsCache.get(cacheKey);
    if (!audio) {
      try {
        audio = await edgeTts(text, rate);
      } catch (error) {
        console.warn('Edge TTS failed, falling back to Google:', error instanceof Error ? error.message : error);
        audio = await googleTts(text);
      }
      ttsCache.set(cacheKey, audio);
      if (ttsCache.size > 200) ttsCache.delete(ttsCache.keys().next().value!);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(audio);
  } catch (error) {
    console.error('TTS error:', error);
    return res.status(500).json({ error: 'TTS failed' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Đi Chùa Online đang chạy tại http://localhost:${PORT}`));
}

if (process.env.VERCEL !== '1') startServer();

export default app;
