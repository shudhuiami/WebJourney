// WebJourney Content Script with Shadow DOM Isolation & Interactive Journey Player
import {
  JourneyPlayer,
  generateUniqueSelector,
  generateElementBreadcrumb,
  type PlayerContext
} from "@webjourney/step-engine";
import type { Journey, StepDefinition } from "@webjourney/journey-schema";

const RUN_STORAGE_KEY = "webjourney_active_run";

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const ACTION_COLOR_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  click: { bg: "#eff6ff", text: "#1d4ed8", icon: "👆" },
  "field-complete": { bg: "#ecfdf5", text: "#065f46", icon: "⌨️" },
  navigation: { bg: "#f5f3ff", text: "#6d28d9", icon: "🧭" },
  manual: { bg: "#fffbeb", text: "#b45309", icon: "ℹ️" }
};

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
        border: 2.5px solid #4f46e5;
        background: rgba(79, 70, 229, 0.12);
        border-radius: 8px;
        transition: top 0.1s cubic-bezier(0.16, 1, 0.3, 1), left 0.1s cubic-bezier(0.16, 1, 0.3, 1), width 0.1s ease-out, height 0.1s ease-out;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.25), 0 0 20px rgba(99, 102, 241, 0.35);
        animation: wjPulse 2.5s infinite;
        z-index: 2147483646;
      }
      @keyframes wjPulse {
        0%, 100% {
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.25), 0 0 15px rgba(99, 102, 241, 0.3);
        }
        50% {
          box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.4), 0 0 25px rgba(99, 102, 241, 0.5);
        }
      }
      .wj-inspector-badge {
        position: absolute;
        top: -28px;
        left: 0;
        background: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%);
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 6px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .wj-tooltip-card {
        position: absolute;
        pointer-events: auto;
        background: #ffffff;
        color: #0f172a;
        padding: 0;
        border-radius: 14px;
        box-shadow: 0 20px 40px -8px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.9);
        width: 330px;
        font-size: 13px;
        line-height: 1.5;
        z-index: 2147483647;
        box-sizing: border-box;
        overflow: hidden;
        animation: wjFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes wjFadeIn {
        from { opacity: 0; transform: translateY(6px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .wj-card-accent-bar {
        height: 4px;
        background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%);
        width: 100%;
      }
      .wj-card-inner {
        padding: 16px;
      }
      .wj-tooltip-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .wj-step-counter {
        font-size: 11px;
        font-weight: 800;
        color: #4f46e5;
        background: #eef2ff;
        padding: 3px 8px;
        border-radius: 12px;
        border: 1px solid #c7d2fe;
      }
      .wj-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 6px;
      }
      .wj-title {
        font-size: 15px;
        font-weight: 800;
        margin: 0;
        color: #0f172a;
        line-height: 1.3;
      }
      .wj-instruction {
        margin: 10px 0 14px;
        color: #475569;
        font-size: 13px;
        line-height: 1.5;
      }
      .wj-progress-track {
        height: 4px;
        background: #f1f5f9;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .wj-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4f46e5 0%, #3b82f6 100%);
        transition: width 0.3s ease;
      }
      .wj-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 10px;
        padding-top: 12px;
        border-top: 1px solid #f1f5f9;
      }
      .wj-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 7px 14px;
        font-size: 12px;
        font-weight: 700;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
        transition: all 0.15s ease;
      }
      .wj-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
      }
      .wj-button-secondary {
        background: #f8fafc;
        color: #475569;
        border: 1px solid #cbd5e1;
        box-shadow: none;
      }
      .wj-button-secondary:hover {
        background: #f1f5f9;
        color: #0f172a;
        box-shadow: none;
        transform: none;
      }
      .wj-error-box {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        padding: 10px 12px;
        border-radius: 8px;
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
      <div class="wj-card-accent-bar" style="background: #ef4444;"></div>
      <div class="wj-card-inner">
        <div class="wj-tooltip-header">
          <span class="wj-step-counter" style="color: #dc2626; background: #fee2e2; border-color: #fecaca;">
            Step ${context.currentStepIndex + 1} of ${context.journey?.steps.length}
          </span>
          <span class="wj-badge" style="background: #fee2e2; color: #b91c1c;">Target Missing</span>
        </div>
        <h4 class="wj-title">${escapeHtml(currentStep?.title || "Target Not Found")}</h4>
        <div class="wj-error-box">
          ${escapeHtml(context.errorMessage || "The target element could not be located on this page.")}
        </div>
        <div class="wj-instruction">
          ${escapeHtml(currentStep?.fallbackInstruction || "You can retry locating the element, or skip this step to keep going.")}
        </div>
        <div class="wj-footer">
          <button class="wj-button wj-button-secondary" id="wj-retry-btn">↻ Retry</button>
          <div style="display: flex; gap: 6px;">
            ${
              currentStep?.allowSkip
                ? '<button class="wj-button" id="wj-skip-btn">Skip Step &rarr;</button>'
                : ""
            }
            <button class="wj-button wj-button-secondary" id="wj-exit-btn">Exit</button>
          </div>
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
      <div class="wj-card-accent-bar" style="background: linear-gradient(90deg, #10b981 0%, #059669 100%);"></div>
      <div class="wj-card-inner">
        <div class="wj-tooltip-header">
          <span class="wj-badge" style="background: #dcfce7; color: #15803d;">Walkthrough Finished</span>
        </div>
        <h4 class="wj-title">🎉 You Did It!</h4>
        <div class="wj-instruction">
          You have successfully completed <strong>${escapeHtml(journey.name)}</strong> (${journey.steps.length} steps).
        </div>
        <div class="wj-footer" style="justify-content: flex-end;">
          <button class="wj-button" id="wj-finish-btn" style="background: #10b981;">Complete & Close</button>
        </div>
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
    this.highlightBox.style.top = `${rect.top + scrollY - 3}px`;
    this.highlightBox.style.left = `${rect.left + scrollX - 3}px`;
    this.highlightBox.style.width = `${rect.width + 6}px`;
    this.highlightBox.style.height = `${rect.height + 6}px`;

    let badge = this.highlightBox.querySelector(".wj-inspector-badge");
    if (label) {
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "wj-inspector-badge";
        this.highlightBox.appendChild(badge);
      }
      badge.textContent = `🎯 ${label}`;
    } else if (badge) {
      badge.remove();
    }

    if (step) {
      const currentIdx = this.player.getContext().currentStepIndex;
      const totalSteps = this.player.getContext().journey?.steps.length || 1;
      const pct = Math.round(((currentIdx + 1) / totalSteps) * 100);
      const actionStyle = ACTION_COLOR_STYLES[step.action] || ACTION_COLOR_STYLES.click;

      this.tooltipEl.innerHTML = `
        <div class="wj-card-accent-bar"></div>
        <div class="wj-card-inner">
          <div class="wj-tooltip-header">
            <span class="wj-step-counter">Step ${currentIdx + 1} of ${totalSteps}</span>
            <span class="wj-badge" style="background: ${actionStyle.bg}; color: ${actionStyle.text};">
              ${actionStyle.icon} ${escapeHtml(step.action)}
            </span>
          </div>
          <div class="wj-progress-track">
            <div class="wj-progress-fill" style="width: ${pct}%;"></div>
          </div>
          <h4 class="wj-title">${escapeHtml(step.title)}</h4>
          <div class="wj-instruction">${escapeHtml(step.instruction)}</div>
          <div class="wj-footer">
            <button class="wj-button wj-button-secondary" id="wj-back-btn" ${currentIdx === 0 ? "disabled style='opacity:0.3;'" : ""}>&larr; Back</button>
            <div style="display: flex; gap: 6px;">
              ${
                step.allowSkip
                  ? '<button class="wj-button wj-button-secondary" id="wj-skip-btn">Skip</button>'
                  : ""
              }
              <button class="wj-button" id="wj-step-continue-btn">
                ${step.action === "manual" ? "Continue &rarr;" : "Next &rarr;"}
              </button>
            </div>
          </div>
        </div>
      `;
      this.tooltipEl.style.display = "block";

      let tooltipTop = rect.bottom + scrollY + 10;
      const tooltipLeft = Math.max(16, Math.min(rect.left + scrollX, window.innerWidth - 350));

      if (rect.bottom + 200 > window.innerHeight && rect.top > 200) {
        tooltipTop = rect.top + scrollY - 190;
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

    const breadcrumb = generateElementBreadcrumb(target);
    const selector = generateUniqueSelector(target, document);
    this.repositionHighlightAndTooltip(target, breadcrumb || selector);
  };

  private onClick = (e: MouseEvent) => {
    if (!this.isInspecting) return;
    const target = e.target as HTMLElement;
    if (!target || target === this.host || this.host?.contains(target)) return;

    e.preventDefault();
    e.stopPropagation();

    // Use guaranteed unique selector and breadcrumb
    const selector = generateUniqueSelector(target, document);
    const breadcrumb = generateElementBreadcrumb(target);
    const candidatesCount = document.querySelectorAll(selector).length;

    chrome.runtime.sendMessage({
      type: "ELEMENT_PICKED",
      selector,
      tagName: target.tagName.toLowerCase(),
      textContent: (target.textContent || "").trim().slice(0, 50),
      candidatesCount,
      breadcrumb
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
}

new WebJourneyOverlay();
console.log("[WebJourney] Modern Colorful Overlay & Player active.");
