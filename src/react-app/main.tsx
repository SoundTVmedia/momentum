import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootstrapIonic } from "@/react-app/ionic";
import "@/react-app/ionic.css";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";

bootstrapIonic();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
