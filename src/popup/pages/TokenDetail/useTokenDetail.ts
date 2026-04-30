import { useNavigate, useParams, useLocation } from "react-router-dom";
import type { TokenBalance } from "../../../types/account";

export function useTokenDetail() {
  const navigate = useNavigate();
  const { address } = useParams<{ address: string }>();
  const location = useLocation();

  const token = location.state?.token as TokenBalance | undefined;

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

  return { token, address, handleBack, handleGoToTokens, handleSend };
}
