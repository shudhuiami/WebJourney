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
  private backdropEl: HTMLElement | null = null;
  private highlightBox: HTMLElement | null = null;
  private tooltipEl: HTMLElement | null = null;
  private activeTargetEl: Element | null = null;
  private currentStep: StepDefinition | null = null;
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
      .wj-backdrop {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2147483640;
        pointer-events: auto;
        display: none;
        transition: opacity 0.25s ease;
      }
      .wj-backdrop-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: auto;
      }
      .wj-highlight-box {
        position: fixed;
        pointer-events: none;
        box-sizing: border-box;
        border: 2.5px solid #4f46e5;
        background: rgba(79, 70, 229, 0.08);
        border-radius: 8px;
        transition: top 0.08s cubic-bezier(0.16, 1, 0.3, 1), left 0.08s cubic-bezier(0.16, 1, 0.3, 1), width 0.08s ease-out, height 0.08s ease-out;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.35), 0 0 24px rgba(99, 102, 241, 0.5);
        animation: wjPulse 2.5s infinite;
        z-index: 2147483645;
      }
      @keyframes wjPulse {
        0%, 100% {
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.35), 0 0 16px rgba(99, 102, 241, 0.4);
        }
        50% {
          box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.5), 0 0 28px rgba(99, 102, 241, 0.65);
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
        position: fixed;
        pointer-events: auto;
        background: #ffffff;
        color: #0f172a;
        padding: 0;
        border-radius: 14px;
        box-shadow: 0 20px 40px -8px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(226, 232, 240, 0.9);
        width: 340px;
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
      .wj-close-btn {
        background: none;
        border: none;
        font-size: 18px;
        line-height: 1;
        color: #94a3b8;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 6px;
        transition: all 0.15s ease;
      }
      .wj-close-btn:hover {
        color: #0f172a;
        background: #f1f5f9;
      }
      @keyframes wjShake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-6px); }
        40%, 80% { transform: translateX(6px); }
      }
      .wj-shake {
        animation: wjShake 0.4s ease-in-out;
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
      .wj-button-primary {
        background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
      }
      .wj-button-primary:hover {
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
      .wj-button-danger {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      }
      .wj-button-danger:hover {
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        transform: translateY(-1px);
      }
      .wj-button-success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
      }
      .wj-button-success:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        transform: translateY(-1px);
      }
      .wj-button-exit {
        background: #fff1f2;
        color: #e11d48;
        border: 1px solid #fecdd3;
        box-shadow: none;
      }
      .wj-button-exit:hover {
        background: #ffe4e6;
        color: #be123c;
        border-color: #fda4af;
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

    this.backdropEl = document.createElement("div");
    this.backdropEl.className = "wj-backdrop";
    this.backdropEl.innerHTML = `
      <svg class="wj-backdrop-svg" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="wj-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect id="wj-mask-hole" x="0" y="0" width="0" height="0" rx="10" ry="10" fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.72)" mask="url(#wj-spotlight-mask)" />
      </svg>
    `;
    this.backdropEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.tooltipEl && this.tooltipEl.style.display !== "none") {
        this.tooltipEl.classList.remove("wj-shake");
        void this.tooltipEl.offsetWidth; // trigger reflow
        this.tooltipEl.classList.add("wj-shake");
      }
    });
    this.shadow.appendChild(this.backdropEl);

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
        if (this.activeTargetEl && (this.highlightBox?.style.display !== "none" || this.backdropEl?.style.display !== "none")) {
          this.repositionHighlightAndTooltip(this.activeTargetEl, undefined, this.currentStep || undefined);
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
        } else if (this.player.getState() !== "idle") {
          this.player.stop();
          this.clearHighlight();
        }
      }
    });
  }

  private showBackdrop() {
    if (!this.backdropEl || !this.host) return;
    this.host.style.position = "fixed";
    this.host.style.inset = "0";
    this.host.style.width = "100vw";
    this.host.style.height = "100vh";
    this.host.style.pointerEvents = "auto";
    this.backdropEl.style.display = "block";
  }

  private hideBackdrop() {
    if (this.backdropEl) {
      this.backdropEl.style.display = "none";
      const hole = this.backdropEl.querySelector("#wj-mask-hole");
      if (hole) {
        hole.setAttribute("width", "0");
        hole.setAttribute("height", "0");
      }
    }
    if (this.host) {
      this.host.style.position = "absolute";
      this.host.style.inset = "auto";
      this.host.style.top = "0";
      this.host.style.left = "0";
      this.host.style.width = "0";
      this.host.style.height = "0";
      this.host.style.pointerEvents = "none";
    }
  }

  private updateBackdropSpotlight(rect?: DOMRect) {
    if (!this.backdropEl) return;
    const hole = this.backdropEl.querySelector("#wj-mask-hole");
    if (!hole) return;

    if (!rect) {
      hole.setAttribute("width", "0");
      hole.setAttribute("height", "0");
      return;
    }

    const pad = 6;
    const x = Math.max(0, rect.left - pad);
    const y = Math.max(0, rect.top - pad);
    const width = rect.width + pad * 2;
    const height = rect.height + pad * 2;

    hole.setAttribute("x", `${x}`);
    hole.setAttribute("y", `${y}`);
    hole.setAttribute("width", `${width}`);
    hole.setAttribute("height", `${height}`);
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
    } else if (context.state === "idle") {
      this.clearHighlight();
    }
  }

  private renderBlockedCard(context: PlayerContext) {
    if (!this.tooltipEl) return;
    const currentStep = context.journey?.steps[context.currentStepIndex];

    this.showBackdrop();
    this.updateBackdropSpotlight();

    if (this.highlightBox) {
      this.highlightBox.style.display = "none";
    }

    this.tooltipEl.innerHTML = `
      <div class="wj-card-accent-bar" style="background: #ef4444;"></div>
      <div class="wj-card-inner">
        <div class="wj-tooltip-header">
          <span class="wj-step-counter" style="color: #dc2626; background: #fee2e2; border-color: #fecaca;">
            Step ${context.currentStepIndex + 1} of ${context.journey?.steps.length}
          </span>
          <button id="wj-blocked-close-btn" class="wj-close-btn" title="Exit Tour">&times;</button>
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
                ? '<button class="wj-button wj-button-secondary" id="wj-skip-btn">Skip</button>'
                : ""
            }
            <button class="wj-button wj-button-secondary" id="wj-exit-btn">Exit</button>
          </div>
        </div>
      </div>
    `;

    this.tooltipEl.style.position = "fixed";
    this.tooltipEl.style.display = "block";
    this.tooltipEl.style.top = "50%";
    this.tooltipEl.style.left = "50%";
    this.tooltipEl.style.transform = "translate(-50%, -50%)";

    const exitHandler = () => {
      this.player.stop();
      this.clearHighlight();
    };

    this.tooltipEl.querySelector("#wj-retry-btn")?.addEventListener("click", () => {
      this.player.resume();
    });
    this.tooltipEl.querySelector("#wj-skip-btn")?.addEventListener("click", () => {
      this.player.skipStep();
    });
    this.tooltipEl.querySelector("#wj-exit-btn")?.addEventListener("click", exitHandler);
    this.tooltipEl.querySelector("#wj-blocked-close-btn")?.addEventListener("click", exitHandler);
  }

  private renderCompletionCard(journey: Journey) {
    if (!this.tooltipEl) return;

    this.showBackdrop();
    this.updateBackdropSpotlight();

    if (this.highlightBox) {
      this.highlightBox.style.display = "none";
    }

    this.tooltipEl.innerHTML = `
      <div class="wj-card-accent-bar" style="background: linear-gradient(90deg, #10b981 0%, #059669 100%);"></div>
      <div class="wj-card-inner">
        <div class="wj-tooltip-header">
          <span class="wj-badge" style="background: #dcfce7; color: #15803d;">Walkthrough Finished</span>
          <button id="wj-finish-close-btn" class="wj-close-btn" title="Close">&times;</button>
        </div>
        <h4 class="wj-title" style="margin-top: 6px;">🎉 You Did It!</h4>
        <div class="wj-instruction">
          You have successfully completed <strong>${escapeHtml(journey.name)}</strong> (${journey.steps.length} steps).
        </div>
        <div class="wj-footer" style="justify-content: flex-end;">
          <button class="wj-button" id="wj-finish-btn" style="background: #10b981;">Complete & Close</button>
        </div>
      </div>
    `;

    this.tooltipEl.style.position = "fixed";
    this.tooltipEl.style.display = "block";
    this.tooltipEl.style.top = "50%";
    this.tooltipEl.style.left = "50%";
    this.tooltipEl.style.transform = "translate(-50%, -50%)";

    const closeHandler = () => {
      this.player.stop();
      this.clearHighlight();
    };

    this.tooltipEl.querySelector("#wj-finish-btn")?.addEventListener("click", closeHandler);
    this.tooltipEl.querySelector("#wj-finish-close-btn")?.addEventListener("click", closeHandler);
  }

  public highlightStepTarget(el: Element, step: StepDefinition) {
    this.activeTargetEl = el;
    this.currentStep = step;

    // Isolate focus by showing dark backdrop
    this.showBackdrop();

    // Smooth scroll to component so it is centered in viewport
    const rect = el.getBoundingClientRect();
    const isComfortablyInView =
      rect.top >= 80 &&
      rect.bottom <= window.innerHeight - 80 &&
      rect.left >= 40 &&
      rect.right <= window.innerWidth - 40;

    if (!isComfortablyInView) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
      });
    }

    this.repositionHighlightAndTooltip(el, undefined, step);

    // Keep tooltip and spotlight synchronized as smooth scrolling progresses
    const syncIntervals = [80, 180, 320, 500, 700];
    syncIntervals.forEach((delay) => {
      setTimeout(() => {
        if (this.activeTargetEl === el && this.currentStep === step) {
          this.repositionHighlightAndTooltip(el, undefined, step);
        }
      }, delay);
    });
  }

  private repositionHighlightAndTooltip(el: Element, label?: string, step?: StepDefinition) {
    if (!this.highlightBox || !this.tooltipEl) return;

    const rect = el.getBoundingClientRect();

    if (this.isInspecting) {
      // Inspector mode uses document absolute coordinates
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      this.highlightBox.style.position = "absolute";
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
      return;
    }

    // Player mode:
    // 1. Update dark backdrop spotlight mask hole
    this.updateBackdropSpotlight(rect);

    // 2. Position pulsating highlight box (fixed on viewport)
    this.highlightBox.style.position = "fixed";
    this.highlightBox.style.display = "block";
    this.highlightBox.style.top = `${rect.top - 4}px`;
    this.highlightBox.style.left = `${rect.left - 4}px`;
    this.highlightBox.style.width = `${rect.width + 8}px`;
    this.highlightBox.style.height = `${rect.height + 8}px`;

    const badge = this.highlightBox.querySelector(".wj-inspector-badge");
    if (badge) badge.remove();

    if (step) {
      const currentIdx = this.player.getContext().currentStepIndex;
      const totalSteps = this.player.getContext().journey?.steps.length || 1;
      const pct = Math.round(((currentIdx + 1) / totalSteps) * 100);
      const actionStyle = ACTION_COLOR_STYLES[step.action] || ACTION_COLOR_STYLES.click;

      this.tooltipEl.innerHTML = `
        <div class="wj-card-accent-bar"></div>
        <div class="wj-card-inner">
          <div class="wj-tooltip-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="wj-step-counter">Step ${currentIdx + 1} of ${totalSteps}</span>
              <span class="wj-badge" style="background: ${actionStyle.bg}; color: ${actionStyle.text};">
                ${actionStyle.icon} ${escapeHtml(step.action)}
              </span>
            </div>
            <button id="wj-exit-tour-btn" class="wj-close-btn" title="Exit Tour">&times;</button>
          </div>
          <div class="wj-progress-track">
            <div class="wj-progress-fill" style="width: ${pct}%;"></div>
          </div>
          <h4 class="wj-title">${escapeHtml(step.title)}</h4>
          <div class="wj-instruction">${escapeHtml(step.instruction)}</div>
          ${(() => {
            const customBtns = step.customButtons || [];
            const hasCustomExit = customBtns.some((b) => b.action === "exit");
            const hasCustomNext = customBtns.some((b) => b.action === "next");
            const hasCustomBack = customBtns.some((b) => b.action === "back");
            const hasCustomSkip = customBtns.some((b) => b.action === "skip");

            const showDefaultBack = !hasCustomBack && currentIdx > 0;
            const showDefaultExit = !hasCustomExit && step.showExitButton !== false;
            const showDefaultSkip = !hasCustomSkip && step.allowSkip;
            const showDefaultNext = !hasCustomNext;

            const customButtonsHtml = customBtns
              .map((btn, bIdx) => {
                const variantClass =
                  btn.variant === "primary"
                    ? "wj-button-primary"
                    : btn.variant === "danger"
                    ? "wj-button-danger"
                    : btn.variant === "success"
                    ? "wj-button-success"
                    : "wj-button-secondary";
                const icon = btn.action === "url" ? "↗ " : btn.action === "exit" ? "✕ " : "";
                return `<button class="wj-button ${variantClass} wj-custom-btn" data-btn-idx="${bIdx}" data-action="${escapeHtml(
                  btn.action
                )}" data-url="${escapeHtml(btn.url || "")}">
                  ${icon}${escapeHtml(btn.label)}
                </button>`;
              })
              .join("");

            return `
              <div class="wj-footer">
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                  ${showDefaultBack ? `<button class="wj-button wj-button-secondary" id="wj-back-btn">&larr; Back</button>` : ""}
                  ${showDefaultExit ? `<button class="wj-button wj-button-exit" id="wj-card-exit-btn">${escapeHtml(step.exitButtonLabel || "Exit")}</button>` : ""}
                </div>
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                  ${customButtonsHtml}
                  ${showDefaultSkip ? `<button class="wj-button wj-button-secondary" id="wj-skip-btn">Skip</button>` : ""}
                  ${showDefaultNext ? `<button class="wj-button wj-button-primary" id="wj-step-continue-btn">${step.action === "manual" ? "Continue &rarr;" : "Next &rarr;"}</button>` : ""}
                </div>
              </div>
            `;
          })()}
        </div>
      `;
      this.tooltipEl.style.display = "block";

      // Viewport Clamping: Card is ALWAYS 100% inside the viewport (portview)
      const cardWidth = Math.min(360, this.tooltipEl.offsetWidth || 360);
      const cardHeight = this.tooltipEl.offsetHeight || 240;
      const margin = 14;

      let top = rect.bottom + margin;
      let left = Math.max(margin, Math.min(rect.left, window.innerWidth - cardWidth - margin));

      if (top + cardHeight > window.innerHeight - margin) {
        const topAbove = rect.top - cardHeight - margin;
        if (topAbove >= margin) {
          top = topAbove;
        } else {
          if (rect.right + cardWidth + margin <= window.innerWidth) {
            left = rect.right + margin;
            top = Math.max(margin, Math.min(rect.top, window.innerHeight - cardHeight - margin));
          } else if (rect.left - cardWidth - margin >= margin) {
            left = rect.left - cardWidth - margin;
            top = Math.max(margin, Math.min(rect.top, window.innerHeight - cardHeight - margin));
          } else {
            top = Math.max(margin, window.innerHeight - cardHeight - margin);
          }
        }
      }

      // Hard clamp inside viewport boundaries
      top = Math.max(margin, Math.min(top, window.innerHeight - cardHeight - margin));
      left = Math.max(margin, Math.min(left, window.innerWidth - cardWidth - margin));

      this.tooltipEl.style.position = "fixed";
      this.tooltipEl.style.top = `${top}px`;
      this.tooltipEl.style.left = `${left}px`;
      this.tooltipEl.style.transform = "none";

      this.tooltipEl.querySelector("#wj-back-btn")?.addEventListener("click", () => {
        this.player.previousStep();
      });
      this.tooltipEl.querySelector("#wj-skip-btn")?.addEventListener("click", () => {
        this.player.skipStep();
      });
      this.tooltipEl.querySelector("#wj-step-continue-btn")?.addEventListener("click", () => {
        this.player.nextStep();
      });
      this.tooltipEl.querySelector("#wj-card-exit-btn")?.addEventListener("click", () => {
        this.player.stop();
        this.clearHighlight();
      });
      this.tooltipEl.querySelector("#wj-exit-tour-btn")?.addEventListener("click", () => {
        this.player.stop();
        this.clearHighlight();
      });

      // Custom button click handlers
      this.tooltipEl.querySelectorAll<HTMLButtonElement>(".wj-custom-btn").forEach((btnEl) => {
        btnEl.addEventListener("click", () => {
          const action = btnEl.getAttribute("data-action");
          const url = btnEl.getAttribute("data-url");

          if (action === "next") {
            this.player.nextStep();
          } else if (action === "back") {
            this.player.previousStep();
          } else if (action === "skip") {
            this.player.skipStep();
          } else if (action === "exit") {
            this.player.stop();
            this.clearHighlight();
          } else if (action === "url" && url) {
            window.open(url, "_blank");
          }
        });
      });
    }
  }

  public clearHighlight() {
    this.activeTargetEl = null;
    this.currentStep = null;
    if (this.highlightBox) this.highlightBox.style.display = "none";
    if (this.tooltipEl) this.tooltipEl.style.display = "none";
    this.hideBackdrop();
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
          this.showBackdrop();
          this.player.start(message.journey);
          sendResponse({ success: true });
          break;

        case "PLAYER_PAUSE":
          this.player.pause();
          sendResponse({ success: true });
          break;

        case "PLAYER_RESUME":
          this.showBackdrop();
          this.player.resume();
          sendResponse({ success: true });
          break;

        case "PLAYER_STOP":
          this.player.stop();
          this.clearHighlight();
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

const overlay = new WebJourneyOverlay();
(window as any).__webjourneyOverlay = overlay;

window.addEventListener("message", (event) => {
  if (event.data?.type === "WJ_TEST_HIGHLIGHT") {
    const el = document.querySelector(event.data.selector);
    if (el) {
      overlay.highlightStepTarget(el, event.data.step);
    }
  } else if (event.data?.type === "WJ_TEST_STOP") {
    overlay.clearHighlight();
  }
});

console.log("[WebJourney] Modern Colorful Overlay & Player active.");
