import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./App.css";
import App from "./App";
import { applyTheme, loadSettings } from "./utils/settings";

applyTheme(loadSettings().theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
