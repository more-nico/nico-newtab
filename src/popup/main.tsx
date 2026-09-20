import React from "react";
import ReactDOM from "react-dom/client";
import "nico-glass-kit/style.css";
import "./popup.css";
import { Popup } from "./Popup";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
