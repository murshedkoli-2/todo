/**
 * Applies the stored theme before first paint so there is no flash of the
 * wrong palette. Light is the default; only an explicit `dark` opts out.
 *
 * Lives in its own module because `middleware.ts` hashes this exact string for
 * the CSP `script-src`. The two must stay byte-identical — any edit here
 * changes the hash automatically, which is the point of sharing the constant
 * rather than duplicating the source.
 *
 * A hash rather than a nonce, because React re-renders this element during
 * hydration and browsers blank the `nonce` content attribute once CSP has been
 * applied, so a nonce prop always mismatches between server and client.
 */
export const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');" +
  "document.documentElement.classList.toggle('light',t!=='dark')}" +
  "catch(e){document.documentElement.classList.add('light')}})();";
