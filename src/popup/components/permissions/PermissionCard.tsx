/**
 * Permission Card
 * Individual permission display with details and revoke action
 */

import { Button } from "../common";
import type { Permission } from "../../../types/porto";

export interface PermissionCardProps {
  permission: Permission;
  onRevoke: () => void;
  isRevoking: boolean;
}

/**
 * Format expiry timestamp to human-readable date
 */
function formatExpiry(expiry: number): string {
  const date = new Date(expiry * 1000);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  // If less than 24 hours, show relative time
  if (diff > 0 && diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  }

  // Otherwise show date
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function PermissionCard({ permission, onRevoke, isRevoking }: PermissionCardProps) {
  const isExpired = permission.expiry < Date.now() / 1000;
  const callsCount = permission.permissions.calls?.length || 0;
  const spendLimitsCount = permission.permissions.spend?.length || 0;

  return (
    <div
      className={`p-4 rounded-xl border ${
        isExpired ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">Session Key</span>
            {isExpired ? (
              <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                Expired
              </span>
            ) : (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                Active
              </span>
            )}
          </div>

          {/* Key info */}
          <div className="text-xs text-gray-400 font-mono mt-1 truncate">
            {permission.key.publicKey.slice(0, 14)}...{permission.key.publicKey.slice(-8)}
          </div>

          {/* Expiry */}
          <div className="text-xs text-gray-500 mt-2">
            {isExpired ? (
              <span className="text-red-500">Expired</span>
            ) : (
              <span>Expires {formatExpiry(permission.expiry)}</span>
            )}
          </div>

          {/* Permissions summary */}
          <div className="flex flex-wrap gap-2 mt-2">
            {callsCount > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {callsCount} call{callsCount !== 1 ? "s" : ""} allowed
              </span>
            )}
            {callsCount === 0 && (
              <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">
                All calls allowed
              </span>
            )}
            {spendLimitsCount > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {spendLimitsCount} spend limit{spendLimitsCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

        </div>

        {/* Revoke button */}
        <Button
          variant="danger"
          size="sm"
          onClick={onRevoke}
          loading={isRevoking}
          disabled={isRevoking}
        >
          Revoke
        </Button>
      </div>
    </div>
  );
}
