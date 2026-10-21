/**
 * Where the Ask bar sends what's typed: a change to the coming sessions goes
 * to Bend the week, anything else is a question for Ask. Plain matching, no
 * AI: it runs on every submit and has to be instant and predictable.
 */

const PLAN_CHANGE = [
  /\b(travel(l?ing)?|trip|away|vacation|holiday|hotel)\b/i,
  /\b(only|just) (have )?\d+\s*(min|mins|minutes)\b/i,
  /\b(short on time|no time|less time|in a rush)\b/i,
  /\b(no|without( a)?|don'?t have( a)?) (barbell|bar|rack|cables?|machines?|bench|gym)\b/i,
  /\b(swap|skip|replace|substitute|move|shorten|lighten|deload)\b.*\b(session|workout|day|week|lift|squat|bench|deadlift|press|row)/i,
  /\b(feel(ing)?|felt) (run down|sick|ill|tired|exhausted|beat up)\b/i,
  /\b(hurts?|pain|injur\w*|tweak\w*|sore)\b/i,
  /\b(next|this|coming) (few |two |three |\d )?(sessions?|workouts?|week)\b.*\b(can'?t|cannot|won'?t|need to|have to)\b/i,
];

const QUESTION = /^(why|how|what|when|which|is|are|am|was|did|do|does|has|have|show|compare|chart|plot)\b/i;

export type Intent = { kind: "adapt"; href: string } | { kind: "ask"; href: string };

export function routeIntent(text: string): Intent {
  const q = text.trim();
  if (!q) return { kind: "ask", href: "/review/ask" };
  // Questions about pain or travel in the past ("why did my squat stall after the trip?") stay with Ask.
  const asksAboutHistory = QUESTION.test(q) && !/\b(should|can|could) i\b/i.test(q);
  if (!asksAboutHistory && PLAN_CHANGE.some((r) => r.test(q))) return { kind: "adapt", href: `/plan/adapt?c=${encodeURIComponent(q)}` };
  return { kind: "ask", href: `/review/ask?q=${encodeURIComponent(q)}` };
}
