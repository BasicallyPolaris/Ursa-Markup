/**
 * Settings window entry point
 * This is loaded in a separate Tauri window for the settings UI
 */

import React from "react"
import ReactDOM from "react-dom/client"
import SettingsApp from "./SettingsApp"
import "./App.css"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
)
