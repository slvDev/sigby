/**
 * PageLayout Component
 * Consistent page wrapper with optional Header and BottomNav
 */

import type { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

export interface PageLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showBottomNav?: boolean;
  className?: string;
}

export function PageLayout({
  children,
  showHeader = true,
  showBottomNav = true,
  className = "",
}: PageLayoutProps) {
  return (
    <div className="flex flex-col flex-1">
      {showHeader && <Header />}
      <div className={`flex-1 overflow-y-auto ${className}`}>{children}</div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
