import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { CircleAuthProvider } from "./lib/circle-auth";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CircleAuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CircleAuthProvider>
  </StrictMode>
);
