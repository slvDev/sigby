/**
 * Router Configuration
 * HashRouter for Chrome extension compatibility.
 *
 * Route shape:
 *   /                     <App>
 *     <TopTabsLayout>         — sticky header + tab strip
 *       /                   Home (Wallet tab)
 *       /history            History (Activity tab)
 *       /tokens             Tokens tab
 *       /settings           Settings tab
 *     — flow pages (own header, no tabs)
 *       /send
 *       /receive
 *       /send-token/:address
 *       /token/:address
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
import { Tokens } from "./pages/Tokens";
import { TokenDetail } from "./pages/TokenDetail";
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
          { path: "tokens", element: <Tokens /> },
          { path: "settings", element: <Settings /> },
        ],
      },
      // Flow routes — render their own page chrome (back button, etc.)
      { path: "send", element: <Send /> },
      { path: "receive", element: <Receive /> },
      { path: "token/:address", element: <TokenDetail /> },
      { path: "send-token/:address", element: <SendToken /> },
      { path: "permissions", element: <Permissions /> },
      // Approval routes — standalone popup windows, no layout chrome
      { path: "connect", element: <ConnectionApproval /> },
      { path: "transaction", element: <TransactionApproval /> },
      { path: "sign", element: <SigningApproval /> },
      { path: "grant-permissions", element: <GrantPermissionsApproval /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
