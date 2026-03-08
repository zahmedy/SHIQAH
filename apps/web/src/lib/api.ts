function apiBase(): string {
  const value = process.env.INTERNAL_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE;
  if (!value) {
    throw new Error("INTERNAL_API_BASE or NEXT_PUBLIC_API_BASE is not set.");
  }
  return value.replace(/\/$/, "");
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${text}`.trim());
  }

  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`.trim());
  }

  return res.json();
}
