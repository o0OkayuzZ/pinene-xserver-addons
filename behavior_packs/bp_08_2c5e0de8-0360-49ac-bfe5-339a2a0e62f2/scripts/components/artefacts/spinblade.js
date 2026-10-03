import {
  world,
  system,
  ItemStack,
  EntityDamageCause
} from "@minecraft/server";
import { specialDamage } from "main.js"
system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:spinblade', {
    onUse(e) {
      const player = e.source;
      const item = e.itemStack;
      useArtefact(player, item, false)
    }
  });

});

system.afterEvents.scriptEventReceive.subscribe((e) => {
  const id = e.id;
  if (id !== "dungeons:force_artefact") return;
  const player = e.sourceEntity;
  if (!player) return;
  const itemId = e.message;
  if (!itemId) return;
  const item = new ItemStack(itemId, 1)
  if (!item.getComponent("dungeons:spinblade")) return;
  useArtefact(player, item, true)
})

function useArtefact(player, item, finalShout) {
  const params = item.getComponent("dungeons:spinblade").customComponentParameters.params
  const type = params.type;

  if (item.hasTag('dungeons:tome_of_duplication')) {
    if (!player.hasTag('tod:used_spinblade')) return;
  }

  var entityId = "dungeons:spinblade_projectile"
  if (type == "rare") entityId = "dungeons:rare_spinblade_projectile"
  const ammo = player.dimension.spawnEntity(entityId, player.getHeadLocation());
  const proj = ammo.getComponent('projectile');
  proj.owner = player;
  proj.shoot(player.getViewDirection());
}

//Spinblade Return
system.runInterval(() => {
  const dims = []
  for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
  for (const dimensionType of dims) {
    const dim = world.getDimension(dimensionType)
    for (let entity of dim.getEntities({
      families: ["spinblade_projectile"]
    })) {
      if(dim.id == "minecraft:the_end" && entity.location.y < 4) entity.addTag("dungeons:spinblade_returning")
      const proj = entity.getComponent('projectile');
      const owner = proj.owner
      if (!owner) continue;
      if (entity.typeId.includes("rare")) {
        owner.startItemCooldown("spinblade_rare", 2400);
      } else {
        owner.startItemCooldown("spinblade_common", 2400);

      }
      if (entity.hasTag("dungeons:spinblade_returning")) {
        if (owner !== undefined) {
          entity.runCommand(`tp ^^0.2^1 facing ${owner.name}`)
        } else {
          entity.remove()
        }
      }
    }
  }
}, 1)

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
  const mob = e.entity;
  const eventId = e.eventId;
  if (eventId !== 'dungeons:recieved') {
    return;
  }
  const proj = mob.getComponent('projectile');
  const owner = proj.owner
  if (!owner) return;
  if (mob.typeId == "dungeons:rare_spinblade_projectile") {
    owner.startItemCooldown("spinblade_rare", 8);
    mob.remove()
  } else if (mob.typeId == "dungeons:spinblade_projectile") {
    owner.startItemCooldown("spinblade_common", 8);
    mob.remove()

  }
})

world.beforeEvents.entityHurt.subscribe((e) => {
  const hurt = e.hurtEntity;
  if (!hurt || !hurt.isValid) return;
  const attacker = e.damageSource.damagingEntity;
  if (!attacker || !attacker.isValid || !attacker.typeId.includes("spinblade_projectile")) return;
  const proj = attacker.getComponent("projectile")
  e.cancel = true;
  if (!proj.owner) return
  system.run(() => {
    specialDamage(proj.owner, hurt, e.damage, EntityDamageCause.entityAttack, ["artefact"], attacker)
  })
})
