/**
 * Offscreen WebAuthn Handler
 * Handles WebAuthn ceremonies in isolated context
 * Required for Manifest V3 extensions
 */

console.log("[Offscreen] WebAuthn handler initialized");

// TODO: Phase 2 - Implement WebAuthn ceremonies
// - createPasskey()
// - getPasskey()
// - Handle messages from background script

// Placeholder for Phase 1
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Offscreen] Received message:", message.type);

  if (message.type === "WEBAUTHN_CREATE") {
    console.log("[Offscreen] WebAuthn create requested (not yet implemented)");
    sendResponse({
      success: false,
      error: "WebAuthn not implemented in Phase 1",
    });
    return false;
  }

  if (message.type === "WEBAUTHN_GET") {
    console.log("[Offscreen] WebAuthn get requested (not yet implemented)");
    sendResponse({
      success: false,
      error: "WebAuthn not implemented in Phase 1",
    });
    return false;
  }

  return false;
});
