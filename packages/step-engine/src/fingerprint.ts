import type { TargetFingerprint } from "@webjourney/journey-schema";

/**
 * Generates a resilient, multi-heuristic TargetFingerprint from a DOM Element.
 * Prioritizes stable attributes, accessible roles, and unique IDs while avoiding fragile auto-generated selectors.
 */
export function generateTargetFingerprint(el: HTMLElement): TargetFingerprint {
  const tagName = el.tagName.toLowerCase();
  const candidates: string[] = [];

  // 1. Data-testid / data-qa
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-qa") || el.getAttribute("data-cy");
  if (testId) {
    candidates.push(`[data-testid="${testId}"]`);
  }

  // 2. Unique ID (must not look like a random machine-generated hash)
  if (el.id && !el.id.match(/\d{5,}|[a-f0-9]{8}-[a-f0-9]{4}/i)) {
    candidates.push(`#${el.id}`);
  }

  // 3. Name or Form attributes
  const name = el.getAttribute("name");
  if (name) {
    candidates.push(`${tagName}[name="${name}"]`);
  }

  // 4. Accessible attributes
  const role = el.getAttribute("role");
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    candidates.push(`[aria-label="${ariaLabel}"]`);
  }
  if (role && ariaLabel) {
    candidates.push(`[role="${role}"][aria-label="${ariaLabel}"]`);
  }

  // 5. Meaningful CSS classes (filtering out utility or state classes)
  if (typeof el.className === "string" && el.className.trim()) {
    const validClasses = el.className
      .trim()
      .split(/\s+/)
      .filter((c) => !c.match(/^(active|hover|focus|selected|disabled|open|wj-)/i) && c.length > 2);
    if (validClasses.length > 0) {
      candidates.push(`${tagName}.${validClasses.slice(0, 2).join(".")}`);
    }
  }

  // 6. Generic tag fallback
  if (candidates.length === 0) {
    candidates.push(tagName);
  }

  // Safe text snippet (redact if password or input)
  let textContentSnippet: string | undefined;
  if (tagName !== "input" && tagName !== "textarea") {
    const rawText = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (rawText.length > 0) {
      textContentSnippet = rawText.slice(0, 60);
    }
  }

  return {
    selectorCandidates: Array.from(new Set(candidates)),
    tagName,
    role: role || undefined,
    accessibleLabel: ariaLabel || undefined,
    textContentSnippet,
    testId: testId || undefined
  };
}

/**
 * Resolves a TargetFingerprint against a Document, trying candidates in priority order.
 */
export function resolveTargetElement(
  fingerprint: TargetFingerprint,
  doc: Document = document
): { element: Element | null; matchedCandidate?: string; ambiguityCount: number } {
  for (const candidate of fingerprint.selectorCandidates) {
    try {
      const matches = doc.querySelectorAll(candidate);
      if (matches.length === 1) {
        return { element: matches[0], matchedCandidate: candidate, ambiguityCount: 1 };
      }
      if (matches.length > 1) {
        // Candidate is ambiguous, but keep checking if a more specific one exists
        return { element: matches[0], matchedCandidate: candidate, ambiguityCount: matches.length };
      }
    } catch {
      // Invalid selector syntax in candidate, skip
      continue;
    }
  }

  return { element: null, ambiguityCount: 0 };
}
