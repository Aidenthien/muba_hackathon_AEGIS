import type { Metadata } from "next";
import DeveloperDocs from "@/components/developer/DeveloperDocs";

export const metadata: Metadata = {
  title: "AEGIS — Developers",
  description:
    "Install the AEGIS extension and add pre-execution transaction security to any Sui dApp in one function call. Setup guide, integration examples, and API reference.",
};

export default function DeveloperPage() {
  return <DeveloperDocs />;
}
