import type { Metadata } from "next";
import { GymMode } from "@/components/train/gym-mode";

export const metadata: Metadata = { title: "Session" };

export default function SessionPage() {
  return <GymMode />;
}
