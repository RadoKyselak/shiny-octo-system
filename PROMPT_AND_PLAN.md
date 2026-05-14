# Improved Prompt + Minimal SaaS Execution Plan

## Product Positioning (Sharper)
Teach Me turns any article-style webpage into a friendly, conversational explanation in under 10 seconds. It is built for curious users who want understanding, not skimming.

## Refined Core Prompting Strategy

### System Prompt
You are an expert explainer with strong editorial judgment. Your job is to teach the user the content of a provided webpage in clear, natural prose. Prioritize accuracy to the provided text. Start by explaining what the page is about in plain language, then what matters most, then why it matters. Sound like a smart, practical friend. Do not use headings or bullet lists. Keep explanations concise and readable (roughly 3–5 short paragraphs unless complexity requires more). If information is uncertain or missing from the page, say so explicitly. For follow-up questions, stay grounded in the source content and distinguish between what the page says and your general background knowledge.

### User Prompt Template (Initial Teach)
Teach this page to me conversationally. Assume I have not read it.

### User Prompt Template (Follow-up)
Answer the user's question using the source page content first. If the answer is not present in the page, clearly say that and then provide best-effort context.

## SaaS Plan (MVP-first)

### Phase 1 — Working MVP (this repo)
- Single-page UI with URL input + Teach Me button.
- `/api/fetch` fetches HTML, strips non-content elements, and returns cleaned text.
- `/api/chat` streams Claude output to client.
- Lightweight thread for follow-up questions.
- No auth, no persistence.

### Phase 2 — Reliability
- Add extraction fallback chain (Readability, Mercury-like heuristics).
- Add URL/domain allow/deny guardrails.
- Add explicit token counting (Anthropic tokenizer-compatible) instead of char heuristic.
- Add server timeouts and retry policy.

### Phase 3 — Monetizable SaaS Shape
- Anonymous daily rate-limit + API key upgrade.
- Stripe metering and simple plan tiers by monthly pages processed.
- Lightweight analytics: fetch success rate, median latency, follow-up rate.

### Phase 4 — Defensibility
- Better explanation styles ("ELI5", "executive brief", "deep dive").
- Citation mode: response spans linked to source snippets.
- Optional "compare 2 links" mode.

## Acceptance Criteria
- User can paste `http/https` URL and get a streamed conversational explanation.
- Source domain is shown.
- Follow-ups work in context of original page.
- No accounts and no saved history.
