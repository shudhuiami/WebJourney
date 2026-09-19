// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { generateTargetFingerprint, resolveTargetElement } from "../fingerprint";

describe("Target Fingerprint Engine", () => {
  it("prioritizes data-testid if present", () => {
    const div = document.createElement("button");
    div.setAttribute("data-testid", "submit-action-btn");
    div.id = "btn-123";
    div.textContent = "Submit Order";

    const fingerprint = generateTargetFingerprint(div);
    expect(fingerprint.testId).toBe("submit-action-btn");
    expect(fingerprint.selectorCandidates[0]).toBe('[data-testid="submit-action-btn"]');
    expect(fingerprint.tagName).toBe("button");
    expect(fingerprint.textContentSnippet).toBe("Submit Order");
  });

  it("prioritizes aria-label and role when available", () => {
    const link = document.createElement("a");
    link.setAttribute("role", "button");
    link.setAttribute("aria-label", "Close Navigation");
    link.className = "nav-close btn-dismiss";

    const fingerprint = generateTargetFingerprint(link);
    expect(fingerprint.accessibleLabel).toBe("Close Navigation");
    expect(fingerprint.role).toBe("button");
    expect(fingerprint.selectorCandidates).toContain('[aria-label="Close Navigation"]');
  });

  it("resolves target accurately in DOM", () => {
    const testEl = document.createElement("input");
    testEl.id = "search-input";
    testEl.setAttribute("data-testid", "global-search");
    document.body.appendChild(testEl);

    const fingerprint = generateTargetFingerprint(testEl);
    const resolved = resolveTargetElement(fingerprint, document);

    expect(resolved.element).toBe(testEl);
    expect(resolved.ambiguityCount).toBe(1);

    document.body.removeChild(testEl);
  });
});
