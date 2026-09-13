import contentRegistry from '../data/content-registry.json';
import packRegistry from '../data/pack-registry.json';
import updateRegistry from '../data/updates.json';
import { projectPublicData } from './public-data.mjs';
const published = projectPublicData(contentRegistry.contents, packRegistry.packs, updateRegistry);
export const contents = published.contents;
export const packs = published.packs;
export const updates = published.updates;
export type Content = (typeof contents)[number];
export const contentMap = new Map(contents.map(content => [content.id, content]));
export const packMap = new Map(packs.map(pack => [pack.uuid, pack]));
export function withBase(path = '/') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
export function relatedForContent(content: Content) {
  return contents.filter(item => content.related.includes(item.id));
}
export function packsForContent(content: Content) {
  return content.packBindings.flatMap(binding => {
    const pack = packMap.get(binding.uuid);
    return pack ? [{ ...pack, roles: binding.roles }] : [];
  });
}