/**
 * Whether this server can make live AI calls. Only the presence of a key is
 * shared with the browser, never the key. The public demo runs without one,
 * so the AI features go straight to their labeled scripted examples.
 */
export function liveAiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}
