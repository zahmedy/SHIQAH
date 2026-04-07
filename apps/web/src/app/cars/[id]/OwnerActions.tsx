"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useLocale } from "@/components/LocaleProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const TOKEN_KEY = "autointel_access_token";

type OwnerActionsProps = {
  ownerId: number;
  carId: number;
};

type MeResponse = {
  id: number;
  phone_e164: string;
  role: string;
  verified_at: string | null;
};

export default function OwnerActions({ ownerId, carId }: OwnerActionsProps) {
  const locale = useLocale();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!API_BASE) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const me = (await res.json()) as MeResponse;
        if (me.id === ownerId) {
          setIsOwner(true);
        }
      } catch {
        // ignore auth errors
      }
    };

    void load();
  }, [ownerId]);

  if (!isOwner) return null;

  return (
    <div className="spaced-top-sm">
      <Link href={`/my-cars/${carId}/edit`} className="btn btn-primary">
        Edit Listing / Upload Photos
      </Link>
    </div>
  );
}
