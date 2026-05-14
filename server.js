import express from 'express';
import * as cheerio from 'cheerio';

const app = express();
const port = process.env.PORT || 3000;
const hfToken = process.env.HF_TOKEN;

const SYSTEM_PROMPT = `You are a brilliant, direct teacher. When given the content of a webpage, explain it to the user conversationally — what it is, what matters, and why. Write in flowing prose. No headers, no bullet points. Speak like a knowledgeable friend, not a textbook. Keep it to 3–5 paragraphs unless the content demands more. After your explanation, stay available for follow-up questions, always grounding your answers in the page content.`;

app.use(express.json({ limit: '3mb' }));
app.use(express.static('public'));

const MAX_INPUT_CHARS = 24000;

function sanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return null;
  try {
    const url = new URL(rawUrl.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractMainText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header, aside, form, iframe, svg, canvas').remove();
  $('[aria-hidden="true"], [hidden], [class*="cookie"], [id*="cookie"]').remove();
  $('[class*="ad"], [id*="ad"], [role="banner"], [role="navigation"], [role="complementary"]').remove();

  const selectors = ['article', 'main', '[role="main"]', '.content', '.article', '.post', '.entry-content'];
  let best = '';
  for (const selector of selectors) {
    const candidate = $(selector).first().text().trim();
    if (candidate.length > best.length) best = candidate;
  }
  if (best.length < 700) best = $('body').text();
  return best.replace(/\s+/g, ' ').trim();
}

function truncateToTokenBudget(text) {
  return text.length <= MAX_INPUT_CHARS ? text : `${text.slice(0, MAX_INPUT_CHARS)}…`;
}

app.post('/api/fetch', async (req, res) => {
  const safeUrl = sanitizeUrl(req.body?.url);
  if (!safeUrl) return res.status(400).json({ error: 'Invalid URL. Please provide a full http/https address.' });

  try {
    const response = await fetch(safeUrl, { redirect: 'follow', headers: { 'User-Agent': 'TeachMeApp/1.2' } });
    if (!response.ok) return res.status(400).json({ error: `Unable to fetch page (HTTP ${response.status}).` });

    const cleaned = truncateToTokenBudget(extractMainText(await response.text()));
    if (!cleaned || cleaned.length < 120) return res.status(422).json({ error: 'Could not extract enough readable text from that page.' });

    return res.json({ pageText: cleaned, domain: new URL(safeUrl).hostname, sourceUrl: safeUrl, truncated: cleaned.endsWith('…') });
  } catch {
    return res.status(500).json({ error: 'Failed to retrieve this URL. Try another page.' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { pageText, messages } = req.body ?? {};
  if (!hfToken) return res.status(500).json({ error: 'Server missing HF_TOKEN.' });
  if (typeof pageText !== 'string' || !Array.isArray(messages)) return res.status(400).json({ error: 'Request must include pageText and messages[]' });

  const history = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content }));

  const modelMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Use this page content as your primary source:\n\n${pageText}` },
    ...history
  ];

  try {
    const upstream = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${hfToken}` },
      body: JSON.stringify({
        model: 'mistralai/Mistral-7B-Instruct-v0.3',
        max_tokens: 1200,
        temperature: 0.4,
        stream: false,
        messages: modelMessages
      })
    });

    if (!upstream.ok) return res.status(502).json({ error: `Model provider error: ${(await upstream.text()).slice(0, 300)}` });

    const data = await upstream.json();
    const fullText = data?.choices?.[0]?.message?.content;
    if (!fullText || typeof fullText !== 'string') return res.status(502).json({ error: 'Model returned an empty response.' });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    const chunks = fullText.match(/.{1,40}(\s|$)/g) || [fullText];
    for (const chunk of chunks) {
      res.write(chunk);
      await new Promise((r) => setTimeout(r, 10));
    }
    res.end();
  } catch {
    return res.status(500).json({ error: 'Failed to get response from open-source model provider.' });
  }
});

app.listen(port, () => console.log(`Teach Me app running at http://localhost:${port}`));
