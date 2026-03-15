import type { Route } from "./+types/lab";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Chatroom & Prediction Lab | PI - Predictive Investments" },
    { name: "description", content: "Chatroom and prediction lab" },
  ];
}

export default function Lab() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-semibold">Chatroom & Prediction Lab</h1>
      <p className="text-muted-foreground">
        Community chat and prediction experiments will appear here.
      </p>
      <section className="mt-6 rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">Content coming soon.</p>
      </section>
    </div>
  );
}
