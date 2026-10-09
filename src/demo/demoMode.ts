/**
 * DEMO MODE switch.
 *
 * Demo mode replaces the backend with an in-browser SIMULATION (src/demo/demoApi.ts): fictional sample data and
 * deterministic rules. It exists so the interface can be presented when no backend URL is reachable (for example
 * on GitHub Pages). It is never live Gemini processing and never real authentication, and the UI says so.
 *
 * Default: ON only when the build sets VITE_DEMO_MODE=true (the GitHub Pages workflow does). A visitor can
 * switch it on or off at any time; that choice is remembered for the browser tab. Normal API mode keeps using
 * VITE_API_BASE_URL unchanged.
 */
const KEY = 'sieg_demo_mode';

const read = (): string | null => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export function isDemoMode(): boolean {
  const chosen = read();
  if (chosen === 'on') return true;
  if (chosen === 'off') return false;
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

/** Switches mode and reloads, so no state from the other mode can linger in memory. */
export function setDemoMode(on: boolean): void {
  try {
    sessionStorage.setItem(KEY, on ? 'on' : 'off');
    // a session of one mode must never be reused in the other
    localStorage.removeItem('sieg_auth_token');
  } catch {
    /* storage unavailable: the page still reloads into the default mode */
  }
  window.location.reload();
}
