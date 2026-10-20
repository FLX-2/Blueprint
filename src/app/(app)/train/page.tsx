import type { Metadata } from "next";
import { TrainView } from "@/components/plan/train-view";

export const metadata: Metadata = { title: "Train" };

export default function TrainPage() {
  return <TrainView />;
}
