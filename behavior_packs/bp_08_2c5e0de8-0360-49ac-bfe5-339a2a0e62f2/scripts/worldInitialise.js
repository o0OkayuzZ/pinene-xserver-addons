import {
  world,
  system
} from "@minecraft/server";

const allScores = [
  'dungeons:shadowform_t',
  'soulGauge',
  'dungeons:powershaker_t',
  'dungeons:powershaker_u',
  'dungeons:music',
  'dungeons:death_barter_t',
  'dungeons:death_barter_lvl',
  'dungeons:glow_squid_armour_t',
  'dungeons:roll_t',
  'dungeons:opulent_armour_t',
  'dungeons:squid_armour_t',
  'dungeons:tp_robes_t',
  'dungeons:ember_robes_t',
  'dungeons:final_shout_t',
  'dungeons:fire_trail_t',
  'dungeons:gravity_pulse_t',
  'dungeons:potion_barrier_t',
  'dungeons:shadow_blast_t',
  'dungeons:corrupted_beacon',
  'dungeons:corrupted_pumpkin',
  'dungeons:guardian_eye',
  'dungeons:bubbled_t',
  'dungeons:hunting_bow_t',
  'dungeons:poison_cloud_ranged_t',
  'dungeons:poison_cloud_t',
  'dungeons:echo_t',
  'dungeons:gravity_t',
  'dungeons:guarding_strike_t',
  'dungeons:pain_cycle_lvl',
  'dungeons:shockwave_t',
  'dungeons:stun_t',
  'dungeons:swirling_t',
  'dungeons:void_strike_t',
  'dungeons:battlestaff_sweep_t',
  'dungeons:rapier_sweep_t',
  'dungeons:stunned_effect_t',
  'dungeons:voided_t',
  'dungeons:snareling_trap_t'
];

world.afterEvents.worldLoad.subscribe(e => {
  world.gameRules.showTags = false
  for (const score of allScores) {
    if (!world.scoreboard.getObjective(score)) {
      world.scoreboard.addObjective(score)
    }
  }
  for (const player of world.getPlayers()) {

    player.setDynamicProperty("dungeons:damage_reduction_prevented", null)
  }
});

world.afterEvents.playerSpawn.subscribe(e => {
  let player = e.player;
  if (e.initialSpawn === false) return;

  player.setDynamicProperty("dungeons:damage_reduction_prevented", null)
  player.removeTag('dungeons:tempest_warn');
  player.removeTag('dungeons:guardian_warn');
  player.removeTag('dungeons:spooky_warn');
  player.removeTag('dungeons:vhoe_warn');
  player.removeTag('dungeons:sword_block');
  player.removeTag('dungeons:using_common_guardian');
  player.removeTag('dungeons:using_rare_guardian');
  player.removeTag('dungeons:using_common_beacon');
  player.removeTag('dungeons:using_rare_beacon');
  player.removeTag("dungeons:has_exit_portal_locator")

  for (const score of allScores) {
    world.scoreboard.getObjective(score).addScore(player, 0);
  }
});
