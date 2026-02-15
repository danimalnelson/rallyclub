import Link from "next/link";
import { Button } from "@wine-club/ui";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">Wine Club SaaS</h1>
        <p className="text-lg mb-8">B2B2C Wine Club Platform</p>
        <div className="flex gap-4">
          <Link href="/app">
            <Button>Business Dashboard</Button>
          </Link>
          <Link href="/rubytap">
            <Button variant="secondary">View Sample Business</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

