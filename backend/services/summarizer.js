// Smart Notice Summarizer — turns a long notice into a short summary, key dates,
// action items and a priority level. Uses Claude when ANTHROPIC_API_KEY is set;
// otherwise returns a safe heuristic fallback so notice creation never blocks.
const Anthropic = require('@anthropic-ai/sdk');

function heuristicFallback(title, content, category) {
  // Clean length-based truncation (avoids breaking on abbreviations like "Rs.").
  // This is only used when no AI key is configured; with a key Claude writes a real summary.
  const clean = content.replace(/\s+/g, ' ').trim();
  const summary = clean.length > 170 ? clean.slice(0, 170).replace(/\s+\S*$/, '') + '…' : clean;
  const priority = category === 'urgent' ? 'urgent'
    : /immediately|deadline|last date|mandatory|today|tomorrow|will not be|fail to/i.test(content) ? 'high'
    : category === 'exam' || category === 'fee' ? 'high' : 'medium';
  return { summary: summary.slice(0, 200) || title, keyDates: [], actionItems: [], priority };
}

async function summarizeNotice({ title, content, category = 'general' }) {
  const fallback = heuristicFallback(title, content, category);
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      system: `You summarize college notices for students. Return ONLY valid minified JSON, no prose, with this exact shape:
{"summary":"1-2 student-friendly sentences","keyDates":[{"label":"what","date":"YYYY-MM-DD"}],"actionItems":["short imperative"],"priority":"low|medium|high|urgent"}
If a date is relative or absent, omit it. Keep actionItems to at most 3.`,
      messages: [{ role: 'user', content: `Title: ${title}\nCategory: ${category}\n\n${content}` }],
    });
    const raw = r.content[0].text;
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
    return {
      summary: parsed.summary || fallback.summary,
      keyDates: Array.isArray(parsed.keyDates) ? parsed.keyDates.slice(0, 5) : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 3) : [],
      priority: ['low', 'medium', 'high', 'urgent'].includes(parsed.priority) ? parsed.priority : fallback.priority,
    };
  } catch (err) {
    console.error('Summarizer error:', err.message);
    return fallback;
  }
}

module.exports = { summarizeNotice };
