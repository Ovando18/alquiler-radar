import { Suspense } from "react";
import { SearchWorkspace } from "./search-workspace";

export default function BuscarPage() {
  return (
    <Suspense>
      <SearchWorkspace />
    </Suspense>
  );
}
