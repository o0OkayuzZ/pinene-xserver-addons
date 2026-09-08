import {
  world,
  system,
  ItemStack
} from "@minecraft/server";
system.beforeEvents.startup.subscribe((event) => {
  event.itemComponentRegistry.registerCustomComponent('dungeons:spinblade', {
    onUse(e, { params }) {
      const player = e.source;
      const item = e.itemStack;
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
  });

});
const dimensionIds = ["overworld", "nether", "the_end"];

//Spinblade Return
system.runInterval(() => {
  for (let dimId of dimensionIds) {
    for (let entity of world.getDimension(dimId).getEntities({
      families: ["spinblade_projectile"]
    })) {

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