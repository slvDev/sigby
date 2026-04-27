/**
 * LockStatus — background mirror of the popup's lock state.
 *
 * Keeps an in-memory copy of `chrome.storage.session.lastUnlockedAt`
 * plus the persisted `settings.autoLockTimeout` so dApp-facing RPC
 * routing can decide synchronously whether a request should be
 * rejected. Subscribes to `chrome.storage.onChanged` so the cache
 * stays in sync without extra IO on each request.
 *
 * Also emits lock/unlock transition callbacks: the popup writes the
 * session timestamp when it unlocks/locks, and this class turns those
 * edge-triggered storage events into signals the background fans out
 * to connected dApps as `accountsChanged` events.
 *
 * This is the same UX curtain the popup's AuthGuard enforces, now
 * visible at the dApp surface. It is NOT a cryptographic boundary —
 * a local attacker can forge the session timestamp.
 *
 * Known limitation: if the SW is suspended at the exact moment the
 * popup writes `session.lastUnlockedAt`, the `onChanged` event is
 * lost. On next SW wake, `hydrate()` reads the current value and
 * sets `lastKnownLocked` directly without firing a transition — so
 * silent subscribers that were told `accountsChanged([])` in the
 * prior run never receive the matching `accountsChanged([addr])`
 * until they next poll. Polling dApps self-heal. A persistent
 * `lastBroadcastLocked` flag could close this, but costs extra
 * session I/O on every transition. Left as an accepted gap until
 * it demonstrates in the wild.
 */
import type { StorageManager } from "../utils/storage";
import { SESSION_STORAGE_KEYS, STORAGE_KEYS } from "../utils/constants";

const SESSION_UNLOCK_KEY = SESSION_STORAGE_KEYS.LAST_UNLOCKED_AT;
const SETTINGS_STORAGE_KEY = STORAGE_KEYS.SETTINGS;

export type LockTransition = "locked" | "unlocked";
export type LockTransitionHandler = (state: LockTransition) => void;

/**
 * Owned-optimistic-unlock token returned by `beginUnlock` and passed
 * back to `revertUnlock`. The `id` is a monotonic counter — NOT a
 * timestamp — so two `beginUnlock` calls in the same millisecond
 * get distinct ids and can't steal each other's rollback rights.
 */
export interface UnlockToken {
  id: number;
}

export class LockStatus {
  private cachedLastUnlockedAt: number | null = null;
  /**
   * Last timestamp successfully written to `chrome.storage.session`
   * (either by our own `persistUnlock` or by the popup-side writer
   * observed via `onChanged`). `revertUnlock` rolls the cache back
   * to THIS value rather than the token's `prev` snapshot, so a
   * ghost optimistic-unlock from a concurrent sibling that was
   * never persisted can't resurrect itself via a revert.
   */
  private lastPersistedTimestamp: number | null = null;
  /** Minutes; 0 means "never" on the popup side. */
  private cachedAutoLockMinutes: number = 15;
  private hydrated = false;
  private transitionHandlers: LockTransitionHandler[] = [];
  /** Last computed lock state — drives transition detection. */
  private lastKnownLocked: boolean | null = null;
  /** Monotonic id for in-flight optimistic unlocks (ownership key). */
  private nextUnlockId = 0;
  /** Id of the currently-owning in-flight beginUnlock (or null). */
  private currentUnlockId: number | null = null;

  constructor(private storageManager: StorageManager) {
    // Intentionally does NOT start the storage listener. The caller
    // must (a) register transition handlers, (b) await hydrate(),
    // then (c) call listen(). Kicking off listen here would leave a
    // window where storage events fire with an empty handler list
    // and/or stale cache state — dropping the first lock transition
    // after SW wake.
  }

