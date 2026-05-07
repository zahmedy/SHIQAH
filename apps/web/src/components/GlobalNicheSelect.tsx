"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";

import { NICHES, getNiche } from "@/shared/niches";
import { saveNichePreference } from "@/shared/niche-preference";

type GlobalNicheSelectProps = {
  initialNicheId?: string;
};

export default function GlobalNicheSelect({ initialNicheId }: GlobalNicheSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedNiche = getNiche(searchParams.get("niche") ?? initialNicheId);

  useEffect(() => {
    const nicheParam = searchParams.get("niche");
    if (nicheParam) {
      saveNichePreference(getNiche(nicheParam).id);
    }
  }, [searchParams]);

  function handleChange(nextNicheId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("niche", nextNicheId);
    saveNichePreference(nextNicheId);

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
