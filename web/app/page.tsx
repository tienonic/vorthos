import { Suspense } from "react";
import {
  Collection,
  CollectionHero,
  CollectionLoading,
} from "@/components/collection";
export default function Page() {
  return (
    <>
      <CollectionHero />
      <Suspense fallback={<CollectionLoading />}>
        <Collection />
      </Suspense>
    </>
  );
}