  /**
   * Load current session timestamp + settings snapshot. Must be awaited
   * once on background boot before RPC routing starts asking.
   */
  async hydrate(): Promise<void> {
    try {
      const sessionRes = await chrome.storage.session.get(SESSION_UNLOCK_KEY);
      const ts = sessionRes[SESSION_UNLOCK_KEY];
      this.cachedLastUnlockedAt = typeof ts === "number" ? ts : null;
      this.lastPersistedTimestamp = this.cachedLastUnlockedAt;

      const settings = await this.storageManager.getSettings();
      this.cachedAutoLockMinutes = settings.autoLockTimeout ?? 15;

      this.lastKnownLocked = this.computeLocked();
      this.hydrated = true;
    } catch (err) {
      console.warn("[LockStatus] Hydrate failed:", err);
      // Conservative: treat as locked until we can confirm otherwise.
      this.cachedLastUnlockedAt = null;
      this.lastPersistedTimestamp = null;
      this.lastKnownLocked = true;
      this.hydrated = true;
    }
  }

  /**
   * Synchronous answer, backed by the cache. Callers should `hydrate`
   * once on boot; if hydrate hasn't run we fall back to "locked" as
   * the safe default.
   *
   * Also drives time-based transitions: idle expiry doesn't cause a
   * storage write (the popup-side timer does, but only if the popup
   * is open). Every call here compares the freshly-derived state to
   * the last-known state and fires the transition handlers if they
   * differ, so a dApp request that lands just after the expiry line
   * is crossed still produces an `accountsChanged([])` broadcast.
   */
  isLocked(): boolean {
    if (!this.hydrated) return true;
    const now = this.computeLocked();
    this.fireTransition(now);
    return now;
  }

  /**
   * Register a lock↔unlock transition handler. Fires only when the
   * derived state actually flips, not on every underlying write.
   */
  onTransition(handler: LockTransitionHandler): () => void {
    this.transitionHandlers.push(handler);
    return () => {
      this.transitionHandlers = this.transitionHandlers.filter(
        (h) => h !== handler
      );
    };
  }

  /**
   * Synchronously mark the wallet unlocked in the in-memory cache and
   * fire transition handlers. Intentionally split from the async
   * persist so approval handlers can update the cache BEFORE the
   * work that resolves the dApp's waiting promise — any follow-up
   * RPC the dApp fires after receiving the response will read the
   * already-unlocked cache, even in the worst case where a new
   * DAPP_REQUEST is dispatched while the approval handler is still
   * running.
   *
   * Returns an `UnlockToken` keyed by a monotonic id (NOT the
   * timestamp — two begins in the same millisecond would collide).
   * Pass the token to `revertUnlock` if the approval step throws;
   * only the caller whose id is still `currentUnlockId` can roll
   * back the cache.
   *
   * Call `persistUnlock()` after the approval actually succeeds so
   * the unlock survives SW restart. Ordering is:
   *   1. const token = beginUnlock()      — sync cache + broadcast
   *   2. try { await approveX(...) }      — resolves dApp, can race
   *      catch { revertUnlock(token) }    — undo on failure
   *   3. await persistUnlock()            — durable write on success
   */
  beginUnlock(): UnlockToken {
    const id = ++this.nextUnlockId;
    this.currentUnlockId = id;
    this.cachedLastUnlockedAt = Date.now();
    this.fireTransition(this.computeLocked());
    return { id };
  }

  /**
   * Roll back a `beginUnlock` that never completed.
   *
   * Ownership is id-keyed: only rolls back when `currentUnlockId ===
   * token.id`. If a newer `beginUnlock` advanced past us, the newer
   * attempt owns the cache and this revert is a no-op.
   *
   * Rollback target is the last-successfully-persisted timestamp,
   * NOT the token's pre-begin snapshot. That snapshot may itself be
   * an optimistic ghost from a concurrent sibling that later failed
   * — restoring to it would resurrect a never-persisted unlock and
   * keep the cache drifting until SW restart. Persisted-timestamp
   * is the only value we can trust matches reality.
   *
   * After restoring, fires transition handlers so dApps see
   * `accountsChanged([])` if the derived state flipped back to
   * locked.
   */
  revertUnlock(token: UnlockToken): void {
    if (this.currentUnlockId !== token.id) return;
    this.currentUnlockId = null;
    this.cachedLastUnlockedAt = this.lastPersistedTimestamp;
    this.fireTransition(this.computeLocked());
  }

