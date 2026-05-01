import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import {
  AddressText,
  DismissibleError,
  GlassCard,
  Icon,
} from "../../components/ui";
import { fadeUp, tween } from "../../styles/motion";
import { FONT_STACK, palette } from "../../styles/theme";
import { useOnboarding } from "./useOnboarding";

const STEP_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const };

/**
 * Onboarding — four-screen welcome flow for technical first users.
 *
 * Tone is setup wizard, not feature tour, but visual language matches
 * the rest of the wallet: backgroundGradient surface, GlassCard rows,
 * blue-600 primary button. The earlier "plain wizard" look read as a
 * different app.
 *
 * 1. What Sigby is — passkey wallet, no seed phrase, Porto SDK + Relay.
 * 2. Trust model — explicit map of what each component sees.
 * 3. Create or Restore — the WebAuthn-issuing surface.
 * 4. Account ready — address + chain + account-type metadata block.
 *
 * Step 3 → 4 keys off the `passkey-success` celebrate beat (see
 * `useOnboarding`) so create and restore both land on the metadata
 * surface.
 */
export function Onboarding() {
  const view = useOnboarding();

  return (
    <div
      className="flex-1 flex flex-col px-4 pt-6 pb-5 overflow-y-auto"
      style={{ fontFamily: FONT_STACK, background: palette.backgroundGradient }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={view.step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={STEP_TRANSITION}
          className="flex-1 flex flex-col"
        >
          {renderStep(view)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function renderStep(view: ReturnType<typeof useOnboarding>): ReactNode {
  switch (view.step) {
    case 1:
      return <WhatStep onNext={view.goNext} />;
    case 2:
      return <TrustModelStep onNext={view.goNext} />;
    case 3:
      return (
        <CreateOrRestoreStep
          walletName={view.walletName}
          setWalletName={view.setWalletName}
          accountCount={view.accountCount}
          isLoading={view.isLoading}
          error={view.error}
          errorAt={view.errorAt}
          onCreate={view.handleCreateAccount}
          onConnect={view.handleConnectAccount}
          onDismissError={view.dismissError}
        />
      );
    case 4:
      return (
        <AccountReadyStep
          activeAddress={view.activeAddress}
          chainName={view.chainName}
          balance={view.balance}
          nativeSymbol={view.nativeSymbol}
          assetsLoading={view.assetsLoading}
          onReceive={view.goReceive}
          onSettings={view.goSettings}
          onDismiss={view.finish}
        />
      );
  }
}

// ----------------------------------------------------------------------
// Layout primitives
// ----------------------------------------------------------------------

function StepShell({
  body,
  action,
}: {
  body: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <motion.div
        className="flex-1 flex flex-col"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { delayChildren: 0.04, staggerChildren: 0.04 } },
        }}
      >
        {body}
      </motion.div>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { delayChildren: 0.14, staggerChildren: 0.04 } },
        }}
        className="flex flex-col gap-2.5 pt-5"
      >
        {action}
      </motion.div>
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="w-full py-3.5 text-[14px] font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {children}
    </motion.button>
  );
}

