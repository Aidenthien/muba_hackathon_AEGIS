import type { Metadata } from "next";
import LightDemoAppLoader from "@/components/demo/LightDemoAppLoader";

export const metadata: Metadata = {
  title: "AEGIS — Transaction Lab (Presentation Light)",
  description:
    "Connect a Sui wallet or sign in with Google (zkLogin) to test real-time AI agent transaction risk scoring and simulation.",
};

export default function LightDemoPage() {
  return <LightDemoAppLoader />;
}