  /**
   * Persist the current cached unlock timestamp to session storage.
   * Paired with `beginUnlock()`; no-op if `beginUnlock` wasn't called
   * (cache is null), so a stray `persistUnlock` can't manufacture
   * an unlock stamp out of nowhere.
   *
   * On success, captures the written timestamp into
   * `lastPersistedTimestamp` so `revertUnlock` has a non-optimistic
   * rollback target. The `onChanged` listener also updates that
   * field for external (popup-side) writes, so session storage is
   * still the single cross-context source of truth.
   */
  async persistUnlock(): Promise<void> {
    if (this.cachedLastUnlockedAt === null) return;
    const toPersist = this.cachedLastUnlockedAt;
    try {
      await chrome.storage.session.set({
        [SESSION_UNLOCK_KEY]: toPersist,
      });
      this.lastPersistedTimestamp = toPersist;
    } catch (err) {
      // Storage write failed — roll the cache back to the last-truly-
      // persisted value so the background doesn't answer as unlocked
      // while session storage (and therefore the popup) stays locked.
      // The approval itself already resolved the dApp's promise, so
      // that side-effect stands; only the durability of the unlock
      // session is lost. Subsequent dApp RPCs see the rollback via
      // the fired transition (accountsChanged([]) if state flipped).
      //
      // Guard: only revert if the cache still holds the value we
      // tried to persist. A concurrent newer beginUnlock may have
      // moved the cache past us during the failed set() — they own
      // the cache now and must not be clobbered.
      console.warn(
        "[LockStatus] persistUnlock failed; reverting cache to last persisted:",
        err
      );
      if (this.cachedLastUnlockedAt === toPersist) {
        this.cachedLastUnlockedAt = this.lastPersistedTimestamp;
        this.fireTransition(this.computeLocked());
      }
    }
  }

  private computeLocked(): boolean {
    if (this.cachedLastUnlockedAt === null) return true;
    // 0 in storage = popup-side "never" = stays unlocked indefinitely
    // (until browser restart clears session storage).
    if (this.cachedAutoLockMinutes === 0) return false;
    const idleMs = Date.now() - this.cachedLastUnlockedAt;
    return idleMs >= this.cachedAutoLockMinutes * 60_000;
  }

  private fireTransition(now: boolean): void {
    if (this.lastKnownLocked === now) return;
    this.lastKnownLocked = now;
    const state: LockTransition = now ? "locked" : "unlocked";
    for (const h of this.transitionHandlers) {
      try {
        h(state);
      } catch (err) {
        console.warn("[LockStatus] Transition handler threw:", err);
      }
    }
  }

  /**
   * Start observing `chrome.storage.onChanged`. Call once after
   * transition handlers are registered and `hydrate()` has resolved.
   * Idempotent guard would add complexity; caller is responsible for
   * not double-calling.
   */
  listen(): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "session" && changes[SESSION_UNLOCK_KEY]) {
        const next = changes[SESSION_UNLOCK_KEY].newValue;
        const nextTs = typeof next === "number" ? next : null;
        this.cachedLastUnlockedAt = nextTs;
        // External writes (popup side) count as persisted — they're
        // already in storage by the time onChanged fires, so any
        // subsequent revert should roll back to this value rather
        // than further into stale history.
        this.lastPersistedTimestamp = nextTs;
        this.fireTransition(this.computeLocked());
        return;
      }
      if (area === "local" && changes[SETTINGS_STORAGE_KEY]) {
        const nextSettings = changes[SETTINGS_STORAGE_KEY].newValue as
          | { autoLockTimeout?: number }
          | undefined;
        if (typeof nextSettings?.autoLockTimeout === "number") {
          this.cachedAutoLockMinutes = nextSettings.autoLockTimeout;
          this.fireTransition(this.computeLocked());
        }
      }
    });
  }
}
