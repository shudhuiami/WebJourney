// WebJourney Content Script with Shadow DOM Isolation

class WebJourneyOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private highlightBox: HTMLElement | null = null;
  private isInspecting: boolean = false;

  constructor() {
    this.initShadowHost();
    this.initMessageListener();
  }

  private initShadowHost() {
    if (document.getElementById("webjourney-host")) return;

    this.host = document.createElement("div");
    this.host.id = "webjourney-host";
    this.host.style.position = "absolute";
    this.host.style.top = "0";
    this.host.style.left = "0";
    this.host.style.width = "0";
    this.host.style.height = "0";
    this.host.style.zIndex = "2147483647"; // Max z-index
    this.host.style.pointerEvents = "none";

    this.shadow = this.host.attachShadow({ mode: "open" });

    // Encapsulated Shadow DOM CSS
    const style = document.createElement("style");
    style.textContent = `
      .wj-highlight-box {
        position: absolute;
        pointer-events: none;
        box-sizing: border-box;
        border: 2px solid #2563eb;
        background: rgba(37, 99, 235, 0.08);
        border-radius: 6px;
        transition: all 0.15s ease-out;
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
        z-index: 2147483647;
      }
      .wj-inspector-badge {
        position: absolute;
        top: -24px;
        left: 0;
        background: #2563eb;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        white-space: nowrap;
        pointer-events: none;
      }
      .wj-tooltip {
        position: absolute;
        pointer-events: auto;
        background: #ffffff;
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        border: 1px solid #e2e8f0;
        width: 260px;
        font-size: 13px;
        z-index: 2147483647;
      }
    `;
    this.shadow.appendChild(style);

    this.highlightBox = document.createElement("div");
    this.highlightBox.className = "wj-highlight-box";
    this.highlightBox.style.display = "none";

    this.shadow.appendChild(this.highlightBox);
    document.documentElement.appendChild(this.host);
  }

  private initMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case "START_INSPECTOR":
          this.startInspector();
          sendResponse({ success: true });
          break;

        case "STOP_INSPECTOR":
          this.stopInspector();
          sendResponse({ success: true });
          break;

        case "TEST_HIGHLIGHT":
          this.highlightSelector(message.selector);
          sendResponse({ success: true });
          break;

        case "CLEAR_HIGHLIGHT":
          this.clearHighlight();
          sendResponse({ success: true });
          break;
      }
      return true;
    });
  }

  public highlightElement(el: Element, label?: string) {
    if (!this.highlightBox) return;
    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    this.highlightBox.style.display = "block";
    this.highlightBox.style.top = `${rect.top + scrollY - 2}px`;
    this.highlightBox.style.left = `${rect.left + scrollX - 2}px`;
    this.highlightBox.style.width = `${rect.width + 4}px`;
    this.highlightBox.style.height = `${rect.height + 4}px`;

    let badge = this.highlightBox.querySelector(".wj-inspector-badge");
    if (label) {
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "wj-inspector-badge";
        this.highlightBox.appendChild(badge);
      }
      badge.textContent = label;
    } else if (badge) {
      badge.remove();
    }
  }

  public highlightSelector(selector: string) {
    const el = document.querySelector(selector);
    if (el) {
      this.highlightElement(el, selector);
    } else {
      console.warn(`[WebJourney] Element not found for selector: ${selector}`);
    }
  }

  public clearHighlight() {
    if (this.highlightBox) {
      this.highlightBox.style.display = "none";
    }
  }

  private onMouseOver = (e: MouseEvent) => {
    if (!this.isInspecting) return;
    const target = e.target as HTMLElement;
    if (!target || target === this.host || this.host?.contains(target)) return;

    const selector = this.generateSelector(target);
    this.highlightElement(target, selector);
  };

  private onClick = (e: MouseEvent) => {
    if (!this.isInspecting) return;
    const target = e.target as HTMLElement;
    if (!target || target === this.host || this.host?.contains(target)) return;

    e.preventDefault();
    e.stopPropagation();

    const selector = this.generateSelector(target);
    chrome.runtime.sendMessage({
      type: "ELEMENT_PICKED",
      selector,
      tagName: target.tagName.toLowerCase(),
      textContent: (target.textContent || "").trim().slice(0, 50)
    });

    this.stopInspector();
  };

  public startInspector() {
    this.isInspecting = true;
    document.addEventListener("mouseover", this.onMouseOver, true);
    document.addEventListener("click", this.onClick, true);
  }

  public stopInspector() {
    this.isInspecting = false;
    document.removeEventListener("mouseover", this.onMouseOver, true);
    document.removeEventListener("click", this.onClick, true);
    this.clearHighlight();
  }

  private generateSelector(el: HTMLElement): string {
    // 1. Check data-testid
    const testId = el.getAttribute("data-testid");
    if (testId) return `[data-testid="${testId}"]`;

    // 2. Check id
    if (el.id && !el.id.match(/\d{4,}/)) {
      return `#${el.id}`;
    }

    // 3. Check name or aria-label
    const name = el.getAttribute("name");
    if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

    // 4. Fallback to tag + class hierarchy
    const tag = el.tagName.toLowerCase();
    const className = typeof el.className === "string" && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";

    return `${tag}${className}`;
  }
}

// Initialize on page load
new WebJourneyOverlay();
console.log("[WebJourney] Isolated Content Script active.");
