import type { Metadata } from "next";
import DemoAppLoader from "@/components/demo/DemoAppLoader";

export const metadata: Metadata = {
  title: "AEGIS — Transaction Lab",
  description:
    "Connect a Sui wallet, build a transaction, and watch the AEGIS agent parse, simulate, and risk-score it before you sign.",
};

export default function DemoPage() {
  return <DemoAppLoader />;
}
