import { Suspense } from "react";
import { Discover } from "@/components/discover";
export const metadata = { title: "Discover" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="page-width">
          <div className="page-heading">
            <h1>Discover</h1>
            <p>Loading artworks…</p>
          </div>
        </div>
      }
    >
      <Discover />
    </Suspense>
  );
}
