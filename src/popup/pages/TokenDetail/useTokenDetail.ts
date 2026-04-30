import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import type { TokenBalance } from "../../../types/account";

// Cap fractional digits at 6, trim trailing zeros. Used for the
// hero headline so any realistic balance fits the 32px font; full
// precision is still surfaced via the copy-on-click row below.
function shortBalance(formatted: string): string {
  const dot = formatted.indexOf(".");
  if (dot < 0) return formatted;
  const intPart = formatted.slice(0, dot);
  const frac = formatted.slice(dot + 1, dot + 1 + 6).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
}

export function useTokenDetail() {
  const navigate = useNavigate();
  const { address } = useParams<{ address: string }>();
  const location = useLocation();

  const token = location.state?.token as TokenBalance | undefined;

  const [copiedExact, setCopiedExact] = useState(false);

  const handleBack = () => navigate(-1);
  const handleGoToTokens = () => navigate("/");
  const handleSend = () => {
    if (!token) return;
    if (token.isNative) {
      navigate("/send");
      return;
    }
    navigate(`/send-token/${token.address}`, { state: { token } });
  };

  // writeText rejects asynchronously on permission / availability
  // failures; await before flipping `copiedExact` so the affordance
  // never flashes a fake success.
  const handleCopyExact = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(
        `${token.formatted} ${token.symbol}`
      );
      setCopiedExact(true);
      window.setTimeout(() => setCopiedExact(false), 1200);
    } catch {
      // Clipboard unavailable — leave the affordance idle.
    }
  };

  const shortFormatted = token ? shortBalance(token.formatted) : "";
  const showExactBalance = !!token && shortFormatted !== token.formatted;

  return {
    token,
    address,
    shortFormatted,
    showExactBalance,
    copiedExact,
    handleBack,
    handleGoToTokens,
    handleSend,
    handleCopyExact,
  };
}
