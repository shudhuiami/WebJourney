import type { ExtensionMessage, MessageResponse } from "./types";

/**
 * Send a message from Side Panel / Popup to active tab's Content Script with automatic retry.
 */
export async function sendTabMessage<T = any>(
  tabId: number,
  message: ExtensionMessage,
  maxRetries = 2
): Promise<MessageResponse<T>> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      return response || { success: true };
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) {
        return {
          success: false,
          error: err?.message || "Failed to communicate with tab content script."
        };
      }
      // Small backoff before retry (e.g. while service worker or content script wakes up)
      await new Promise((res) => setTimeout(res, 150));
    }
  }
  return { success: false, error: "Exceeded max message retries." };
}

/**
 * Broadcast a message to runtime (background or open extension views).
 */
export async function sendRuntimeMessage<T = any>(
  message: ExtensionMessage
): Promise<MessageResponse<T>> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response || { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Runtime message failed."
    };
  }
}
