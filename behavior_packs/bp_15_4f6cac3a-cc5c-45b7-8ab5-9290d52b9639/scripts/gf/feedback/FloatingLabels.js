import { feedbackConfig, formatDamage, damageColour } from "./config.js";

export class FloatingLabels {
  constructor(system, config = feedbackConfig) { this.system = system; this.config = config; this.targets = new Map(); this.count = 0; }
  damage(target, damage) { this.show(target, `${damageColour(damage, this.config.colours)}${formatDamage(damage)}`); }
  block(target) { this.show(target, "§bBLOCK"); }
  show(target, text) {
    if (!target) return;
    if (target.typeId === "dungeons:target_dummy" || target.typeId === this.config.entityId || target.isValid === false) return;
    const targetId = target.id, count = this.targets.get(targetId) ?? 0;
    if (count >= this.config.perTargetLimit || this.count >= this.config.globalLimit) return;
    let label;
    try {
      const head = target.getHeadLocation();
      label = target.dimension.spawnEntity(this.config.entityId, { x: head.x, y: head.y + this.config.headOffset, z: head.z });
      label.nameTag = `§l${text}`;
    } catch { try { label?.remove(); } catch {} return; }
    this.targets.set(targetId, count + 1); this.count++;
    this.system.runTimeout(() => { try { if (label.isValid) label.nameTag = text; } catch {} }, this.config.boldTicks);
    // The entity component owns despawn; this one-shot only releases rate-limit bookkeeping.
    this.system.runTimeout(() => {
      const remaining = (this.targets.get(targetId) ?? 1) - 1;
      if (remaining) this.targets.set(targetId, remaining); else this.targets.delete(targetId);
      this.count--;
    }, this.config.lifetimeTicks);
  }
}
