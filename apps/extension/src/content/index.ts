import {
  JourneyPlayer,
  generateUniqueSelector,
  generateElementBreadcrumb,
  type PlayerContext
} from "@webjourney/step-engine";
import type {
  Journey,
  StepDefinition,
  JourneyThemeKey
} from "@webjourney/journey-schema";

const RUN_STORAGE_KEY = "webjourney_active_run";

const THEME_PALETTES: Record<string, { name: string; primary: string; gradient: string; accent: string; lightBg: string; text: string }> = {
  indigo: { name: "Royal Indigo", primary: "#4f46e5", gradient: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)", accent: "#4f46e5", lightBg: "#eef2ff", text: "#4338ca" },
  emerald: { name: "Emerald Mint", primary: "#059669", gradient: "linear-gradient(135deg, #059669 0%, #10b981 100%)", accent: "#059669", lightBg: "#ecfdf5", text: "#047857" },
  violet: { name: "Electric Violet", primary: "#7c3aed", gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", accent: "#7c3aed", lightBg: "#f5f3ff", text: "#6d28d9" },
  amber: { name: "Sunset Amber", primary: "#d97706", gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", accent: "#d97706", lightBg: "#fffbeb", text: "#b45309" },
  rose: { name: "Crimson Rose", primary: "#e11d48", gradient: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)", accent: "#e11d48", lightBg: "#fff1f2", text: "#be123c" }
};

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

const WEBJOURNEY_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 320 330" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle; flex-shrink: 0; display: inline-block;">
<defs>
  <linearGradient id="wj-sun" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#FFC23F"/><stop offset="1" stop-color="#FF8523"/></linearGradient>
  <linearGradient id="wj-trail" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#087F72"/></linearGradient>
</defs>
<path d="M161 32 C110 28 70 68 69 117 C67 156 88 182 113 210 L158 254 Q162 258 167 253 L211 209 C238 179 258 151 256 117 C254 68 214 32 161 32 Z" fill="url(#wj-sun)"/>
<path d="M102 162 C98 176 89 185 60 194 C18 207 8 227 23 248 C30 258 48 266 76 275 L178 308 C195 314 220 316 236 314 C228 299 210 287 186 279 L88 249 C53 239 43 232 69 223 L117 208 C146 198 155 174 138 156 C127 145 109 147 102 162 Z" fill="url(#wj-trail)"/>
<path d="M97 125 L193 70 C200 66 208 72 205 80 L166 190 C163 198 155 199 149 191 L125 161 L101 186 C94 193 83 189 84 179 L88 145 L98 142 C87 140 87 130 97 125 Z" fill="#F7FCF5" stroke="#F7FCF5" stroke-width="8" stroke-linejoin="round"/>
<path d="M104 132 L195 80 L158 181 L129 151 L95 177 L100 138 Z" fill="#087F72" stroke="#087F72" stroke-width="2" stroke-linejoin="round"/>
<path d="M245 17 Q248 36 264 40 Q249 44 245 64 Q240 45 225 40 Q240 36 245 17 Z" fill="url(#wj-sun)"/>
<path d="M281 58 Q283 71 295 74 Q284 77 281 91 Q278 78 267 74 Q278 71 281 58 Z" fill="url(#wj-trail)"/>
</svg>`;

class WebJourneyOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private backdropEl: HTMLElement | null = null;
  private highlightBox: HTMLElement | null = null;
  private tooltipEl: HTMLElement | null = null;
  private launcherEl: HTMLButtonElement | null = null;
  private checklistEl: HTMLDivElement | null = null;
  private launcherEnabled: boolean = true;
  private launcherPosition: "bottom-right" | "bottom-left" = "bottom-right";
  private completedJourneyIds: Set<string> = new Set();
  private availableJourneys: Journey[] = [];
  private isChecklistOpen: boolean = false;
  private activeTargetEl: Element | null = null;
  private currentStep: StepDefinition | null = null;
  private isInspecting: boolean = false;
  private rafId: number | null = null;
  private confettiCanvas: HTMLCanvasElement | null = null;
  private confettiAnimationId: number | null = null;
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
    this.initStorageListener();
    this.refreshAvailableJourneys();
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
        overflow: visible;
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
        border-radius: 14px 14px 0 0;
      }
      .wj-tooltip-arrow {
        position: absolute;
        width: 12px;
        height: 12px;
        background: #ffffff;
        transform: rotate(45deg);
        pointer-events: none;
        z-index: 2;
        transition: all 0.15s ease;
      }
      .wj-tooltip-arrow-bottom {
        top: -6px;
        background: #4f46e5;
        border-top-left-radius: 2px;
      }
      .wj-tooltip-arrow-top {
        bottom: -6px;
        background: #ffffff;
        border-right: 1px solid rgba(226, 232, 240, 0.9);
        border-bottom: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 2px 2px 4px rgba(15, 23, 42, 0.06);
      }
      .wj-tooltip-arrow-right {
        left: -6px;
        background: #ffffff;
        border-left: 1px solid rgba(226, 232, 240, 0.9);
        border-bottom: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: -2px 2px 4px rgba(15, 23, 42, 0.06);
      }
      .wj-tooltip-arrow-left {
        right: -6px;
        background: #ffffff;
        border-right: 1px solid rgba(226, 232, 240, 0.9);
        border-top: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 2px -2px 4px rgba(15, 23, 42, 0.06);
      }
      .wj-confetti-canvas {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 2147483646;
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
      /* In-Page Launcher & Checklist Styles */
      .wj-launcher-btn {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: none;
        align-items: center;
        gap: 8px;
        padding: 9px 16px;
        background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        border-radius: 9999px;
        border: none;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4), 0 8px 10px -6px rgba(79, 70, 229, 0.2);
        z-index: 2147483641;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
      }
      .wj-launcher-btn:hover {
        transform: translateY(-2px) scale(1.02);
        box-shadow: 0 14px 28px -5px rgba(79, 70, 229, 0.5), 0 10px 10px -5px rgba(79, 70, 229, 0.3);
      }
      .wj-launcher-btn:active {
        transform: translateY(0) scale(0.98);
      }
      .wj-launcher-btn.wj-launcher-bottom-left {
        left: 24px;
        right: auto;
      }
      .wj-launcher-icon {
        font-size: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .wj-launcher-count {
        background: rgba(255, 255, 255, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.4);
        font-size: 11px;
        font-weight: 700;
        padding: 1px 7px;
        border-radius: 9999px;
        margin-left: 2px;
      }
      .wj-checklist-card {
        position: fixed;
        bottom: 74px;
        right: 24px;
        width: 340px;
        max-width: calc(100vw - 48px);
        background: #ffffff;
        color: #0f172a;
        border-radius: 16px;
        box-shadow: 0 20px 40px -8px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(226, 232, 240, 0.9);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        pointer-events: auto;
        z-index: 2147483642;
        display: none;
        animation: wjPopoverIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .wj-checklist-card.wj-checklist-bottom-left {
        left: 24px;
        right: auto;
      }
      @keyframes wjPopoverIn {
        from { opacity: 0; transform: translateY(12px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .wj-checklist-header {
        padding: 14px 16px 12px;
        background: #ffffff;
        border-bottom: 1px solid #f1f5f9;
      }
      .wj-checklist-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .wj-checklist-title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .wj-checklist-desc {
        margin: 0 0 10px;
        font-size: 12px;
        color: #64748b;
        line-height: 1.4;
      }
      .wj-checklist-progress-text {
        font-size: 11px;
        color: #475569;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
      }
      .wj-checklist-progress-bar-bg {
        width: 100%;
        height: 6px;
        background: #f1f5f9;
        border-radius: 9999px;
        overflow: hidden;
        margin-top: 5px;
      }
      .wj-checklist-progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #4f46e5 0%, #10b981 100%);
        border-radius: 9999px;
        transition: width 0.3s ease;
      }
      .wj-checklist-body {
        max-height: 280px;
        overflow-y: auto;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wj-checklist-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        transition: all 0.15s ease;
        cursor: pointer;
        text-decoration: none;
      }
      .wj-checklist-item:hover {
        background: #ffffff;
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08);
        transform: translateY(-1px);
      }
      .wj-checklist-item-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: 1;
        min-width: 0;
        margin-right: 10px;
      }
      .wj-checklist-item-title {
        font-size: 12.5px;
        font-weight: 600;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wj-checklist-item-meta {
        font-size: 11px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .wj-checklist-status-icon {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        flex-shrink: 0;
      }
      .wj-checklist-status-completed {
        background: #ecfdf5;
        color: #059669;
        border: 1.5px solid #a7f3d0;
      }
      .wj-checklist-status-pending {
        background: #eef2ff;
        color: #4f46e5;
        border: 1.5px solid #c7d2fe;
      }
      .wj-checklist-footer {
        padding: 8px 16px;
        background: #f8fafc;
        border-top: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        color: #94a3b8;
      }
    `;
    this.shadow.appendChild(style);

    this.backdropEl = document.createElement("div");
    this.backdropEl.className = "wj-backdrop";
    this.backdropEl.style.display = "none";
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

    this.checklistEl = document.createElement("div");
    this.checklistEl.className = "wj-checklist-card";
    this.checklistEl.style.display = "none";
    this.shadow.appendChild(this.checklistEl);

    this.launcherEl = document.createElement("button");
    this.launcherEl.className = "wj-launcher-btn";
    this.launcherEl.style.display = "none";
    this.launcherEl.setAttribute("type", "button");
    this.launcherEl.setAttribute("aria-label", "WebJourney Guides");
    this.launcherEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleChecklist();
    });
    this.shadow.appendChild(this.launcherEl);

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
    this.updateLauncherVisibility(false);
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
    this.updateLauncherVisibility(true);
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
      this.stopConfetti();
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

  private getJourneyTheme(journey?: Journey | null) {
    const key = (journey?.themeColor || "indigo") as JourneyThemeKey;
    return THEME_PALETTES[key] || THEME_PALETTES.indigo;
  }

  private fireConfetti() {
    this.stopConfetti();
    if (!this.shadow) return;

    this.confettiCanvas = document.createElement("canvas");
    this.confettiCanvas.className = "wj-confetti-canvas";
    this.confettiCanvas.width = window.innerWidth;
    this.confettiCanvas.height = window.innerHeight;
    this.shadow.appendChild(this.confettiCanvas);

    const ctx = this.confettiCanvas.getContext("2d");
    if (!ctx) return;

    const theme = this.getJourneyTheme(this.player.getContext().journey);
    const colors = [
      theme.primary,
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ec4899",
      "#8b5cf6",
      "#06b6d4"
    ];

    const particleCount = 75;
    const particles: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
      rotation: number;
      vRot: number;
      opacity: number;
    }> = [];

    const originX = window.innerWidth / 2;
    const originY = window.innerHeight / 2 - 30;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 9 + 4;
      particles.push({
        x: originX,
        y: originY,
        w: Math.random() * 8 + 6,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3 - Math.random() * 4,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 14,
        opacity: 1
      });
    }

    const startTime = performance.now();
    const duration = 3400;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed > duration || !this.confettiCanvas) {
        this.stopConfetti();
        return;
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.24; // gravity
        p.vx *= 0.985; // air drag
        p.rotation += p.vRot;

        if (elapsed > duration - 800) {
          p.opacity = Math.max(0, (duration - elapsed) / 800);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      this.confettiAnimationId = requestAnimationFrame(animate);
    };

    this.confettiAnimationId = requestAnimationFrame(animate);
  }

  private stopConfetti() {
    if (this.confettiAnimationId) {
      cancelAnimationFrame(this.confettiAnimationId);
      this.confettiAnimationId = null;
    }
    if (this.confettiCanvas) {
      this.confettiCanvas.remove();
      this.confettiCanvas = null;
    }
  }

  public renderCompletionCard(journey: Journey) {
    if (!this.tooltipEl) return;

    this.showBackdrop();
    this.updateBackdropSpotlight();

    if (this.highlightBox) {
      this.highlightBox.style.display = "none";
    }

    const theme = this.getJourneyTheme(journey);
    this.tooltipEl.querySelector(".wj-tooltip-arrow")?.remove();
    this.fireConfetti();

    this.completedJourneyIds.add(journey.id);
    if (chrome.storage?.local) {
      chrome.storage.local.set({
        webjourney_completed_journeys: Array.from(this.completedJourneyIds)
      });
    }

    this.tooltipEl.innerHTML = `
      <div class="wj-card-accent-bar" style="background: ${theme.gradient};"></div>
      <div class="wj-card-inner">
        <div class="wj-tooltip-header">
          <span class="wj-badge" style="background: ${theme.lightBg}; color: ${theme.text}; border: 1px solid ${theme.primary}30;">Walkthrough Finished</span>
          <button id="wj-finish-close-btn" class="wj-close-btn" title="Close">&times;</button>
        </div>
        <h4 class="wj-title" style="margin-top: 6px;">🎉 You Did It!</h4>
        <div class="wj-instruction">
          You have successfully completed <strong>${escapeHtml(journey.name)}</strong> (${journey.steps.length} steps).
        </div>
        <div class="wj-footer" style="justify-content: flex-end;">
          <button class="wj-button" id="wj-finish-btn" style="background: ${theme.gradient};">Complete & Close</button>
        </div>
      </div>
    `;

    this.tooltipEl.style.position = "fixed";
    this.tooltipEl.style.display = "block";
    this.tooltipEl.style.top = "50%";
    this.tooltipEl.style.left = "50%";
    this.tooltipEl.style.transform = "translate(-50%, -50%)";

    const closeHandler = () => {
      this.stopConfetti();
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
      const theme = this.getJourneyTheme(this.player.getContext().journey);

      this.tooltipEl.innerHTML = `
        <div class="wj-card-accent-bar" style="background: ${theme.gradient};"></div>
        <div class="wj-card-inner">
          <div class="wj-tooltip-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="wj-step-counter" style="color: ${theme.accent}; background: ${theme.lightBg}; border-color: ${theme.primary}40;">
                Step ${currentIdx + 1} of ${totalSteps}
              </span>
              <span class="wj-badge" style="background: ${actionStyle.bg}; color: ${actionStyle.text};">
                ${actionStyle.icon} ${escapeHtml(step.action)}
              </span>
            </div>
            <button id="wj-exit-tour-btn" class="wj-close-btn" title="Exit Tour">&times;</button>
          </div>
          <div class="wj-progress-track">
            <div class="wj-progress-fill" style="width: ${pct}%; background: ${theme.gradient};"></div>
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
                const customStyle = btn.variant === "primary" ? `style="background: ${theme.gradient};"` : "";
                const icon = btn.action === "url" ? "↗ " : btn.action === "exit" ? "✕ " : "";
                return `<button class="wj-button ${variantClass} wj-custom-btn" ${customStyle} data-btn-idx="${bIdx}" data-action="${escapeHtml(
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
                  ${showDefaultNext ? `<button class="wj-button wj-button-primary" id="wj-step-continue-btn" style="background: ${theme.gradient};">${step.action === "manual" ? "Continue &rarr;" : "Next &rarr;"}</button>` : ""}
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
      let placement: "bottom" | "top" | "right" | "left" = "bottom";

      if (top + cardHeight > window.innerHeight - margin) {
        const topAbove = rect.top - cardHeight - margin;
        if (topAbove >= margin) {
          top = topAbove;
          placement = "top";
        } else {
          if (rect.right + cardWidth + margin <= window.innerWidth) {
            left = rect.right + margin;
            top = Math.max(margin, Math.min(rect.top, window.innerHeight - cardHeight - margin));
            placement = "right";
          } else if (rect.left - cardWidth - margin >= margin) {
            left = rect.left - cardWidth - margin;
            top = Math.max(margin, Math.min(rect.top, window.innerHeight - cardHeight - margin));
            placement = "left";
          } else {
            top = Math.max(margin, window.innerHeight - cardHeight - margin);
            placement = "bottom";
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

      // Adaptive Dynamic Tooltip Pointer Arrow
      let arrowEl = this.tooltipEl.querySelector<HTMLDivElement>(".wj-tooltip-arrow");
      if (!arrowEl) {
        arrowEl = document.createElement("div");
        arrowEl.className = "wj-tooltip-arrow";
        this.tooltipEl.appendChild(arrowEl);
      }

      arrowEl.className = `wj-tooltip-arrow wj-tooltip-arrow-${placement}`;

      if (placement === "bottom" || placement === "top") {
        const targetCenterX = rect.left + rect.width / 2;
        const arrowX = Math.max(20, Math.min(cardWidth - 32, targetCenterX - left - 6));
        arrowEl.style.left = `${arrowX}px`;
        arrowEl.style.top = placement === "bottom" ? "-6px" : "";
        arrowEl.style.bottom = placement === "top" ? "-6px" : "";
        arrowEl.style.right = "";
        arrowEl.style.background = placement === "bottom" ? theme.accent : "#ffffff";
      } else {
        const targetCenterY = rect.top + rect.height / 2;
        const arrowY = Math.max(20, Math.min(cardHeight - 32, targetCenterY - top - 6));
        arrowEl.style.top = `${arrowY}px`;
        arrowEl.style.left = placement === "right" ? "-6px" : "";
        arrowEl.style.right = placement === "left" ? "-6px" : "";
        arrowEl.style.bottom = "";
        arrowEl.style.background = "#ffffff";
      }

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
    if (this.tooltipEl) {
      this.tooltipEl.style.display = "none";
      this.tooltipEl.querySelector(".wj-tooltip-arrow")?.remove();
    }
    this.stopConfetti();
    this.hideBackdrop();
    this.updateLauncherVisibility(true);
    this.refreshAvailableJourneys();
  }

  private initStorageListener() {
    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local") {
          if (
            changes.webjourney_launcher_enabled ||
            changes.webjourney_launcher_position ||
            changes.webjourney_completed_journeys ||
            changes.webjourney_invitations ||
            changes.webjourney_local_draft
          ) {
            this.refreshAvailableJourneys();
          }
        }
      });
    }
  }

  public refreshAvailableJourneys() {
    if (!chrome.storage?.local) {
      this.checkFallbackSample();
      return;
    }

    chrome.storage.local.get([
      "webjourney_launcher_enabled",
      "webjourney_launcher_position",
      "webjourney_completed_journeys",
      "webjourney_invitations",
      "webjourney_local_draft"
    ], (res) => {
      this.launcherEnabled = res.webjourney_launcher_enabled !== false;
      this.launcherPosition = res.webjourney_launcher_position || "bottom-right";
      const completed: string[] = res.webjourney_completed_journeys || [];
      this.completedJourneyIds = new Set(completed);

      const list: Journey[] = [];
      const currentOrigin = window.location.origin;
      const currentUrl = window.location.href;

      const invites = res.webjourney_invitations || {};
      for (const code of Object.keys(invites)) {
        const j = invites[code]?.journeySnapshot;
        if (j && j.steps && j.steps.length > 0) {
          const matchOrigin = (j.allowedOrigins || []).some((o: string) =>
            currentOrigin.startsWith(o) || o.startsWith(currentOrigin)
          );
          const matchUrl = j.startUrl && (currentUrl.includes(j.startUrl) || j.startUrl.includes(currentOrigin));
          if (matchOrigin || matchUrl) {
            if (!list.some((item) => item.id === j.id)) {
              list.push(j);
            }
          }
        }
      }

      const draft: Journey = res.webjourney_local_draft;
      if (draft && draft.steps && draft.steps.length > 0) {
        const matchOrigin = (draft.allowedOrigins || []).some((o: string) =>
          currentOrigin.startsWith(o) || o.startsWith(currentOrigin)
        );
        const matchUrl = draft.startUrl && (currentUrl.includes(draft.startUrl) || draft.startUrl.includes(currentOrigin));
        if ((matchOrigin || matchUrl) && !list.some((item) => item.id === draft.id)) {
          list.push(draft);
        }
      }

      // Default sample for codevioso.com if no stored journey
      if (list.length === 0 && (currentUrl.includes("codevioso.com") || currentOrigin.includes("codevioso.com"))) {
        list.push({
          schemaVersion: 1,
          id: "11111111-2222-3333-4444-555555555555",
          name: "Codevioso Website Onboarding Tour",
          description: "Interactive guided tour of Codevioso web services, digital products, and contact channels.",
          themeColor: "emerald",
          allowedOrigins: ["https://codevioso.com"],
          startUrl: "https://codevioso.com/",
          createdAt: "2026-09-19T12:00:00.000Z",
          updatedAt: "2026-09-19T12:00:00.000Z",
          steps: [
            {
              id: "step-1",
              order: 0,
              title: "Welcome to Codevioso",
              instruction: "Welcome! Codevioso delivers high-grade software solutions. Click the logo or continue.",
              action: "click",
              target: {
                selectorCandidates: ["header > div:nth-of-type(1) > a", "#cv-nav a.cv-nav__logo", "header a[href*='codevioso.com']"],
                tagName: "a",
                textContentSnippet: "Codevioso"
              },
              timeoutMs: 30000,
              allowSkip: true,
              showExitButton: true
            },
            {
              id: "step-2",
              order: 1,
              title: "Discover Tailored Services",
              instruction: "Review engineering expertise across web applications, scalable APIs, and bespoke systems.",
              action: "click",
              target: {
                selectorCandidates: ["header > div:nth-of-type(1) > nav > ul > li:nth-of-type(2) > a", "nav a[href*='services']"],
                tagName: "a",
                textContentSnippet: "Services"
              },
              timeoutMs: 30000,
              allowSkip: true,
              showExitButton: true
            }
          ]
        });
      }

      this.availableJourneys = list;
      this.updateLauncherAndChecklist();
    });
  }

  private checkFallbackSample() {
    const currentOrigin = window.location.origin;
    const currentUrl = window.location.href;
    if (currentUrl.includes("codevioso.com") || currentOrigin.includes("codevioso.com")) {
      this.availableJourneys = [{
        schemaVersion: 1,
        id: "11111111-2222-3333-4444-555555555555",
        name: "Codevioso Website Onboarding Tour",
        description: "Interactive guided tour of Codevioso web services, digital products, and contact channels.",
        themeColor: "emerald",
        allowedOrigins: ["https://codevioso.com"],
        startUrl: "https://codevioso.com/",
        createdAt: "2026-09-19T12:00:00.000Z",
        updatedAt: "2026-09-19T12:00:00.000Z",
        steps: [
          {
            id: "step-1",
            order: 0,
            title: "Welcome to Codevioso",
            instruction: "Welcome! Codevioso delivers high-grade software solutions. Click the logo or continue.",
            action: "click",
            target: {
              selectorCandidates: ["header > div:nth-of-type(1) > a", "#cv-nav a.cv-nav__logo", "header a[href*='codevioso.com']"],
              tagName: "a",
              textContentSnippet: "Codevioso"
            },
            timeoutMs: 30000,
            allowSkip: true,
            showExitButton: true
          }
        ]
      }];
      this.updateLauncherAndChecklist();
    }
  }

  public updateLauncherVisibility(visible: boolean) {
    if (!this.launcherEl) return;
    if (!visible || !this.launcherEnabled || this.player.getState() !== "idle") {
      this.launcherEl.style.display = "none";
      if (this.checklistEl) this.checklistEl.style.display = "none";
      this.isChecklistOpen = false;
    } else {
      if (this.availableJourneys.length > 0) {
        this.launcherEl.style.display = "flex";
      }
    }
  }

  public updateLauncherAndChecklist() {
    if (!this.shadow) return;

    if (!this.launcherEnabled || this.availableJourneys.length === 0) {
      if (this.launcherEl) this.launcherEl.style.display = "none";
      if (this.checklistEl) this.checklistEl.style.display = "none";
      return;
    }

    if (!this.launcherEl) {
      this.launcherEl = document.createElement("button");
      this.launcherEl.className = "wj-launcher-btn";
      this.launcherEl.setAttribute("type", "button");
      this.launcherEl.setAttribute("aria-label", "WebJourney Guides");
      this.launcherEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleChecklist();
      });
      this.shadow.appendChild(this.launcherEl);
    }

    this.launcherEl.className = `wj-launcher-btn ${
      this.launcherPosition === "bottom-left" ? "wj-launcher-bottom-left" : ""
    }`;

    const completedCount = this.availableJourneys.filter((j) => this.completedJourneyIds.has(j.id)).length;
    const totalCount = this.availableJourneys.length;

    this.launcherEl.innerHTML = `
      <span class="wj-launcher-icon">${WEBJOURNEY_ICON_SVG}</span>
      <span>Guides</span>
      <span class="wj-launcher-count">${completedCount > 0 ? `✓ ${completedCount}/${totalCount}` : `${totalCount}`}</span>
    `;

    if (this.player.getState() === "idle" && (!this.backdropEl || this.backdropEl.style.display === "none" || this.backdropEl.style.display === "")) {
      this.launcherEl.style.display = "flex";
    } else {
      this.launcherEl.style.display = "none";
    }

    if (!this.checklistEl) {
      this.checklistEl = document.createElement("div");
      this.checklistEl.className = "wj-checklist-card";
      this.shadow.appendChild(this.checklistEl);
    }

    this.checklistEl.className = `wj-checklist-card ${
      this.launcherPosition === "bottom-left" ? "wj-checklist-bottom-left" : ""
    }`;

    if (this.isChecklistOpen) {
      this.renderChecklist();
    }
  }

  public openChecklist() {
    this.isChecklistOpen = true;
    this.renderChecklist();
  }

  public closeChecklist() {
    this.isChecklistOpen = false;
    if (this.checklistEl) {
      this.checklistEl.style.display = "none";
    }
  }

  public toggleChecklist() {
    if (this.isChecklistOpen) {
      this.closeChecklist();
    } else {
      this.openChecklist();
    }
  }

  private renderChecklist() {
    if (!this.checklistEl) return;

    const totalCount = this.availableJourneys.length;
    const completedCount = this.availableJourneys.filter((j) => this.completedJourneyIds.has(j.id)).length;
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    this.checklistEl.innerHTML = `
      <div class="wj-card-accent-bar" style="background: linear-gradient(90deg, #4f46e5 0%, #10b981 100%);"></div>
      <div class="wj-checklist-header">
        <div class="wj-checklist-header-top">
          <h3 class="wj-checklist-title">
            ${WEBJOURNEY_ICON_SVG} Interactive Guides
          </h3>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${completedCount > 0 ? '<button id="wj-reset-progress-btn" class="wj-badge" style="background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; cursor: pointer;" title="Reset progress for testing">↺ Reset</button>' : ''}
            <button id="wj-checklist-close-btn" class="wj-close-btn" title="Close Checklist">&times;</button>
          </div>
        </div>
        <p class="wj-checklist-desc">Interactive step-by-step guides to help you navigate this site.</p>
        <div class="wj-checklist-progress-text">
          <span>Overall Progress</span>
          <span>${completedCount} of ${totalCount} completed (${percent}%)</span>
        </div>
        <div class="wj-checklist-progress-bar-bg">
          <div class="wj-checklist-progress-bar-fill" style="width: ${percent}%;"></div>
        </div>
      </div>
      <div class="wj-checklist-body">
        ${
          this.availableJourneys.map((j) => {
            const isDone = this.completedJourneyIds.has(j.id);
            const theme = this.getJourneyTheme(j);
            return `
              <div class="wj-checklist-item" data-journey-id="${j.id}">
                <div class="wj-checklist-status-icon ${isDone ? 'wj-checklist-status-completed' : 'wj-checklist-status-pending'}" style="${!isDone ? `border-color: ${theme.primary}50; background: ${theme.lightBg}; color: ${theme.text};` : ''}">
                  ${isDone ? "✓" : "▶"}
                </div>
                <div class="wj-checklist-item-info">
                  <div class="wj-checklist-item-title">${escapeHtml(j.name)}</div>
                  <div class="wj-checklist-item-meta">
                    <span>${j.steps.length} ${j.steps.length === 1 ? 'step' : 'steps'}</span>
                    <span>•</span>
                    <span style="color: ${theme.text}; font-weight: 600;">${theme.name || 'Theme'}</span>
                  </div>
                </div>
                <button class="wj-button ${isDone ? 'wj-button-secondary' : ''}" style="${!isDone ? `background: ${theme.gradient};` : ''} padding: 5px 10px; font-size: 11px;">
                  ${isDone ? "Replay" : "Start"}
                </button>
              </div>
            `;
          }).join("")
        }
      </div>
      <div class="wj-checklist-footer">
        <span style="display: flex; align-items: center; gap: 6px;">
          ${WEBJOURNEY_ICON_SVG}
          <strong style="color: #475569;">WebJourney</strong>
        </span>
        <span style="font-size: 10px;">${window.location.hostname}</span>
      </div>
    `;

    this.checklistEl.style.display = "block";

    this.checklistEl.querySelector("#wj-checklist-close-btn")?.addEventListener("click", () => {
      this.closeChecklist();
    });

    this.checklistEl.querySelector("#wj-reset-progress-btn")?.addEventListener("click", () => {
      this.resetProgress();
    });

    const items = this.checklistEl.querySelectorAll<HTMLDivElement>(".wj-checklist-item");
    items.forEach((item) => {
      item.addEventListener("click", () => {
        const id = item.getAttribute("data-journey-id");
        const found = this.availableJourneys.find((j) => j.id === id);
        if (found) {
          this.closeChecklist();
          this.showBackdrop();
          this.player.start(found);
        }
      });
    });
  }

  public resetProgress() {
    this.completedJourneyIds.clear();
    if (chrome.storage?.local) {
      chrome.storage.local.set({ webjourney_completed_journeys: [] }, () => {
        this.renderChecklist();
        this.updateLauncherAndChecklist();
      });
    } else {
      this.renderChecklist();
      this.updateLauncherAndChecklist();
    }
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

        case "OPEN_LAUNCHER_CHECKLIST":
          this.openChecklist();
          sendResponse({ success: true });
          break;

        case "CLOSE_LAUNCHER_CHECKLIST":
          this.closeChecklist();
          sendResponse({ success: true });
          break;

        case "RESET_CHECKLIST_PROGRESS":
          this.resetProgress();
          sendResponse({ success: true });
          break;

        case "GET_LAUNCHER_STATE":
          sendResponse({
            enabled: this.launcherEnabled,
            position: this.launcherPosition,
            availableCount: this.availableJourneys.length,
            completedCount: this.availableJourneys.filter((j) => this.completedJourneyIds.has(j.id)).length,
            isOpen: this.isChecklistOpen
          });
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
  } else if (event.data?.type === "WJ_TEST_COMPLETION") {
    if (event.data.journey) {
      overlay.renderCompletionCard(event.data.journey);
    }
  } else if (event.data?.type === "WJ_TEST_LAUNCHER_OPEN") {
    overlay.openChecklist();
  } else if (event.data?.type === "WJ_TEST_LAUNCHER_CLOSE") {
    overlay.closeChecklist();
  } else if (event.data?.type === "WJ_TEST_RESET_PROGRESS") {
    overlay.resetProgress();
  } else if (event.data?.type === "WJ_TEST_STOP") {
    overlay.clearHighlight();
  }
});

console.log("[WebJourney] Modern Colorful Overlay & Player active.");
