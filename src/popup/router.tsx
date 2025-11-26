/**
 * Router Configuration
 * HashRouter for Chrome extension compatibility
 */

import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "./App";

// Pages
import { Home } from "./pages/Home";
import { Send } from "./pages/Send";
import { Receive } from "./pages/Receive";
import { Settings } from "./pages/Settings";
import { History } from "./pages/History";

// Approval pages
import { ConnectionApproval } from "./pages/approval/ConnectionApproval";
import { TransactionApproval } from "./pages/approval/TransactionApproval";
import { SigningApproval } from "./pages/approval/SigningApproval";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "send", element: <Send /> },
      { path: "receive", element: <Receive /> },
      { path: "history", element: <History /> },
      { path: "settings", element: <Settings /> },
      { path: "connect", element: <ConnectionApproval /> },
      { path: "transaction", element: <TransactionApproval /> },
      { path: "sign", element: <SigningApproval /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
