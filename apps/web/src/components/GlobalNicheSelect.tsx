"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { NICHES, getNiche } from "@/shared/niches";

export default function GlobalNicheSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedNiche = getNiche(searchParams.get("niche"));

  function handleChange(nextNicheId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("niche", nextNicheId);

    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <label className="global-niche-select" aria-label="Select niche">
      <span>Niche</span>
      <select
        value={selectedNiche.id}
        onChange={(event) => handleChange(event.target.value)}
        disabled={isPending}
      >
        {NICHES.map((niche) => (
          <option key={niche.id} value={niche.id}>
            {niche.shortName}
          </option>
        ))}
      </select>
    </label>
  );
}
