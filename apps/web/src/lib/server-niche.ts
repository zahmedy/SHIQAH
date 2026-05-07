import { cookies } from "next/headers";

import { getNiche } from "@/shared/niches";
import { NICHE_COOKIE_NAME } from "@/shared/niche-preference";

export async function getServerNiche(queryNiche?: string | null) {
  if (queryNiche) return getNiche(queryNiche);

  const cookieStore = await cookies();
  return getNiche(cookieStore.get(NICHE_COOKIE_NAME)?.value);
}
