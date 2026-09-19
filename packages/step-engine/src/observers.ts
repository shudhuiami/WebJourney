import type { UrlMatcher } from "@webjourney/journey-schema";

export type ObserverCleanup = () => void;

/**
 * Observes a click on a target element. Advances only on trusted user interaction.
 */
export function observeTargetClick(
  targetEl: Element,
  onComplete: () => void
): ObserverCleanup {
  const handler = (e: Event) => {
    // Only advance if it's a trusted user-initiated event
    if (e.isTrusted) {
      onComplete();
    }
  };

  targetEl.addEventListener("click", handler, { capture: true, once: true });
  return () => {
    targetEl.removeEventListener("click", handler, { capture: true });
  };
}

/**
 * Observes completion of an input field without capturing or transmitting typed content.
 * Advances when the field is blurred or committed with non-empty content.
 */
export function observeFieldCompletion(
  targetEl: Element,
  onComplete: () => void
): ObserverCleanup {
  const inputEl = targetEl as HTMLInputElement | HTMLTextAreaElement;
  let isNonEmpty = false;

  const inputHandler = () => {
    // Check presence of value without storing or transmitting it
    isNonEmpty = (inputEl.value || "").trim().length > 0;
  };

  const blurHandler = () => {
    if (isNonEmpty) {
      onComplete();
    }
  };

  const changeHandler = () => {
    if ((inputEl.value || "").trim().length > 0) {
      onComplete();
    }
  };

  inputEl.addEventListener("input", inputHandler);
  inputEl.addEventListener("blur", blurHandler);
  inputEl.addEventListener("change", changeHandler);

  return () => {
    inputEl.removeEventListener("input", inputHandler);
    inputEl.removeEventListener("blur", blurHandler);
    inputEl.removeEventListener("change", changeHandler);
  };
}

/**
 * Observes navigation transitions (hashchange, popstate, or URL changes).
 */
export function observeUrlNavigation(
  matcher: UrlMatcher,
  onComplete: () => void
): ObserverCleanup {
  const checkCurrentUrl = () => {
    const currentHref = window.location.href;
    const currentOrigin = window.location.origin;

    if (matcher.origin && currentOrigin !== matcher.origin) {
      return false;
    }

    if (matcher.path && !window.location.pathname.includes(matcher.path) && !window.location.hash.includes(matcher.path)) {
      return false;
    }

    if (matcher.pattern && !currentHref.includes(matcher.pattern)) {
      return false;
    }

    return true;
  };

  if (checkCurrentUrl()) {
    onComplete();
    return () => {};
  }

  const navListener = () => {
    if (checkCurrentUrl()) {
      onComplete();
    }
  };

  window.addEventListener("popstate", navListener);
  window.addEventListener("hashchange", navListener);

  return () => {
    window.removeEventListener("popstate", navListener);
    window.removeEventListener("hashchange", navListener);
  };
}
