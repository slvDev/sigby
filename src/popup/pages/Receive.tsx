/**
 * Receive Page
 * Display address and QR code for receiving funds
 */

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useWalletStore } from "../store";

export function Receive() {
  const navigate = useNavigate();
  const { activeAddress, accounts } = useWalletStore();
  const activeAccount = activeAddress ? accounts[activeAddress] : null;

  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    if (activeAddress) {
      navigator.clipboard.writeText(activeAddress);
      setCopied(true);

      // Clear existing timeout if any
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    }
  };

  if (!activeAccount) {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-4 p-4 border-b border-gray-100">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Receive</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            No active account
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Receive</h2>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center flex-1 p-6 gap-6">
        {/* QR Code */}
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
          <QRCodeSVG
            value={activeAddress || ""}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Address */}
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Your Address
          </div>
          <div className="font-mono text-sm text-gray-900 break-all px-4 max-w-xs">
            {activeAddress}
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="w-full max-w-xs py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          {copied ? "Copied!" : "Copy Address"}
        </button>

        {/* Note */}
        <div className="text-center text-sm text-gray-500 max-w-xs">
          <p>
            Only send ETH and ERC-20 tokens on <strong className="text-gray-700">Base</strong> network to this address.
          </p>
        </div>
      </div>
    </div>
  );
}
