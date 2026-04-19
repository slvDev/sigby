import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../../store";
import { popupPortoService } from "../../portoService";
import { CHAIN_CONFIGS } from "../../../utils/constants";
import { useToast } from "../../components/common";

const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

export function useSend() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activeAddress, accounts, chainId, addPendingTransaction } =
    useWalletStore();
  const activeAccount = activeAddress ? accounts[activeAddress] : null;
  const chainConfig = CHAIN_CONFIGS[chainId];
  const currencySymbol = chainConfig?.nativeCurrency?.symbol || "ETH";
  const chainName = chainConfig?.name || "Unknown Network";

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userBalance = activeAccount ? parseFloat(activeAccount.balance || "0") : 0;

  const handleSend = async () => {
    if (!recipient || !amount) {
      setError("Please fill in all fields");
      return;
    }
    if (!isValidAddress(recipient)) {
      setError("Invalid recipient address");
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Invalid amount");
      return;
    }
    if (amountNum > userBalance) {
      setError(`Insufficient balance. You have ${userBalance} ${currencySymbol}`);
      return;
    }
    if (activeAddress && recipient.toLowerCase() === activeAddress.toLowerCase()) {
      setError("Cannot send to your own address");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const valueWei = BigInt(Math.floor(amountNum * 1e18));
      const valueHex = "0x" + valueWei.toString(16);

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
      setError(err instanceof Error ? err.message : "Transaction failed");
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
    userBalance,
    handleSend,
    handleBack,
    dismissError: () => setError(null),
  };
}
