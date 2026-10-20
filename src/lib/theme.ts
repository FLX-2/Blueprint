export const THEME_STORAGE_KEY = "bp-theme";
export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Runs in <head> before first paint so a saved light/system theme never
 * flashes dark. Kept as a string because it is inlined, not bundled.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"||t==="system")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
