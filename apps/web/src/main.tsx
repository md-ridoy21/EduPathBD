import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./components/AppStatus";
import { QualityAuditPanel } from "./components/QualityAuditPanel";
import { LocaleProvider } from "./lib/locale";
import "leaflet/dist/leaflet.css";
import "react-datepicker/dist/react-datepicker.css";
import "./styles/app.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <AppErrorBoundary><App /></AppErrorBoundary>
      <QualityAuditPanel />
    </LocaleProvider>
  </StrictMode>
);
