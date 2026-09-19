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
 * Matches a URL string against a pattern, supporting wildcards (*), regex strings (/pattern/flags), or substrings.
 */
export function matchesUrlPattern(pattern: string, url: string): boolean {
  if (!pattern || pattern === "*") return true;

  // Regex format: /pattern/flags
  if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
    const lastSlash = pattern.lastIndexOf("/");
    const regexBody = pattern.slice(1, lastSlash);
    const flags = pattern.slice(lastSlash + 1);
    try {
      const re = new RegExp(regexBody, flags);
      return re.test(url);
    } catch {
      // Fallback if invalid regex
    }
  }

  // Wildcard format (* to .*)
  if (pattern.includes("*")) {
    const escaped = pattern
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    try {
      const wildcardRe = new RegExp(`^${escaped}$`, "i");
      return wildcardRe.test(url);
    } catch {
      // Fallback
    }
  }

  return url.toLowerCase().includes(pattern.toLowerCase());
}

/**
 * Evaluates whether current or provided URL matches the given UrlMatcher definition.
 */
export function checkUrlMatch(
  matcher: UrlMatcher,
  currentHref: string = typeof window !== "undefined" ? window.location.href : "",
  currentOrigin: string = typeof window !== "undefined" ? window.location.origin : "",
  currentPath: string = typeof window !== "undefined" ? window.location.pathname : "",
  currentHash: string = typeof window !== "undefined" ? window.location.hash : ""
): boolean {
  if (matcher.origin && matcher.origin !== "*" && currentOrigin !== matcher.origin) {
    return false;
  }

  if (matcher.path) {
    const pathNormalized = matcher.path.startsWith("/") ? matcher.path : `/${matcher.path}`;
    const inPath = currentPath.includes(matcher.path) || currentPath.includes(pathNormalized);
    const inHash = currentHash.includes(matcher.path);
    if (!inPath && !inHash) {
      return false;
    }
  }

  if (matcher.pattern && !matchesUrlPattern(matcher.pattern, currentHref)) {
    return false;
  }

  return true;
}

/**
 * Safely listens to both traditional (popstate, hashchange) and Single Page Application
 * (pushState, replaceState) route changes across the browser window.
 */
export function listenToRouteChanges(callback: () => void): ObserverCleanup {
  if (typeof window === "undefined") {
    return () => {};
  }

  const customEventName = "webjourney:routechange";

  // Patch history.pushState and history.replaceState once per window context
  if (typeof history !== "undefined" && !(history as any).__wj_patched) {
    (history as any).__wj_patched = true;

    const origPush = history.pushState;
    history.pushState = function (...args) {
      const res = origPush.apply(this, args);
      window.dispatchEvent(new CustomEvent(customEventName));
      return res;
    };

    const origReplace = history.replaceState;
    history.replaceState = function (...args) {
      const res = origReplace.apply(this, args);
      window.dispatchEvent(new CustomEvent(customEventName));
      return res;
    };
  }

  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  window.addEventListener(customEventName, callback);

  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
    window.removeEventListener(customEventName, callback);
  };
}

/**
 * Observes navigation transitions (hashchange, popstate, pushState, or URL changes).
 * Advances immediately if URL already satisfies matcher, or registers listeners.
 */
export function observeUrlNavigation(
  matcher: UrlMatcher,
  onComplete: () => void
): ObserverCleanup {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (checkUrlMatch(matcher)) {
    onComplete();
    return () => {};
  }

  let completed = false;
  const routeCleanup = listenToRouteChanges(() => {
    if (!completed && checkUrlMatch(matcher)) {
      completed = true;
      routeCleanup();
      onComplete();
    }
  });

  return () => {
    completed = true;
    routeCleanup();
  };
}
