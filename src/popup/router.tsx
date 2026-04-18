/**
 * Router Configuration
 * HashRouter for Chrome extension compatibility
 */

import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "./App";

// Pages
import { Home } from "./pages/Home";
import { Send } from "./pages/Send";
import { SendToken } from "./pages/SendToken";
import { Receive } from "./pages/Receive";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";
import { Tokens } from "./pages/Tokens";
import { TokenDetail } from "./pages/TokenDetail";
import { Permissions } from "./pages/Permissions";

// Approval pages
import { ConnectionApproval } from "./pages/approval/ConnectionApproval";
import { TransactionApproval } from "./pages/approval/TransactionApproval";
import { SigningApproval } from "./pages/approval/SigningApproval";
import { GrantPermissionsApproval } from "./pages/approval/GrantPermissionsApproval";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "send", element: <Send /> },
      { path: "receive", element: <Receive /> },
      { path: "tokens", element: <Tokens /> },
      { path: "token/:address", element: <TokenDetail /> },
      { path: "send-token/:address", element: <SendToken /> },
      { path: "history", element: <History /> },
      { path: "settings", element: <Settings /> },
      { path: "permissions", element: <Permissions /> },
      { path: "connect", element: <ConnectionApproval /> },
      { path: "transaction", element: <TransactionApproval /> },
      { path: "sign", element: <SigningApproval /> },
      { path: "grant-permissions", element: <GrantPermissionsApproval /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
