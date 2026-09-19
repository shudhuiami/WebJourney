// WebJourney Content Script with Shadow DOM Isolation & Interactive Journey Player
import { JourneyPlayer, type PlayerContext } from "@webjourney/step-engine";
import type { Journey, StepDefinition } from "@webjourney/journey-schema";

const RUN_STORAGE_KEY = "webjourney_active_run";

class WebJourneyOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private highlightBox: HTMLElement | null = null;
  private tooltipEl: HTMLElement | null = null;
  private activeTargetEl: Element | null = null;
  private isInspecting: boolean = false;
  private rafId: number | null = null;
  private player: JourneyPlayer;

  constructor() {
    this.initShadowHost();
    this.player = new JourneyPlayer({
      onStateChange: this.handlePlayerStateChange.bind(this),
      onHighlightTarget: this.highlightStepTarget.bind(this),
      onClearHighlight: this.clearHighlight.bind(this)
    });
    this.initMessageListener();
    this.initScrollAndResizeListeners();
    this.initKeyboardNavigation();
    this.checkResumableRun();
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
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1);
        border: 1px solid #e2e8f0;
        width: 320px;
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
      .wj-step-counter {
        font-size: 11px;
        font-weight: 700;
        color: #2563eb;
        background: #eff6ff;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .wj-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        background: #f1f5f9;
        color: #475569;
      }
      .wj-title {
        font-size: 15px;
        font-weight: 700;
        margin: 0;
        color: #0f172a;
      }
      .wj-instruction {
        margin: 8px 0 14px;
        color: #334155;
      }
      .wj-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #f1f5f9;
      }
      .wj-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        background: #2563eb;
        color: #ffffff;
        transition: background 0.15s ease;
      }
      .wj-button:hover { background: #1d4ed8; }
      .wj-button-secondary {
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;
      }
      .wj-button-secondary:hover { background: #e2e8f0; }
      .wj-error-box {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 10px;
        font-size: 12px;
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

  private initKeyboardNavigation() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.isInspecting) {
          this.stopInspector();
        } else if (this.player.getState() === "active") {
          this.player.pause();
        }
      }
    });
  }

  private checkResumableRun() {
    if (chrome.storage?.local) {
      chrome.storage.local.get([RUN_STORAGE_KEY], (res) => {
        const saved = res[RUN_STORAGE_KEY];
        if (saved && saved.journey && saved.status === "active") {
          this.player.start(saved.journey, saved.currentStepIndex || 0);
        }
      });
    }
  }

  private handlePlayerStateChange(context: PlayerContext) {
    // Persist progress to local storage
    if (chrome.storage?.local) {
      if (context.state === "completed" || context.state === "idle") {
        chrome.storage.local.remove([RUN_STORAGE_KEY]);
      } else {
        chrome.storage.local.set({
          [RUN_STORAGE_KEY]: {
            journey: context.journey,
            currentStepIndex: context.currentStepIndex,
            status: context.state
          }
        });
      }
    }

    if (context.state === "completed") {
      this.renderCompletionCard(context.journey!);
    } else if (context.state === "blocked") {
      this.renderBlockedCard(context);
    }
  }

  private renderBlockedCard(context: PlayerContext) {
    if (!this.tooltipEl) return;
    const currentStep = context.journey?.steps[context.currentStepIndex];

    this.tooltipEl.innerHTML = `
      <div class="wj-tooltip-header">
        <span class="wj-step-counter">Step ${context.currentStepIndex + 1} of ${context.journey?.steps.length}</span>
        <span class="wj-badge" style="background: #fee2e2; color: #b91c1c;">Target Issue</span>
      </div>
      <h4 class="wj-title">${currentStep?.title || "Target Not Found"}</h4>
      <div class="wj-error-box">
        ${context.errorMessage || "Unable to locate the required element on this page."}
      </div>
      <div class="wj-instruction">
        ${currentStep?.fallbackInstruction || "You can retry locating the element or skip this step to proceed."}
      </div>
      <div class="wj-footer">
        <button class="wj-button wj-button-secondary" id="wj-retry-btn">&#x21bb; Retry</button>
        <div style="display: flex; gap: 6px;">
          ${
            currentStep?.allowSkip
              ? '<button class="wj-button" id="wj-skip-btn">Skip Step &rarr;</button>'
              : ""
          }
          <button class="wj-button wj-button-secondary" id="wj-exit-btn">Exit</button>
        </div>
      </div>
    `;

    this.tooltipEl.style.display = "block";
    this.tooltipEl.style.top = "80px";
    this.tooltipEl.style.left = "30px";

    this.tooltipEl.querySelector("#wj-retry-btn")?.addEventListener("click", () => {
      this.player.resume();
    });
    this.tooltipEl.querySelector("#wj-skip-btn")?.addEventListener("click", () => {
      this.player.skipStep();
    });
    this.tooltipEl.querySelector("#wj-exit-btn")?.addEventListener("click", () => {
      this.player.stop();
    });
  }

  private renderCompletionCard(journey: Journey) {
    if (!this.tooltipEl) return;

    this.tooltipEl.innerHTML = `
      <div class="wj-tooltip-header">
        <span class="wj-badge" style="background: #dcfce7; color: #15803d;">Complete</span>
      </div>
      <h4 class="wj-title">🎉 Walkthrough Complete!</h4>
      <div class="wj-instruction">
        You have successfully completed <strong>${journey.name}</strong> (${journey.steps.length} steps).
      </div>
      <div class="wj-footer" style="justify-content: flex-end;">
        <button class="wj-button" id="wj-finish-btn">Finish & Close</button>
      </div>
    `;

    this.tooltipEl.style.display = "block";
    this.tooltipEl.style.top = "80px";
    this.tooltipEl.style.left = "30px";

    this.tooltipEl.querySelector("#wj-finish-btn")?.addEventListener("click", () => {
      this.player.stop();
      this.clearHighlight();
    });
  }

  private highlightStepTarget(el: Element, step: StepDefinition) {
    this.activeTargetEl = el;
    this.repositionHighlightAndTooltip(el, undefined, step);
  }

  private repositionHighlightAndTooltip(el: Element, label?: string, step?: StepDefinition) {
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

    if (step) {
      const currentIdx = this.player.getContext().currentStepIndex;
      const totalSteps = this.player.getContext().journey?.steps.length || 1;

      this.tooltipEl.innerHTML = `
        <div class="wj-tooltip-header">
          <span class="wj-step-counter">Step ${currentIdx + 1} of ${totalSteps}</span>
          <span class="wj-badge">${step.action}</span>
        </div>
        <h4 class="wj-title">${step.title}</h4>
        <div class="wj-instruction">${step.instruction}</div>
        <div class="wj-footer">
          <button class="wj-button wj-button-secondary" id="wj-back-btn" ${currentIdx === 0 ? "disabled style='opacity:0.4;'" : ""}>&larr; Back</button>
          <div style="display: flex; gap: 6px;">
            ${
              step.allowSkip
                ? '<button class="wj-button wj-button-secondary" id="wj-skip-btn">Skip</button>'
                : ""
            }
            <button class="wj-button" id="wj-step-continue-btn">
              ${step.action === "manual" ? "Continue &rarr;" : "Got it"}
            </button>
          </div>
        </div>
      `;
      this.tooltipEl.style.display = "block";

      let tooltipTop = rect.bottom + scrollY + 8;
      const tooltipLeft = Math.max(16, Math.min(rect.left + scrollX, window.innerWidth - 340));

      if (rect.bottom + 180 > window.innerHeight && rect.top > 180) {
        tooltipTop = rect.top + scrollY - 170;
      }

      this.tooltipEl.style.top = `${tooltipTop}px`;
      this.tooltipEl.style.left = `${tooltipLeft}px`;

      this.tooltipEl.querySelector("#wj-back-btn")?.addEventListener("click", () => {
        this.player.previousStep();
      });
      this.tooltipEl.querySelector("#wj-skip-btn")?.addEventListener("click", () => {
        this.player.skipStep();
      });
      this.tooltipEl.querySelector("#wj-step-continue-btn")?.addEventListener("click", () => {
        this.player.nextStep();
      });
    }
  }

  public clearHighlight() {
    this.activeTargetEl = null;
    if (this.highlightBox) this.highlightBox.style.display = "none";
    if (this.tooltipEl) this.tooltipEl.style.display = "none";
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
          const el = document.querySelector(message.selector);
          if (el) {
            this.highlightStepTarget(
              el,
              message.step || {
                id: "preview",
                order: 0,
                title: "Step Preview",
                instruction: "Interactive preview of your step overlay.",
                action: "click",
                allowSkip: true
              }
            );
          }
          sendResponse({ success: true });
          break;

        case "CLEAR_HIGHLIGHT":
          this.clearHighlight();
          sendResponse({ success: true });
          break;

        case "PLAYER_START":
          this.player.start(message.journey);
          sendResponse({ success: true });
          break;

        case "PLAYER_PAUSE":
          this.player.pause();
          sendResponse({ success: true });
          break;

        case "PLAYER_RESUME":
          this.player.resume();
          sendResponse({ success: true });
          break;

        case "PLAYER_STOP":
          this.player.stop();
          sendResponse({ success: true });
          break;
      }
      return true;
    });
  }

  private onMouseOver = (e: MouseEvent) => {
    if (!this.isInspecting) return;
    const target = e.target as HTMLElement;
    if (!target || target === this.host || this.host?.contains(target)) return;

    const selector = this.generateSimpleSelector(target);
    this.repositionHighlightAndTooltip(target, selector);
  };

  private onClick = (e: MouseEvent) => {
    if (!this.isInspecting) return;
    const target = e.target as HTMLElement;
    if (!target || target === this.host || this.host?.contains(target)) return;

    e.preventDefault();
    e.stopPropagation();

    const selector = this.generateSimpleSelector(target);
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

  private generateSimpleSelector(el: HTMLElement): string {
    const testId = el.getAttribute("data-testid");
    if (testId) return `[data-testid="${testId}"]`;

    if (el.id && !el.id.match(/\d{4,}/)) return `#${el.id}`;

    const name = el.getAttribute("name");
    if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

    return el.tagName.toLowerCase();
  }
}

new WebJourneyOverlay();
console.log("[WebJourney] Full Interactive Journey Player mounted inside Shadow DOM.");
