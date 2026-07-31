import type { Metadata } from "next";
import TravelApp from "./travel-app";

export const metadata: Metadata = {
  title: "LOCI — AI Trip Conductor",
  description:
    "A context-aware travel planner for routes, places, weather, style, and community.",
};

export default function Home() {
  return <TravelApp />;
}
