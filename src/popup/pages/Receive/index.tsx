import { QRCodeSVG } from "qrcode.react";
import { useReceive } from "./useReceive";

export function Receive() {
  const {
    activeAccount,
    activeAddress,
    nativeSymbol,
    chainName,
    copied,
    handleCopy,
    handleBack,
  } = useReceive();

  if (!activeAccount) {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center gap-4 p-4 border-b border-gray-100">
          <button
            onClick={handleBack}
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
      <div className="flex items-center gap-4 p-4 border-b border-gray-100">
        <button
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Receive</h2>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 p-6 gap-6">
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
          <QRCodeSVG
            value={activeAddress || ""}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Your Address
          </div>
          <div className="font-mono text-sm text-gray-900 break-all px-4 max-w-xs">
            {activeAddress}
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="w-full max-w-xs py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
        >
          {copied ? "Copied!" : "Copy Address"}
        </button>

        <div className="text-center text-sm text-gray-500 max-w-xs">
          <p>
            Only send {nativeSymbol} and ERC-20 tokens on{" "}
            <strong className="text-gray-700">{chainName}</strong> network to
            this address.
          </p>
        </div>
      </div>
    </div>
  );
}
