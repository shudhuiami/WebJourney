import type { TargetFingerprint } from "@webjourney/journey-schema";

/**
 * Computes an unambiguous, unique CSS selector for any given DOM element.
 * Guarantees document.querySelectorAll(result).length === 1 wherever possible
 * by walking the DOM tree and anchoring to IDs, data-attributes, or semantic nth-of-type indices.
 */
export function generateUniqueSelector(el: HTMLElement, doc: Document = document): string {
  // 1. Direct unique data-testid / data-qa / data-cy
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-qa") || el.getAttribute("data-cy");
  if (testId) {
    const sel = `[data-testid="${testId}"]`;
    try {
      if (doc.querySelectorAll(sel).length === 1) return sel;
    } catch {
      // Continue
    }
  }

  // 2. Direct unique ID (filtering out long auto-generated hashes)
  if (el.id && !el.id.match(/\d{5,}|[a-f0-9]{8}-[a-f0-9]{4}/i)) {
    const safeId = el.id.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, "\\$1");
    const sel = `#${safeId}`;
    try {
      if (doc.querySelectorAll(sel).length === 1) return sel;
    } catch {
      // Continue
    }
  }

  // 3. Name or Form role attribute
  const name = el.getAttribute("name");
  if (name) {
    const sel = `${el.tagName.toLowerCase()}[name="${name}"]`;
    try {
      if (doc.querySelectorAll(sel).length === 1) return sel;
    } catch {
      // Continue
    }
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    const sel = `[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;
    try {
      if (doc.querySelectorAll(sel).length === 1) return sel;
    } catch {
      // Continue
    }
  }

  // 4. Build hierarchical path up to nearest landmark or unique ancestor
  let current: HTMLElement | null = el;
  const pathParts: string[] = [];

  while (current && current !== doc.body && current !== doc.documentElement) {
    const tag = current.tagName.toLowerCase();

    // If current element has a unique ID, anchor and terminate
    if (current.id && !current.id.match(/\d{5,}|[a-f0-9]{8}-[a-f0-9]{4}/i)) {
      const safeId = current.id.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, "\\$1");
      pathParts.unshift(`#${safeId}`);
      break;
    }

    // If current element has a testid, anchor and terminate
    const cTestId = current.getAttribute("data-testid");
    if (cTestId) {
      pathParts.unshift(`[data-testid="${cTestId}"]`);
      break;
    }

    // Check sibling position
    let part = tag;
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children).filter(
        (child) => child.tagName === current?.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    pathParts.unshift(part);

    // Test if path accumulated so far is uniquely resolvable
    const currentPath = pathParts.join(" > ");
    try {
      if (doc.querySelectorAll(currentPath).length === 1) {
        return currentPath;
      }
    } catch {
      // Continue walking up
    }

    current = current.parentElement;
  }

  const fullPath = pathParts.join(" > ");
  try {
    if (doc.querySelectorAll(fullPath).length === 1) {
      return fullPath;
    }
  } catch {
    // Fallback
  }

  return fullPath || el.tagName.toLowerCase();
}

/**
 * Builds a friendly component/section breadcrumb for the UI.
 * e.g. "Header → Nav → Dashboard Button"
 */
export function generateElementBreadcrumb(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== document.body && parts.length < 3) {
    let name = current.tagName.toLowerCase();
    if (current.id) {
      name = `#${current.id}`;
    } else if (current.getAttribute("data-testid")) {
      name = `[${current.getAttribute("data-testid")}]`;
    } else if (current.getAttribute("aria-label")) {
      name = current.getAttribute("aria-label")!;
    } else if (current.className && typeof current.className === "string") {
      const firstClass = current.className.trim().split(/\s+/)[0];
      if (firstClass && firstClass.length > 2) name = `.${firstClass}`;
    }
    parts.unshift(name);
    current = current.parentElement;
  }

  return parts.join(" → ") || el.tagName.toLowerCase();
}

