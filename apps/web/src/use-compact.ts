import { useEffect, useState } from "react";

const QUERY = "(max-width: 860px)";

/** A phone gets sheets and a dock instead of three columns side by side. */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => matchMedia(QUERY).matches);
  useEffect(() => {
    const media = matchMedia(QUERY);
    const sync = () => setCompact(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return compact;
}
