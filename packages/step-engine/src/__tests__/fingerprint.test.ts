// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { generateTargetFingerprint, resolveTargetElement, generateUniqueSelector, generateElementBreadcrumb } from "../fingerprint";

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

  it("generates unique hierarchical selector when tags are identical", () => {
    const container = document.createElement("div");
    container.id = "main-container";
    container.innerHTML = `
      <ul class="nav-list">
        <li><a href="/home">Home</a></li>
        <li><a href="/services">Services</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    `;
    const otherContainer = document.createElement("div");
    otherContainer.id = "footer-container";
    otherContainer.innerHTML = `
      <ul class="footer-list">
        <li><a href="/about">About</a></li>
        <li><a href="/privacy">Privacy</a></li>
        <li><a href="/support">Support</a></li>
      </ul>
    `;
    document.body.appendChild(container);
    document.body.appendChild(otherContainer);

    const targetLink = container.querySelectorAll("a")[1]; // Services
    const selector = generateUniqueSelector(targetLink);
    expect(selector).toContain("#main-container");
    expect(document.querySelectorAll(selector).length).toBe(1);
    expect(document.querySelector(selector)).toBe(targetLink);

    document.body.removeChild(container);
    document.body.removeChild(otherContainer);
  });

  it("generates readable element breadcrumb", () => {
    const header = document.createElement("header");
    header.id = "cv-nav";
    const nav = document.createElement("nav");
    const link = document.createElement("a");
    link.className = "cv-btn";
    link.textContent = "Get Started";

    nav.appendChild(link);
    header.appendChild(nav);
    document.body.appendChild(header);

    const breadcrumb = generateElementBreadcrumb(link);
    expect(breadcrumb).toContain("#cv-nav");
    expect(breadcrumb).toContain("nav");
    expect(breadcrumb).toContain(".cv-btn");

    document.body.removeChild(header);
  });
});
