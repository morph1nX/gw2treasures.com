const regex = /\/(?<signature>[^\/]*)\/(?<id>[^\/]*)\.png$/

export function parseIcon(url: string | undefined): { id: number, signature: string } | undefined {
  const match = url?.match(regex)?.groups;

  return match ? {
    id: Number(match.id),
    signature: match.signature
  } : undefined;
}
