// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import {
  matchesUrlPattern,
  checkUrlMatch,
  listenToRouteChanges,
  observeUrlNavigation
} from "../observers";

describe("observers - Cross-Page URL Matching", () => {
  it("matches wildcard patterns correctly", () => {
    expect(matchesUrlPattern("*/services*", "https://codevioso.com/services/web-dev")).toBe(true);
    expect(matchesUrlPattern("*/services*", "https://codevioso.com/about")).toBe(false);
    expect(matchesUrlPattern("https://codevioso.com/*", "https://codevioso.com/contact")).toBe(true);
    expect(matchesUrlPattern("https://codevioso.com/*", "https://other.com/contact")).toBe(false);
  });

  it("matches regex patterns in /pattern/flags format", () => {
    expect(matchesUrlPattern("/services\\/[a-z-]+/i", "https://codevioso.com/services/web-app")).toBe(true);
    expect(matchesUrlPattern("/services\\/[0-9]+/i", "https://codevioso.com/services/web-app")).toBe(false);
  });

  it("checkUrlMatch validates origin, path, and pattern constraints", () => {
    const matcher = {
      origin: "https://codevioso.com",
      path: "/pricing",
      pattern: "*pricing*"
    };

    expect(
      checkUrlMatch(
        matcher,
        "https://codevioso.com/pricing",
        "https://codevioso.com",
        "/pricing",
        ""
      )
    ).toBe(true);

    // Wrong origin
    expect(
      checkUrlMatch(
        matcher,
        "https://evil.com/pricing",
        "https://evil.com",
        "/pricing",
        ""
      )
    ).toBe(false);

    // Wrong path
    expect(
      checkUrlMatch(
        matcher,
        "https://codevioso.com/blog",
        "https://codevioso.com",
        "/blog",
        ""
      )
    ).toBe(false);
  });

  it("listenToRouteChanges captures history pushState, replaceState, popstate and hashchange", () => {
    const callback = vi.fn();
    const cleanup = listenToRouteChanges(callback);

    // PushState triggers callback
    history.pushState({}, "", "/new-route-1");
    expect(callback).toHaveBeenCalled();

    // ReplaceState triggers callback
    history.replaceState({}, "", "/new-route-2");
    expect(callback).toHaveBeenCalledTimes(2);

    // Hashchange triggers callback
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(callback).toHaveBeenCalledTimes(3);

    // Cleanup unhooks listeners
    cleanup();
  });

  it("observeUrlNavigation calls onComplete when route changes to target", () => {
    const onComplete = vi.fn();
    const cleanup = observeUrlNavigation(
      { path: "/target-dashboard" },
      onComplete
    );

    // Initial state does not match
    expect(onComplete).not.toHaveBeenCalled();

    // Simulate navigation to dashboard
    history.pushState({}, "", "/target-dashboard");
    expect(onComplete).toHaveBeenCalled();

    cleanup();
  });
});
