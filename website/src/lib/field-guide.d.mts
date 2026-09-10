export interface GuideEntry {
 id: string; name: string; kind: string; contentId: string;
 summary: string; description: string; usage: string; obtaining: string; details: string[];
 image: { src: string; alt: string; kind: string } | null;
 recipe: { shaped: boolean; grid: string[][]; ingredients: { name: string; count: number }[]; resultId: string; count: number } | null;
}
export function publishEntries(records: unknown[], contentIds: Set<string>): GuideEntry[];
