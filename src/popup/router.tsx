/**
 * Router Configuration
 * HashRouter for Chrome extension compatibility.
 *
 * Route shape:
 *   /                     <App>
 *     <TopTabsLayout>         — sticky header + 3-tab strip
 *       /                   Home (Wallet tab — balance, actions, tokens)
 *       /history            History (Activity tab)
 *       /settings           Settings tab
 *     — flow pages (own FlowHeader, no tabs)
 *       /send
 *       /receive
 *       /send-token/:address
 *       /token/:address
 *       /tx/:bundleId
 *       /permissions
 *     — approval pages (standalone popup windows)
 *       /connect, /transaction, /sign, /grant-permissions
 */

import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "./App";
import { TopTabsLayout } from "./components/layout/TopTabsLayout";

import { Home } from "./pages/Home";
import { Send } from "./pages/Send";
import { SendToken } from "./pages/SendToken";
import { Receive } from "./pages/Receive";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";
import { TokenDetail } from "./pages/TokenDetail";
import { TransactionDetail } from "./pages/TransactionDetail";
import { Permissions } from "./pages/Permissions";

import { ConnectionApproval } from "./pages/approval/ConnectionApproval";
import { TransactionApproval } from "./pages/approval/TransactionApproval";
import { SigningApproval } from "./pages/approval/SigningApproval";
import { GrantPermissionsApproval } from "./pages/approval/GrantPermissionsApproval";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // Tab routes — share TopTabsLayout chrome
      {
        element: <TopTabsLayout />,
        children: [
          { index: true, element: <Home /> },
          { path: "history", element: <History /> },
          { path: "settings", element: <Settings /> },
        ],
      },
      // Flow routes — render their own page chrome
      { path: "send", element: <Send /> },
      { path: "receive", element: <Receive /> },
      { path: "token/:address", element: <TokenDetail /> },
      { path: "send-token/:address", element: <SendToken /> },
      { path: "tx/:bundleId", element: <TransactionDetail /> },
      { path: "permissions", element: <Permissions /> },
      // Approval routes — standalone popup windows
      { path: "connect", element: <ConnectionApproval /> },
      { path: "transaction", element: <TransactionApproval /> },
      { path: "sign", element: <SigningApproval /> },
      { path: "grant-permissions", element: <GrantPermissionsApproval /> },
      // Legacy redirect — /tokens was a dedicated tab; folded into Wallet.
      { path: "tokens", element: <Navigate to="/" replace /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
