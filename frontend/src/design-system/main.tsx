import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Sandbox from "./Sandbox";
// The app's real stylesheet, untouched; the sandbox and postcard layers sit on top of it.
import "../styles.css";
import "./postcard.css";
import "./sandbox.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sandbox />
  </StrictMode>,
);
