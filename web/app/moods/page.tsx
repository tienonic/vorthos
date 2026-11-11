import { Suspense } from "react";
import { Moods } from "@/components/moods";
export const metadata = { title: "Moods" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="page-width moods-page" aria-label="Loading moods" />
      }
    >
      <Moods />
    </Suspense>
  );
}
