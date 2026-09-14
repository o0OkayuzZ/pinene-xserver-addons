// Field whitelist: internal notes and audit evidence cannot reach templates.
export function projectPublicData(contentRecords, packRecords, updateRecords) {
  const packs = packRecords.filter(p => p.visibility === 'public').map(p => ({
    uuid: p.uuid, name: p.name, kind: p.kind, version: p.version, registered: p.registered,
  }));
  const packIds = new Set(packs.map(p => p.uuid));
  const visible = contentRecords.filter(c => c.visibility === 'public');
  const contentIds = new Set(visible.map(c => c.id));
  const contents = visible.map(c => ({
    id: c.id, name: c.name, summary: c.summary, description: c.description,
    category: c.category, image: { src: c.image.src, alt: c.image.alt, kind: c.image.kind },
    implementation: c.implementation, deployment: c.deployment,
    verification: c.verification.map(v => ({ kind: v.kind, result: v.result })),
    highlights: c.highlights, guide: c.guide,
    children: c.children.filter(i => i.visibility === 'public').map(i => ({ id: i.id, name: i.name, type: i.type })),
    related: c.related.filter(id => contentIds.has(id)),
    packBindings: c.packBindings.filter(b => packIds.has(b.uuid)).map(b => ({ uuid: b.uuid, roles: b.roles })),
  }));
  const updates = updateRecords.filter(u => u.visibility === 'public').map(u => ({
    id: u.id, title: u.title, body: u.body, date: u.date,
  }));
  return { contents, packs, updates };
}
