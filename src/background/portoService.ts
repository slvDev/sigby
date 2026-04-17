/**
 * Porto Service (Background)
 *
 * NOTE: Porto SDK runs ONLY in the popup context because WebAuthn requires
 * a visible UI for biometric prompts. This service is a stub that provides
 * clear error messages if called incorrectly.
 *
 * For actual Porto operations, use src/popup/portoService.ts
 */

/**
 * Porto Service stub for background context
 * All actual Porto operations happen in popup via popup/portoService.ts
 */
export class PortoService {
  private isInitialized: boolean = false;

  /**
   * Initialize Porto Service
   * In background context, this is a no-op since Porto runs in popup
   */
  async initialize(): Promise<void> {
    console.log("[Berth:BG] Porto SDK stub initialized — real SDK runs in popup context");
    this.isInitialized = true;
  }

  /**
   * Create account - NOT available in background
   * @throws Error directing to use popup
   */
  async createAccount(_options: { displayName?: string }): Promise<never> {
    throw new Error(
      "Porto SDK operations must be performed in popup context. " +
      "WebAuthn requires a visible UI for biometric prompts."
    );
  }

  /**
   * Connect account - NOT available in background
   * @throws Error directing to use popup
   */
  async connectAccount(): Promise<never> {
    throw new Error(
      "Porto SDK operations must be performed in popup context. " +
      "WebAuthn requires a visible UI for biometric prompts."
    );
  }

  /**
   * Sign transaction - NOT available in background
   * @throws Error directing to use popup
   */
  async signTransaction(_params: {
    calls: Array<{ to: string; value: string; data: string }>;
    chainId: string;
  }): Promise<never> {
    throw new Error(
      "Porto SDK operations must be performed in popup context. " +
      "WebAuthn requires a visible UI for biometric prompts."
    );
  }

  /**
   * Close offscreen document - no-op since we don't use offscreen
   */
  async closeOffscreenDocument(): Promise<void> {
    // No-op - offscreen document removed
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get provider instance - not available in background
   */
  getProvider(): null {
    console.warn("[Berth:BG] Provider not available in background — Porto SDK runs in popup");
    return null;
  }
}

/**
 * Singleton instance of PortoService
 */
export const portoService = new PortoService();
