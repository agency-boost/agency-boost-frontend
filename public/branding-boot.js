/*
 * The KPM's colours before the first paint (P19.6-T1 AC-12; ADR-0218 §8): what this browser last applied, read from
 * `localStorage` and set on <html> before the body paints, so a reload never shows AgencyBoost's orange first. A
 * same-origin file loaded by a blocking <script src> in <head>: no inline script. It decides nothing — the API derived
 * every colour — and checks every name against the fixed list below (`lib/branding.ts`'s PALETTE_VARS, pinned equal by
 * `lib/branding.spec.ts`) and every value as #rrggbb. The sign-in, registration, invitation, password and
 * verification pages take the link's KPM or AgencyBoost's, so it does nothing there. The shell writes the cache after
 * each session read and removes it on *Keluar*.
 */
(function () {
  var VARS = {
    primary: '--color-primary', primaryHover: '--color-primary-hover', primaryContrast: '--color-primary-contrast',
    primaryInk: '--color-primary-ink', primaryDeep: '--color-primary-deep', primaryOnSecondary: '--color-primary-on-secondary',
    primary50: '--color-primary-50', primary100: '--color-primary-100', focusRing: '--color-focus-ring',
    secondary: '--color-secondary', secondaryHover: '--color-secondary-hover', secondaryContrast: '--color-secondary-contrast',
    secondaryInk: '--color-secondary-ink', secondaryMuted: '--color-secondary-muted', secondary50: '--color-secondary-50',
    secondary100: '--color-secondary-100', today: '--color-today', todayInk: '--color-today-ink',
    sidebarText: '--color-sidebar-text'
  };
  var PUBLIC = /^\/(login|register|join|forgot-password|reset-password|verify-email|verify-email-change|link-account|choose-a-password)(\/|$)/;
  try {
    if (PUBLIC.test(window.location.pathname)) return;
    var raw = window.localStorage.getItem('agencyboost.branding');
    if (!raw) return;
    var cache = JSON.parse(raw);
    var palette = cache && cache.palette;
    if (!palette || typeof palette !== 'object') return;
    var style = document.documentElement.style;
    for (var key in VARS) {
      if (!Object.prototype.hasOwnProperty.call(VARS, key)) continue;
      var value = palette[key];
      if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) style.setProperty(VARS[key], value.toLowerCase());
    }
  } catch (e) {
    // A cache that cannot be read paints AgencyBoost's defaults until the session answers.
  }
})();
