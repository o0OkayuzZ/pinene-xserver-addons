import { world, system } from "@minecraft/server";
import {returnDimension} from "dimensionRegistry/main.js"

system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const exithunt = {
        name: "dungeons:exithunt",
        description: "§eExit from an ancient hunt if out of combat",
        cheatsRequired: false,
        permissionLevel: 0
    }
    registry.registerCommand(exithunt,
        (source, style) => {
            const owner = source.sourceEntity
            system.run(() => {
                if(owner.dimension.id.includes("dungeons:ancientdim_") == false) return owner.sendMessage("You are not in an Ancient Hunt!")
                if(owner.hasTag("dungeons:prepare_exit_ancienthunt")) {
                    owner.playSound("beacon.deactivate", {pitch: 1.5, volume:1.5})
                    owner.removeTag("dungeons:prepare_exit_ancienthunt")
                    return owner.sendMessage("§7§oTeleport Cancelled")
                } else {
                    owner.playSound("beacon.activate", {pitch: 1.5, volume:1.5})
                    owner.addTag("dungeons:prepare_exit_ancienthunt")
                    owner.sendMessage("§7§oTeleporting in 5 seconds...")
                    if(!owner.hasTag("dungeons:exit_ancienthunt_tutorial")) {
                        owner.addTag("dungeons:exit_ancienthunt_tutorial")
                        owner.sendMessage("§e§oCancel by running the command again, or taking damage")
                    }
                    var i = 0
                    const timer = system.runInterval(() => {
                        i += 1
                        owner.addEffect("slowness", 105 - i, {amplifier: 3})
                        //console.warn(i)
                        if(!owner || !owner.isValid || !owner.hasTag("dungeons:prepare_exit_ancienthunt") || !owner.dimension.id.includes("dungeons:ancientdim_")) {
                            if(owner.hasTag("dungeons:prepare_exit_ancienthunt")) {
                                owner.removeTag("dungeons:prepare_exit_ancienthunt")
                                owner.sendMessage("§7§oTeleport Cancelled")
                                owner.playSound("beacon.deactivate", {pitch: 1.5, volume:1.5})
                            }
                            system.clearRun(timer)
                        } else {
                            if(i >= 100) {
                                owner.removeTag("dungeons:prepare_exit_ancienthunt")
                                var hasFoundExit = false
                                const markerList = owner.dimension.getEntities({location: owner.location, maxDistance:256, type: "dungeons:ancient_hunt_marker",closest:1})
                                if(markerList.length == 0) {
                                    owner.addTag("dungeons:portal_proof")
                                    owner.setDynamicProperty("dungeons:ancient_portal_travel_time", 0)
                                    returnDimension(owner)
                                    return
                                }
                                const marker = markerList[0]
                                if(marker.getDynamicProperty("dungeons:exit_portal_location") !== undefined) hasFoundExit = true
                                if(!hasFoundExit) {
                                    owner.sendMessage("§e§oExit Portal Generated!")
                                    owner.dimension.runCommand('/structure load "mystructure:ancient_hunt/fallback_portal" ' + `${owner.location.x-1} ${owner.location.y - 1} ${owner.location.z-1}`)
                                    marker.setDynamicProperty("dungeons:exit_portal_location", owner.location)
                                } else {
                                    owner.addTag("dungeons:portal_proof")
                                    owner.setDynamicProperty("dungeons:ancient_portal_travel_time", 0)
                                    returnDimension(owner)
                                    return;
                                }
                            }
                        }
                    },1)
                }
            })
        }
    );
});

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if(!hurt || !hurt.isValid || !hurt.hasTag("dungeons:prepare_exit_ancienthunt") || hurt.typeId !== "minecraft:player") return;
    hurt.playSound("beacon.deactivate", {pitch: 1.5, volume:1.5})
    hurt.removeTag("dungeons:prepare_exit_ancienthunt")
    return hurt.sendMessage("§7§oTeleport Cancelled")
})
