import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { SidePanel } from "./SidePanel";

ReactDOM.createRoot(document.getElementById("sidepanel-root")!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>
);
