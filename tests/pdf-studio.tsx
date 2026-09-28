import React from "react";
import { createRoot } from "react-dom/client";
import { PDFStudio } from "../src/components/PDFStudio";
import "../src/index.css";
const params = new URLSearchParams(location.search);
document.documentElement.classList.toggle("dark", params.has("dark"));
createRoot(document.getElementById("root")!).render(
  <PDFStudio
    language={(params.get("lang") || "pt") as "pt" | "en" | "es"}
    onBack={() => {}}
  />,
);
