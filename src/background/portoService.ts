/**
 * Porto SDK integration service
 * Wraps Porto SDK functionality for use in extension context
 * Handles offscreen document management for WebAuthn
 */

import { PORTO_CONFIG, ERROR_MESSAGES } from "../utils/constants";
import type { MessageType } from "../types/messages";

/**
 * Porto Service class
 * Manages Porto SDK initialization, account operations, and transaction signing
 */
export class PortoService {
  private porto: any = null;
  private provider: any = null;
  private isInitialized: boolean = false;
  private offscreenDocumentPath: string = "offscreen.html";

  /**
   * Initialize Porto SDK
   * Creates Porto instance and sets up provider
   */
  async initialize(): Promise<void> {
    try {
      console.log("[PortoService] Initializing Porto SDK...");

      // TODO: Import and initialize Porto SDK
      // For Phase 1, we'll create a placeholder
      // In Phase 2, we'll integrate the actual Porto SDK

      this.isInitialized = true;
      console.log("[PortoService] Porto SDK initialized (placeholder)");
    } catch (error) {
      console.error("[PortoService] Failed to initialize Porto SDK:", error);
      throw new Error(ERROR_MESSAGES.PORTO_UNAVAILABLE);
    }
  }

  /**
   * Create a new account using WebAuthn
   * @param options - Account creation options
   * @returns Promise resolving to account address
   */
  async createAccount(options: {
    displayName?: string;
  }): Promise<{ address: string; credentialId: string; publicKey: string }> {
    try {
      console.log("[PortoService] Creating account...", options);

      // Ensure offscreen document exists for WebAuthn
      await this.ensureOffscreenDocument();

      // TODO: Phase 2 - Implement actual Porto account creation
      // For Phase 1, return placeholder data
      const placeholderAddress = this.generatePlaceholderAddress();

      console.log("[PortoService] Account created (placeholder):", placeholderAddress);

      return {
        address: placeholderAddress,
        credentialId: "placeholder_credential_id",
        publicKey: "placeholder_public_key",
      };
    } catch (error) {
      console.error("[PortoService] Failed to create account:", error);
      throw new Error(ERROR_MESSAGES.AUTH_FAILED);
    }
  }

  /**
   * Connect to existing account using WebAuthn
   * @returns Promise resolving to account addresses
   */
  async connectAccount(): Promise<{ accounts: string[] }> {
    try {
      console.log("[PortoService] Connecting to existing account...");

      // Ensure offscreen document exists for WebAuthn
      await this.ensureOffscreenDocument();

      // TODO: Phase 2 - Implement actual Porto account connection
      // For Phase 1, return placeholder
      const placeholderAddress = this.generatePlaceholderAddress();

      console.log("[PortoService] Account connected (placeholder):", placeholderAddress);

      return {
        accounts: [placeholderAddress],
      };
    } catch (error) {
      console.error("[PortoService] Failed to connect account:", error);
      throw new Error(ERROR_MESSAGES.AUTH_FAILED);
    }
  }

  /**
   * Sign a transaction using Porto
   * @param params - Transaction parameters
   * @returns Promise resolving to intent ID
   */
  async signTransaction(params: {
    calls: Array<{
      to: string;
      value: string;
      data: string;
    }>;
    chainId: string;
  }): Promise<string> {
    if (!this.isInitialized) {
      throw new Error("Porto service not initialized");
    }

    try {
      console.log("[PortoService] Signing transaction...", params);

      // Ensure offscreen document exists for WebAuthn
      await this.ensureOffscreenDocument();

      // TODO: Phase 2 - Implement actual transaction signing
      // 1. Call Porto Relay to prepare calls
      // 2. Request WebAuthn signature via offscreen document
      // 3. Send prepared calls with signature

      // For Phase 1, return placeholder
      const placeholderIntentId = `0x${Date.now().toString(16)}`;

      console.log("[PortoService] Transaction signed (placeholder):", placeholderIntentId);

      return placeholderIntentId;
    } catch (error) {
      console.error("[PortoService] Failed to sign transaction:", error);
      throw new Error(ERROR_MESSAGES.TX_FAILED);
    }
  }

  /**
   * Ensure offscreen document exists for WebAuthn
   * Chrome extensions require offscreen documents for WebAuthn in Manifest V3
   */
  private async ensureOffscreenDocument(): Promise<void> {
    try {
      // Check if offscreen API is available
      if (!chrome.offscreen) {
        console.warn("[PortoService] Offscreen API not available");
        return;
      }

      // Check if offscreen document already exists
      const hasDocument = await chrome.offscreen.hasDocument();

      if (!hasDocument) {
        console.log("[PortoService] Creating offscreen document...");

        await chrome.offscreen.createDocument({
          url: this.offscreenDocumentPath,
          reasons: [chrome.offscreen.Reason.USER_MEDIA],
          justification: "WebAuthn authentication for biometric wallet access",
        });

        console.log("[PortoService] Offscreen document created");
      }
    } catch (error) {
      console.error("[PortoService] Failed to ensure offscreen document:", error);
      // Don't throw - fallback to popup-based WebAuthn if needed
    }
  }

  /**
   * Close offscreen document if it exists
   */
  async closeOffscreenDocument(): Promise<void> {
    try {
      if (chrome.offscreen) {
        const hasDocument = await chrome.offscreen.hasDocument();
        if (hasDocument) {
          await chrome.offscreen.closeDocument();
          console.log("[PortoService] Offscreen document closed");
        }
      }
    } catch (error) {
      console.error("[PortoService] Failed to close offscreen document:", error);
    }
  }

  /**
   * Request WebAuthn signature via offscreen document
   * @param digest - Message digest to sign
   * @returns Promise resolving to signature
   */
  private async requestWebAuthnSignature(digest: string): Promise<string> {
    try {
      // Send message to offscreen document
      const response = await chrome.runtime.sendMessage({
        type: "WEBAUTHN_GET" as MessageType,
        payload: {
          challenge: new TextEncoder().encode(digest),
        },
      });

      if (!response.success) {
        throw new Error(response.error || "WebAuthn failed");
      }

      // Extract signature from credential
      const signature = this.extractSignature(response.credential);
      return signature;
    } catch (error) {
      console.error("[PortoService] WebAuthn signature failed:", error);
      throw error;
    }
  }

  /**
   * Extract signature from WebAuthn credential
   * @param credential - PublicKeyCredential from WebAuthn
   * @returns Hex-encoded signature
   */
  private extractSignature(credential: any): string {
    try {
      const signature = new Uint8Array(credential.response.signature);
      return (
        "0x" +
        Array.from(signature)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
      );
    } catch (error) {
      console.error("[PortoService] Failed to extract signature:", error);
      throw new Error("Failed to extract WebAuthn signature");
    }
  }

  /**
   * Generate placeholder Ethereum address for Phase 1 testing
   * @returns Placeholder Ethereum address
   */
  private generatePlaceholderAddress(): string {
    const randomBytes = new Uint8Array(20);
    crypto.getRandomValues(randomBytes);
    return (
      "0x" +
      Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  /**
   * Check if Porto is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get provider instance
   * @returns EIP-1193 provider or null
   */
  getProvider(): any | null {
    return this.provider;
  }
}

/**
 * Singleton instance of PortoService
 */
export const portoService = new PortoService();
