import React from "react";
import { createRoot } from "react-dom/client";
import { PDFStudio } from "../src/components/PDFStudio";
import "../src/index.css";
const params = new URLSearchParams(location.search);
document.documentElement.classList.toggle("dark", params.has("dark"));
createRoot(document.getElementById("root")!).render(
  <div>
    {params.has("appHeader") && (
      <header
        style={{
          position: "sticky",
          top: 0,
          height: 64,
          zIndex: 50,
          background: "white",
        }}
      >
        Shift Hours
      </header>
    )}
    <main className="overflow-visible">
      <PDFStudio
        toolbarTop={params.has("appHeader") ? 64 : 0}
        language={(params.get("lang") || "pt") as "pt" | "en" | "es"}
        onBack={() => {}}
      />
    </main>
  </div>,
);
