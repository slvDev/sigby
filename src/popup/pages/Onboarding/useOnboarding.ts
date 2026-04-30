import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store";
import { useHome } from "../Home/useHome";
import { CHAIN_CONFIGS } from "../../../utils/constants";

// Note on the success signal: we watch `celebrations["passkey-success"]`
// rather than `accountOrder.length` for the Step 3 → 4 advance.
//   1. The celebrate beat is the direct semantic signal — "a passkey
//      authorization just succeeded" — instead of inferring intent from
//      a count change.
//   2. It's resilient if Restore ever lands on an account the store
//      already knows about (count wouldn't move; the beat still fires).
//   3. Timestamp-based, so a stale subscription can't double-fire:
//      `seenPasskeyAtRef` snapshots the value at mount and we only
//      react to advances past it.

export type OnboardingStep = 1 | 2 | 3 | 4;

/**
 * useOnboarding — drives the four-screen welcome flow.
 *
 * Step state is local; the success transition (Step 3 → 4) keys off
 * the `passkey-success` celebration timestamp (see top-of-file note).
 * We snapshot the timestamp at mount so a stale beat from before
 * Onboarding opened can't double-fire, and we don't await the create
 * /connect handler's resolve — both paths reach the same Done surface
 * once the celebrate beat advances past the mount snapshot.
 */
export function useOnboarding() {
  const navigate = useNavigate();
  const home = useHome();
  const passkeySuccessAt = useWalletStore(
    (s) => s.celebrations["passkey-success"],
  );
  const chainId = useWalletStore((s) => s.chainId);
  const assetsLastAttemptedAt = useWalletStore((s) => s.assetsLastAttemptedAt);
  const completeOnboarding = useWalletStore((s) => s.completeOnboarding);
  const dismissOnboarding = useWalletStore((s) => s.dismissOnboarding);

  const [step, setStep] = useState<OnboardingStep>(1);
  const advancedRef = useRef(false);
  // Snapshot the celebrate timestamp at mount so we only react to a
  // *fresh* passkey-success — one fired after Onboarding mounted.
  // Watching `accountOrder.length` is weaker: restore can succeed
  // without changing the account count, while the celebrate signal
  // fires on both paths.
  const seenPasskeyAtRef = useRef<number | undefined>(passkeySuccessAt);

  useEffect(() => {
    if (
      passkeySuccessAt &&
      passkeySuccessAt !== seenPasskeyAtRef.current &&
      !advancedRef.current
    ) {
      seenPasskeyAtRef.current = passkeySuccessAt;
      advancedRef.current = true;
      setStep(4);
      // Persist completion now, not on dismiss — closing the popup
      // mid-Done-screen would otherwise re-show the welcome flow next
      // time after a wipe-and-recreate. Setting the store flag does
      // NOT unmount Onboarding because AuthGuard gates on
      // `isOnboardingActive`, which we clear in finish / goSettings.
      void completeOnboarding();
    }
  }, [passkeySuccessAt, completeOnboarding]);

  const goNext = () => {
    setStep((s) => (s < 4 ? ((s + 1) as OnboardingStep) : s));
  };

  const finish = () => {
    dismissOnboarding();
    navigate("/");
  };

  const goReceive = () => {
    dismissOnboarding();
    navigate("/receive");
  };

  const goSettings = () => {
    dismissOnboarding();
    navigate("/settings");
  };

  return {
    step,
    goNext,
    finish,
    goReceive,
    goSettings,
    activeAddress: home.activeAccount?.address ?? null,
    chainId,
    chainName: CHAIN_CONFIGS[chainId]?.name ?? "Unknown",
    balance: home.balance,
    nativeSymbol: home.nativeSymbol,
    // Treat "haven't finished an attempt yet" as still loading. After
    // create/restore, `syncStoreWithBackground` resets the assets cache;
    // there's a render between that reset and `useHome`'s refresh
    // effect kicking in where `assetsLoading` is false but balance is
    // "0". `assetsLastAttemptedAt` advances on success AND failure, so
    // a failed first fetch still releases this gate (otherwise Step 4
    // would hang on the loading ellipsis indefinitely).
    assetsLoading: home.assetsLoading || assetsLastAttemptedAt === null,
    walletName: home.walletName,
    setWalletName: home.setWalletName,
    accountCount: home.accountCount,
    isLoading: home.isLoading,
    error: home.error,
    errorAt: home.errorAt,
    handleCreateAccount: home.handleCreateAccount,
    handleConnectAccount: home.handleConnectAccount,
    dismissError: home.dismissError,
  };
}
