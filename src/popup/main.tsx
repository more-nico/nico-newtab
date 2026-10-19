import React from "react";
import ReactDOM from "react-dom/client";
import "nico-glass-kit/style.css";
import "./popup.css";
import { Popup } from "./Popup";
import { configureLocale, currentLocale, detectLocale, t } from "../lib/i18n";

configureLocale(detectLocale());
document.documentElement.lang = currentLocale();
document.title = t().common.meta.popupTitle;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
