type GmailThreadPage = {
  threads?: { id?: string }[];
  nextPageToken?: string;
};

export async function collectGmailThreadIds({
  listPage,
  limit,
  startPageToken,
}: {
  listPage: (options: { maxResults: number; pageToken?: string }) => Promise<GmailThreadPage>;
  limit: number;
  startPageToken?: string;
}) {
  const ids = new Set<string>();
  let pageToken = startPageToken;
  do {
    const response = await listPage({ maxResults: Math.min(50, limit - ids.size), pageToken });
    for (const thread of response.threads ?? []) {
      if (thread.id) ids.add(thread.id);
    }
    if (response.nextPageToken && response.nextPageToken === pageToken) {
      throw new Error("Gmail returned a repeated page token. Retry loading mail.");
    }
    pageToken = response.nextPageToken;
  } while (pageToken && ids.size < limit);
  return { ids: [...ids], nextPageToken: pageToken ?? null };
}