/**
 * Generates a resilient, multi-heuristic TargetFingerprint from a DOM Element.
 */
export function generateTargetFingerprint(el: HTMLElement, doc: Document = document): TargetFingerprint {
  const tagName = el.tagName.toLowerCase();
  const candidates: string[] = [];

  // 1. Data-testid / data-qa / data-cy (highest priority for resilient testing)
  const testId = el.getAttribute("data-testid") || el.getAttribute("data-qa") || el.getAttribute("data-cy");
  if (testId) {
    candidates.push(`[data-testid="${testId}"]`);
  }

  // 2. Guaranteed unique hierarchical selector
  const uniqueSelector = generateUniqueSelector(el, doc);
  if (uniqueSelector && !candidates.includes(uniqueSelector)) {
    candidates.push(uniqueSelector);
  }

  // 3. Unique ID
  if (el.id && !el.id.match(/\d{5,}|[a-f0-9]{8}-[a-f0-9]{4}/i)) {
    candidates.push(`#${el.id}`);
  }

  // 4. Accessible attributes
  const role = el.getAttribute("role");
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    candidates.push(`[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`);
  }
  if (role && ariaLabel) {
    candidates.push(`[role="${role}"][aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`);
  }

  // 5. Name attribute
  const name = el.getAttribute("name");
  if (name) {
    candidates.push(`${tagName}[name="${name}"]`);
  }

  // Text content snippet (safe, non-input)
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
 * Resolves a TargetFingerprint against a Document.
 * Checks ALL candidates to find a unique match before falling back.
 * Prioritizes visible elements and disambiguates multiple matches using textContentSnippet.
 */
export function resolveTargetElement(
  fingerprint: TargetFingerprint,
  doc: Document = document
): { element: Element | null; matchedCandidate?: string; ambiguityCount: number } {
  let bestCandidate: { element: Element; candidate: string; count: number } | null = null;

  // 1. Pass 1: Find candidate that uniquely matches exactly 1 element
  for (const candidate of fingerprint.selectorCandidates) {
    try {
      const matches = Array.from(doc.querySelectorAll(candidate));
      if (matches.length === 1) {
        return { element: matches[0], matchedCandidate: candidate, ambiguityCount: 1 };
      }

      // Filter to visible elements if multiple exist
      const visibleMatches = matches.filter((el) => {
        const htmlEl = el as HTMLElement;
        if (typeof htmlEl.offsetParent !== "undefined") {
          return htmlEl.offsetParent !== null;
        }
        return true;
      });

      if (visibleMatches.length === 1) {
        return { element: visibleMatches[0], matchedCandidate: candidate, ambiguityCount: 1 };
      }

      if (matches.length > 1) {
        if (!bestCandidate || matches.length < bestCandidate.count) {
          bestCandidate = { element: visibleMatches[0] || matches[0], candidate, count: matches.length };
        }
      }
    } catch {
      continue;
    }
  }

  // 2. Pass 2: Disambiguate using textContentSnippet among matches
  if (bestCandidate && fingerprint.textContentSnippet) {
    const targetSnippet = fingerprint.textContentSnippet.trim().toLowerCase();
    const allMatches = Array.from(doc.querySelectorAll(bestCandidate.candidate));
    const textMatches = allMatches.filter((el) => {
      const txt = (el.textContent || "").trim().toLowerCase();
      return txt === targetSnippet || txt.includes(targetSnippet);
    });

    if (textMatches.length >= 1) {
      return {
        element: textMatches[0],
        matchedCandidate: bestCandidate.candidate,
        ambiguityCount: textMatches.length === 1 ? 1 : textMatches.length
      };
    }
  }

  // 3. Fallback: return best candidate found
  if (bestCandidate) {
    return {
      element: bestCandidate.element,
      matchedCandidate: bestCandidate.candidate,
      ambiguityCount: bestCandidate.count
    };
  }

  return { element: null, ambiguityCount: 0 };
}
