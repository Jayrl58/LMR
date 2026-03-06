import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const el = document.getElementById("app");

if (!el) {
  throw new Error("Missing #app element");
}

ReactDOM.createRoot(el).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);