function H1({ children }: { children: ReactNode }) {
  return (
    <motion.h1
      variants={fadeUp}
      transition={tween.mediumOutStrong}
      className="text-[22px] font-semibold tracking-tight text-zinc-900"
    >
      {children}
    </motion.h1>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return (
    <motion.p
      variants={fadeUp}
      transition={tween.mediumOutStrong}
      className="text-[13px] text-zinc-500 leading-relaxed mt-1.5"
    >
      {children}
    </motion.p>
  );
}

/**
 * Glass surface row carrying a label + body. Same vocabulary the
 * Settings sections and Home tokens list use, so onboarding reads as
 * "the wallet is showing me something" rather than as a separate
 * setup app.
 */
function FactRow({
  label,
  body,
}: {
  label: string;
  body: ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} transition={tween.mediumOutStrong}>
      <GlassCard className="px-3.5 py-3">
        <div className="text-[12px] font-semibold text-zinc-900">{label}</div>
        <div className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
          {body}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ----------------------------------------------------------------------
// Step 1 — What Sigby is.
// ----------------------------------------------------------------------

function WhatStep({ onNext }: { onNext: () => void }) {
  return (
    <StepShell
      body={
        <>
          <H1>Sigby is a passkey wallet</H1>
          <Lede>
            A Chrome extension wallet controlled by your synced passkey, not
            a seed phrase or extension-held private key.
          </Lede>

          <div className="mt-5 flex flex-col gap-2">
            <FactRow
              label="Passkey signs account operations"
              body="WebAuthn credential, scoped to this extension. Wallet approvals need your passkey. Session permissions, if you grant them, are explicit and time-bounded."
            />
            <FactRow
              label="Same account across supported EVM chains"
              body="One address on Ethereum, Base, Arbitrum, Optimism, Polygon. Smart account via EIP-7702."
            />
            <FactRow
              label="Built on Porto SDK + Relay"
              body="Account abstraction stack from Ithaca. Sigby is an independent open-source Chrome extension. It provides the UI and signing client; Porto SDK + Relay provide the account-abstraction execution path."
            />
          </div>
        </>
      }
      action={
        <motion.div variants={fadeUp} transition={tween.mediumOutStrong}>
          <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
        </motion.div>
      }
    />
  );
}

// ----------------------------------------------------------------------
// Step 2 — Trust model.
// Honest: no "our servers" hand-waving; names Porto Relay so users
// can audit it.
// ----------------------------------------------------------------------

function TrustModelStep({ onNext }: { onNext: () => void }) {
  return (
    <StepShell
      body={
        <>
          <H1>Trust boundary</H1>
          <Lede>
            Three components, three roles. Sigby doesn&apos;t run a signing
            server.
          </Lede>

          <div className="mt-5 flex flex-col gap-2">
            <FactRow
              label="You approve"
              body="Your passkey stays in iCloud Keychain, Google Password Manager, 1Password, or a security key."
            />
            <FactRow
              label="Sigby stores metadata"
              body="The extension stores addresses, names, and settings locally in chrome.storage.local. Open source."
            />
            <FactRow
              label="Porto relays execution"
              body="Porto SDK + Relay submit account operations on-chain. Neither Sigby nor Porto receives your passkey or private key."
            />
          </div>

          <motion.p
            variants={fadeUp}
            transition={tween.mediumOutStrong}
            className="text-[11px] text-zinc-500 leading-relaxed mt-4 px-1"
          >
            No silent approvals. Sigby requires your passkey before granting
            any signing authority.
          </motion.p>
        </>
      }
      action={
        <motion.div variants={fadeUp} transition={tween.mediumOutStrong}>
          <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
        </motion.div>
      }
    />
  );
}

// ----------------------------------------------------------------------
// Step 3 — Create or restore.
// No OS-prompt mock (too consumer-y for this audience). The CTA copy
// itself sets the expectation that a passkey prompt is next.
// ----------------------------------------------------------------------

function CreateOrRestoreStep({
  walletName,
  setWalletName,
  accountCount,
  isLoading,
  error,
  errorAt,
  onCreate,
  onConnect,
  onDismissError,
}: {
  walletName: string;
  setWalletName: (v: string) => void;
  accountCount: number;
  isLoading: boolean;
  error: string | null;
  errorAt: number | null;
  onCreate: () => void;
  onConnect: () => void;
  onDismissError: () => void;
}) {
  const keychainLabel = `Sigby ${accountCount + 1}`;

  return (
    <StepShell
      body={
        <>
          <H1>Create passkey account</H1>
          <Lede>
            Wallet name is local and editable. The browser passkey label is
            permanent (
            <span className="font-mono text-zinc-700">{keychainLabel}</span>).
          </Lede>

          <motion.div
            variants={fadeUp}
            transition={tween.mediumOutStrong}
            className="mt-5"
          >
            <GlassCard className="px-3.5 py-3.5">
              <label
                htmlFor="wallet-name"
                className="block text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500 mb-2"
              >
                Wallet name
              </label>
              <input
                id="wallet-name"
                type="text"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="Main, Trading, Hot…"
                disabled={isLoading}
                maxLength={32}
                className="w-full px-3.5 py-2.5 text-[14px] bg-white/80 backdrop-blur border border-white/80 rounded-lg placeholder:text-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
              />
            </GlassCard>
          </motion.div>

          <motion.div
            variants={fadeUp}
            transition={tween.mediumOutStrong}
            className="mt-3"
          >
            <DismissibleError
              message={error}
              onDismiss={onDismissError}
              since={errorAt}
            />
          </motion.div>
        </>
      }
      action={
        <>
          <motion.div variants={fadeUp} transition={tween.mediumOutStrong}>
            <PrimaryButton onClick={onCreate} disabled={isLoading}>
              {isLoading ? "Waiting for passkey…" : "Create with passkey"}
            </PrimaryButton>
          </motion.div>
          <motion.button
            type="button"
            variants={fadeUp}
            transition={tween.mediumOutStrong}
            onClick={onConnect}
            disabled={isLoading}
            className="w-full text-center text-[12px] text-zinc-500 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed underline-offset-2 hover:underline focus:outline-none focus-visible:underline py-1"
          >
            {isLoading ? "Connecting…" : "Restore existing passkey account"}
          </motion.button>
        </>
      }
    />
  );
}

// ----------------------------------------------------------------------
// Step 4 — Account ready.
// Metadata block on a single GlassCard, action rows below as glass
// chips, primary button at bottom. Same visual vocabulary as Settings.
// ----------------------------------------------------------------------

function AccountReadyStep({
  activeAddress,
  chainName,
  balance,
  nativeSymbol,
  assetsLoading,
  onReceive,
  onSettings,
  onDismiss,
}: {
  activeAddress: string | null;
  chainName: string;
  balance: string;
  nativeSymbol: string;
  assetsLoading: boolean;
  onReceive: () => void;
  onSettings: () => void;
  onDismiss: () => void;
}) {
  const parsed = parseFloat(balance);
  const showBalance =
    !assetsLoading && Number.isFinite(parsed) && parsed > 0;

  return (
    <StepShell
      body={
        <>
          <H1>Account ready</H1>
          <Lede>
            Passkey connected. The account exists locally and is reachable on
            every supported chain.
          </Lede>

          <motion.div
            variants={fadeUp}
            transition={tween.mediumOutStrong}
            className="mt-5"
          >
            <GlassCard className="px-3.5 py-1">
              <MetaRow
                label="Address"
                value={
                  activeAddress ? (
                    <AddressText address={activeAddress} />
                  ) : (
                    <span className="text-zinc-400">(none)</span>
                  )
                }
              />
              <MetaRow label="Current network" value={chainName} />
              <MetaRow
                label="Account type"
                value="Porto smart account · passkey signer"
              />
              {showBalance && (
                <MetaRow
                  label="Balance"
                  value={
                    <span className="tabular-nums">
                      {balance} {nativeSymbol}
                    </span>
                  }
                />
              )}
            </GlassCard>
          </motion.div>

          <motion.div
            variants={fadeUp}
            transition={tween.mediumOutStrong}
            className="mt-3 flex flex-col gap-2"
          >
            <ActionRow
              icon={<Icon name="receive" className="w-4 h-4" />}
              label="Receive funds"
              onClick={onReceive}
            />
            <ActionRow
              icon={<Icon name="settings" className="w-4 h-4" />}
              label="Settings"
              onClick={onSettings}
            />
          </motion.div>

          <motion.p
            variants={fadeUp}
            transition={tween.mediumOutStrong}
            className="text-[11px] text-zinc-500 leading-relaxed mt-4 px-1"
          >
            Back up access through iCloud Keychain, Google Password Manager,
            1Password, or a security key. If you lose passkey access, Sigby
            cannot recover it.
          </motion.p>
        </>
      }
      action={
        <motion.div variants={fadeUp} transition={tween.mediumOutStrong}>
          <PrimaryButton onClick={onDismiss}>Open wallet</PrimaryButton>
        </motion.div>
      }
    />
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-zinc-200/60 last:border-b-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-500 flex-shrink-0">
        {label}
      </div>
      <div className="text-[12px] text-zinc-900 text-right min-w-0 truncate">
        {value}
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      className="w-full flex items-center gap-3 px-3.5 py-3 bg-white/80 backdrop-blur border border-white/80 rounded-xl hover:bg-white transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
    >
      <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-600">
        {icon}
      </span>
      <span className="flex-1 text-[13px] font-medium text-zinc-900">
        {label}
      </span>
      <Icon name="chevron-right" className="w-4 h-4 text-zinc-400" />
    </motion.button>
  );
}
