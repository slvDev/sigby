import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatUnits, parseUnits } from "viem";
import { useWalletStore } from "../../store";
import { popupPortoService } from "../../portoService";
import { CHAIN_CONFIGS } from "../../../utils/constants";
import { errorToString } from "../../../utils/rpcError";
import { useToast } from "../../components/common";

const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

type ParseAmountResult =
  | { ok: true; wei: bigint }
  | { ok: false; error: string };

// viem.parseUnits silently *rounds* extra fractional digits — typing
// 0.0000000000000000005 ETH on an 18-decimal asset would round up and
// send 1 wei the user didn't authorize. Reject anything with non-zero
// digits past `decimals` before delegating to viem.
function parseAmount(input: string, decimals: number): ParseAmountResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Invalid amount" };
  const dot = trimmed.indexOf(".");
  if (dot >= 0) {
    const frac = trimmed.slice(dot + 1);
    if (frac.length > decimals && /[1-9]/.test(frac.slice(decimals))) {
      return {
        ok: false,
        error: `Too many decimal places (max ${decimals})`,
      };
    }
  }
  try {
    return { ok: true, wei: parseUnits(trimmed, decimals) };
  } catch {
    return { ok: false, error: "Invalid amount" };
  }
}

export function useSend() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    activeAddress,
    accounts,
    chainId,
    assets,
    assetsLoading,
    assetsLastAttemptedAt,
    refreshAssets,
    addPendingTransaction,
  } = useWalletStore();

  // Landing on /send directly (e.g. from a TokenDetail row, or after
  // an SW restart that cleared the store) skips Home's fetch — without
  // this the form shows `Available: 0` and rejects valid sends as
  // insufficient. `refreshAssets` is a no-op when assets are fresh.
  useEffect(() => {
    if (activeAddress) refreshAssets();
  }, [activeAddress, chainId, refreshAssets]);
  const activeAccount = activeAddress ? accounts[activeAddress] : null;
  const chainConfig = CHAIN_CONFIGS[chainId];
  const currencySymbol = chainConfig?.nativeCurrency?.symbol || "ETH";
  const chainName = chainConfig?.name || "Unknown Network";

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Raw native asset is the source of truth for both display and
  // math. `activeAccount.balance` is a `.toFixed(7)` shadow that drops
  // anything past 7 fractional digits — fine for the old display, not
  // safe for validation against high-precision input.
  const nativeAsset = assets.find((a) => a.type === "native");
  const decimals = nativeAsset?.metadata.decimals ?? 18;
  const balanceWei = nativeAsset ? BigInt(nativeAsset.balance) : 0n;
  const userBalanceFormatted = nativeAsset
    ? formatUnits(balanceWei, decimals)
    : "0";
  // `isLoadingBalance` is true until at least one fetch attempt has
  // completed. Distinct from "balance == 0" so we don't reject a
  // legitimate send as insufficient before the first refresh lands.
  const isLoadingBalance = assetsLoading || assetsLastAttemptedAt === null;

  const handleSend = async () => {
    if (isLoadingBalance) {
      setError("Loading balance — please wait");
      return;
    }
    if (!recipient || !amount) {
      setError("Please fill in all fields");
      return;
    }
    if (!isValidAddress(recipient)) {
      setError("Invalid recipient address");
      return;
    }
    const parsed = parseAmount(amount, decimals);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const amountWei = parsed.wei;
    if (amountWei <= 0n) {
      setError("Invalid amount");
      return;
    }
    if (amountWei > balanceWei) {
      setError(
        `Insufficient balance. You have ${userBalanceFormatted} ${currencySymbol}`
      );
      return;
    }
    if (activeAddress && recipient.toLowerCase() === activeAddress.toLowerCase()) {
      setError("Cannot send to your own address");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const valueHex = "0x" + amountWei.toString(16);

      const bundleId = await popupPortoService.sendCalls({
        from: activeAddress!,
        to: recipient,
        value: valueHex,
        data: "0x",
        chainId,
      });

      addPendingTransaction({ id: bundleId, chainId, timestamp: Date.now() });
      showToast({ type: "success", message: "Transaction submitted!" });
      navigate("/history");
    } catch (err) {
      console.error("[Send] Failed:", err);
      setError(errorToString(err) || "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => navigate(-1);

  return {
    activeAccount,
    currencySymbol,
    chainName,
    recipient,
    setRecipient,
    amount,
    setAmount,
    isLoading,
    error,
    userBalanceFormatted,
    isLoadingBalance,
    handleSend,
    handleBack,
    dismissError: () => setError(null),
  };
}
