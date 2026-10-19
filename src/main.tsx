import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { configureLocale, currentLocale, detectLocale, t } from "./lib/i18n";
import "nico-glass-kit/style.css";
import "./styles.css";

configureLocale(detectLocale());
document.documentElement.lang = currentLocale();
document.title = t().common.meta.documentTitle;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
