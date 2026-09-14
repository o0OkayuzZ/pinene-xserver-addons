export interface PublicContent {
 id: string; name: string; summary: string; description: string; category: string[];
 image: { src: string; alt: string; kind: string }; implementation: string; deployment: string;
 verification: { kind: string; result: string }[]; highlights: string[]; guide: string;
 children: { id: string; name: string; type: string }[]; related: string[];
 packBindings: { uuid: string; roles: string[] }[];
}
export interface PublicPack { uuid: string; name: string; kind: string; version: string; registered: boolean }
export interface PublicUpdate { id: string; title: string; body: string; date: string | null }
export function projectPublicData(contents: unknown[], packs: unknown[], updates: unknown[]): {
 contents: PublicContent[]; packs: PublicPack[]; updates: PublicUpdate[];
};
