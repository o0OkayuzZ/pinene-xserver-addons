export function defenseEffect(card, attack, damage) {
  switch (card.effect.type) {
    case "reduce": return { damage: damage * card.effect.multiplier };
    case "nullify": return { damage: 0 };
    case "nullifyReflect": {
      const p = card.effect.parameters;
      const reflection = !attack.reflected && (attack.reflectionDepth ?? 0) < p.maxReflectionDepth
        && attack.source && attack.source.id !== attack.target?.id
        ? { ...attack, damage: damage * p.reflectionMultiplier, source: attack.target, target: attack.source,
          reflected: true, reflectionDepth: (attack.reflectionDepth ?? 0) + 1,
          metadata: { ...attack.metadata, reflectedBy: card.id } } : undefined;
      if (reflection && !Number.isFinite(reflection.damage)) throw new Error("Invalid reflection damage");
      return { damage: 0, reflection };
    }
    default: throw new Error("Unknown defense effect");
  }
}
