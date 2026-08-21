import React, { useState } from "react";
import VelorraStorefront from "./store/StoreApp.jsx";
import VelorraAdmin from "./admin/AdminApp.jsx";

/**
 * One site, two modes. The storefront is what every visitor sees by default.
 * The admin panel is only reached by clicking "Admin" at the bottom of the
 * storefront's nav bar (desktop category row or mobile drawer), and is
 * gated behind its own login regardless of how someone gets there.
 */
export default function App() {
  const [mode, setMode] = useState("store"); // "store" | "admin"

  if (mode === "admin") {
    return <VelorraAdmin onExit={() => setMode("store")} />;
  }
  return <VelorraStorefront onGoAdmin={() => setMode("admin")} />;
}
