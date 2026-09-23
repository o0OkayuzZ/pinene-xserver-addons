import { feedbackConfig } from "./config.js";

// beforeHurt associates the engine call with the scoped GF applyDamage invocation.
// Foreign magic events are FIFO barriers, not eligible tickets. No damage estimate is displayed.
export class DamageTickets {
  constructor(system, onDamage, cause, config = feedbackConfig) {
    this.system = system; this.onDamage = onDamage; this.cause = cause; this.config = config;
    this.records = new Map(); this.active = []; this.nonce = 0; this.size = 0; this.timer = undefined;
    this.suppressedUntil = -1;
  }
  key(target, source, cause) { return JSON.stringify([target?.id, source?.id ?? null, cause]); }
  reset() { this.records.clear(); this.size = 0; }
  before(event) {
    if (event.damageSource.cause !== this.cause || this.system.currentTick < this.suppressedUntil) return;
    if (event.cancel) return;
    if (this.size >= this.config.maxRecords) {
      // Fail closed under overload: discard correlation rather than relabel a foreign hit.
      this.records.clear(); this.size = 0; this.suppressedUntil = this.system.currentTick + this.config.ticketTicks;
      this.schedule(); return;
    }
    const key = this.key(event.hurtEntity, event.damageSource.damagingEntity, event.damageSource.cause);
    const current = this.active.at(-1);
    const ticket = current?.key === key && !current.bound ? current : null;
    if (ticket) ticket.bound = true;
    const record = { key, ticket, event, createdTick: this.system.currentTick };
    if (!this.records.has(key)) this.records.set(key, []);
    this.records.get(key).push(record); this.size++; this.schedule();
  }
  after(event) {
    if (event.damageSource.cause !== this.cause || this.system.currentTick < this.suppressedUntil) return;
    const key = this.key(event.hurtEntity, event.damageSource.damagingEntity, event.damageSource.cause);
    const queue = this.records.get(key);
    if (!queue) return;
    let record;
    while (queue.length) {
      const candidate = queue.shift(); this.size--;
      if (this.system.currentTick - candidate.createdTick >= this.config.ticketTicks || candidate.event.cancel) continue;
      record = candidate; break;
    }
    if (!queue.length) this.records.delete(key);
    const ticket = record?.ticket;
    if (!ticket || ticket.consumed || !Number.isFinite(event.damage) || event.damage <= 0) return;
    ticket.consumed = true;
    ticket.hit = { ticket, target: event.hurtEntity, damage: event.damage };
    if (ticket.status === "accepted") this.deliver(ticket);
  }
  deliver(ticket) {
    const hit = ticket.hit; ticket.hit = undefined;
    if (hit) { try { this.onDamage(hit); } catch { /* Feedback must never fail combat. */ } }
  }
  apply(target, damage, source, context, operation) {
    const ticket = { ...context, sourceId: source?.id, targetId: target.id, attackId: `gf_${++this.nonce}`,
      createdTick: this.system.currentTick, key: this.key(target, source, this.cause), status: "applying", bound: false, consumed: false };
    this.active.push(ticket);
    try {
      const accepted = operation();
      ticket.status = accepted === true ? "accepted" : "rejected";
      if (accepted === true) this.deliver(ticket);
      return accepted;
    } finally {
      this.active.pop();
      if (ticket.status !== "accepted") {
        const queue = this.records.get(ticket.key);
        if (queue) {
          const retained = queue.filter(record => record.ticket !== ticket); this.size -= queue.length - retained.length;
          if (retained.length) this.records.set(ticket.key, retained); else this.records.delete(ticket.key);
        }
        ticket.hit = undefined;
      }
    }
  }
  schedule() {
    if (this.timer !== undefined) return;
    this.timer = this.system.runTimeout(() => {
      this.timer = undefined;
      for (const [key, records] of this.records) {
        const retained = records.filter(record => this.system.currentTick - record.createdTick < this.config.ticketTicks);
        this.size -= records.length - retained.length;
        if (retained.length) this.records.set(key, retained); else this.records.delete(key);
      }
      if (this.size) this.schedule();
    }, this.config.ticketTicks);
  }
}
