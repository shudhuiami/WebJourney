// WebJourney Content Script with Shadow DOM Isolation and Resilient Tracking

interface StepOverlayOptions {
  title?: string;
  instruction?: string;
  actionType?: string;
  showContinue?: boolean;
}

class WebJourneyOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private highlightBox: HTMLElement | null = null;
  private tooltipEl: HTMLElement | null = null;
  private activeTargetEl: Element | null = null;
  private isInspecting: boolean = false;
  private rafId: number | null = null;

  constructor() {
    this.initShadowHost();
    this.initMessageListener();
    this.initScrollAndResizeListeners();
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
    this.host.style.zIndex = "2147483647";
    this.host.style.pointerEvents = "none";

    this.shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .wj-highlight-box {
        position: absolute;
        pointer-events: none;
        box-sizing: border-box;
        border: 2.5px solid #2563eb;
        background: rgba(37, 99, 235, 0.08);
        border-radius: 6px;
        transition: top 0.1s ease-out, left 0.1s ease-out, width 0.1s ease-out, height 0.1s ease-out;
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
        z-index: 2147483646;
      }
      .wj-inspector-badge {
        position: absolute;
        top: -26px;
        left: 0;
        background: #2563eb;
        color: #ffffff;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 4px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      }
      .wj-tooltip-card {
        position: absolute;
        pointer-events: auto;
        background: #ffffff;
        color: #0f172a;
        padding: 16px;
        border-radius: 10px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1);
        border: 1px solid #e2e8f0;
        width: 280px;
        font-size: 13px;
        line-height: 1.5;
        z-index: 2147483647;
        box-sizing: border-box;
        animation: wjFadeIn 0.2s ease-out;
      }
      @keyframes wjFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .wj-tooltip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .wj-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        background: #eff6ff;
        color: #1d4ed8;
      }
      .wj-title {
        font-size: 14px;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
      }
      .wj-instruction {
        margin: 8px 0 12px;
        color: #334155;
      }
      .wj-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        background: #2563eb;
        color: #ffffff;
        transition: background 0.15s ease;
      }
      .wj-button:hover {
        background: #1d4ed8;
      }
    `;
    this.shadow.appendChild(style);

    this.highlightBox = document.createElement("div");
    this.highlightBox.className = "wj-highlight-box";
    this.highlightBox.style.display = "none";
    this.shadow.appendChild(this.highlightBox);

    this.tooltipEl = document.createElement("div");
    this.tooltipEl.className = "wj-tooltip-card";
    this.tooltipEl.style.display = "none";
    this.shadow.appendChild(this.tooltipEl);

    document.documentElement.appendChild(this.host);
  }

  private initScrollAndResizeListeners() {
    const scheduleUpdate = () => {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => {
        if (this.activeTargetEl && this.highlightBox?.style.display !== "none") {
          this.repositionHighlightAndTooltip(this.activeTargetEl);
        }
      });
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
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

        case "HIGHLIGHT_TARGET":
        case "TEST_HIGHLIGHT":
          this.highlightSelector(message.selector, {
            title: message.step?.title || "Selected Target",
            instruction: message.step?.instruction || "Target successfully highlighted with Shadow DOM isolation.",
            actionType: message.step?.action || "click",
            showContinue: true
          });
          sendResponse({ success: true });
          break;

        case "CLEAR_HIGHLIGHT":
          this.clearHighlight();
          sendResponse({ success: true });
          break;

        case "TEARDOWN":
          this.teardown();
          sendResponse({ success: true });
          break;
      }
      return true;
    });
  }

  public highlightElement(el: Element, label?: string, options?: StepOverlayOptions) {
    if (!this.highlightBox || !this.tooltipEl) return;
    this.activeTargetEl = el;

    this.repositionHighlightAndTooltip(el, label, options);
  }

  private repositionHighlightAndTooltip(el: Element, label?: string, options?: StepOverlayOptions) {
    if (!this.highlightBox || !this.tooltipEl) return;

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

    // Render Tooltip Card if options provided
    if (options) {
      this.tooltipEl.innerHTML = `
        <div class="wj-tooltip-header">
          <span class="wj-badge">${options.actionType || "Step"}</span>
        </div>
        <h4 class="wj-title">${options.title || "Target Highlighted"}</h4>
        <div class="wj-instruction">${options.instruction || ""}</div>
        ${
          options.showContinue
            ? '<button class="wj-button" id="wj-step-continue-btn">Continue &rarr;</button>'
            : ""
        }
      `;
      this.tooltipEl.style.display = "block";

      // Position tooltip below or above element
      let tooltipTop = rect.bottom + scrollY + 8;
      const tooltipLeft = Math.max(16, Math.min(rect.left + scrollX, window.innerWidth - 300));

      if (rect.bottom + 150 > window.innerHeight && rect.top > 150) {
        // Place above target if bottom exceeds viewport
        tooltipTop = rect.top + scrollY - 140;
      }

      this.tooltipEl.style.top = `${tooltipTop}px`;
      this.tooltipEl.style.left = `${tooltipLeft}px`;

      const continueBtn = this.tooltipEl.querySelector("#wj-step-continue-btn");
      if (continueBtn) {
        continueBtn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ type: "STEP_CONTINUED" });
          this.clearHighlight();
        });
      }
    } else {
      this.tooltipEl.style.display = "none";
    }
  }

  public highlightSelector(selector: string, options?: StepOverlayOptions) {
    const el = document.querySelector(selector);
    if (el) {
      this.highlightElement(el, selector, options);
    } else {
      console.warn(`[WebJourney] Element not found for selector: ${selector}`);
    }
  }

  public clearHighlight() {
    this.activeTargetEl = null;
    if (this.highlightBox) this.highlightBox.style.display = "none";
    if (this.tooltipEl) this.tooltipEl.style.display = "none";
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
    const candidatesCount = document.querySelectorAll(selector).length;

    chrome.runtime.sendMessage({
      type: "ELEMENT_PICKED",
      selector,
      tagName: target.tagName.toLowerCase(),
      textContent: (target.textContent || "").trim().slice(0, 50),
      candidatesCount
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

  public teardown() {
    this.stopInspector();
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
      this.host = null;
      this.shadow = null;
    }
  }

  private generateSelector(el: HTMLElement): string {
    // 1. Prioritize data-testid if present
    const testId = el.getAttribute("data-testid");
    if (testId) {
      const sel = `[data-testid="${testId}"]`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }

    // 2. Prioritize unique ID
    if (el.id && !el.id.match(/\d{4,}/)) {
      const sel = `#${el.id}`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }

    // 3. Name or aria-label
    const name = el.getAttribute("name");
    if (name) {
      const sel = `${el.tagName.toLowerCase()}[name="${name}"]`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) {
      const sel = `[aria-label="${ariaLabel}"]`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }

    // 4. Tag + Class combination
    const tag = el.tagName.toLowerCase();
    if (typeof el.className === "string" && el.className.trim()) {
      const classes = el.className.trim().split(/\s+/).slice(0, 2).join(".");
      const sel = `${tag}.${classes}`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }

    // 5. Hierarchy fallback
    let current: HTMLElement | null = el;
    const path: string[] = [];
    while (current && current !== document.body && current !== document.documentElement) {
      let segment = current.tagName.toLowerCase();
      if (current.id && !current.id.match(/\d{4,}/)) {
        segment += `#${current.id}`;
        path.unshift(segment);
        break;
      }
      const parent: HTMLElement | null = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current?.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          segment += `:nth-of-type(${index})`;
        }
      }
      path.unshift(segment);
      current = parent;
    }

    return path.join(" > ");
  }
}

// Instantiate on loaded page
new WebJourneyOverlay();
console.log("[WebJourney] Resilient Content Script active with Shadow DOM isolation.");
