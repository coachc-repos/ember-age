import { createFileRoute } from "@tanstack/react-router";
import { EmberGame } from "@/components/ember-game";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <EmberGame />;
}
