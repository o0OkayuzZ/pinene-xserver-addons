// Build-time whitelist. Draft/private entries and entries owned by hidden content
// cannot reach templates, search attributes or related links.
export function publishEntries(records, contentIds) {
  const visible = records.filter(record => record.visibility === 'public' && contentIds.has(record.contentId));
  const ids = new Set(visible.map(record => record.id));
  return visible.map(record => ({
    id: record.id, name: record.name, kind: record.kind, contentId: record.contentId,
    summary: record.summary, description: record.description, usage: record.usage,
    obtaining: record.obtaining, details: record.details.map(detail => String(detail)),
    image: record.image ? { src: record.image.src, alt: record.image.alt, kind: record.image.kind } : null,
    recipe: record.recipe && ids.has(record.recipe.resultId) ? {
      shaped: record.recipe.shaped, grid: record.recipe.grid.map(row => row.map(cell => String(cell))),
      ingredients: record.recipe.ingredients.map(item => ({ name: item.name, count: item.count })),
      resultId: record.recipe.resultId, count: record.recipe.count,
    } : null,
  }));
}
