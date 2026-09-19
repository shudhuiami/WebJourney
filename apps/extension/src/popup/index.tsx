import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { Popup } from "./Popup";

ReactDOM.createRoot(document.getElementById("popup-root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
