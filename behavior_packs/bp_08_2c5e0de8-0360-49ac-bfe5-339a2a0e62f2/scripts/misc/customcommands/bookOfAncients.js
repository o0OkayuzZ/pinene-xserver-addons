import { world, system } from "@minecraft/server";
import { dimensions } from "components/other/bookAncients.js"

const entriesArray = ["all"]
for (const entry of dimensions) entriesArray.push(entry.id)
const bossesDims = []
for (const entry of dimensions) bossesDims.push([entry.id, entry.boss])

system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const PlayerSelector = { name: "victim", type: "PlayerSelector" };
    const GrantRevoke = { name: "dungeons:grant|complete|revoke", type: "Enum" };
    registry.registerEnum("dungeons:grant|complete|revoke", ["grant", "complete", "revoke"])
    const Entries = { name: "dungeons:entry_boa", type: "Enum" };
    registry.registerEnum("dungeons:entry_boa", entriesArray)
    const bookofheroes = {
        name: "dungeons:bookofancients",
        description: "Grant, Complete or Revoke entries in the Book of Ancients.",
        cheatsRequired: true,
        permissionLevel: 1,
        mandatoryParameters: [PlayerSelector, GrantRevoke, Entries]
    }
    registry.registerCommand(bookofheroes,
        (source, victim, granttype, entry) => {
            const owner = source.sourceEntity
            system.run(() => {
                for (let player of victim) {
                    if (granttype == "grant") {
                        var count = 0
                        if (entry == "all") {
                            for (const element of entriesArray) {
                                if (player.hasTag("dungeons:boa_" + element) == false) {
                                    player.addTag("dungeons:boa_" + element)
                                    count += 1
                                }
                            }
                        } else if (entriesArray.includes(entry)) {
                            if (player.hasTag("dungeons:boa_" + entry) == false) {
                                player.addTag("dungeons:boa_" + entry)
                                count += 1
                            }
                        }
                        if (world.gameRules.sendCommandFeedback == true) {
                            if (count == 0) {
                                owner.sendMessage(`Could not grant any specified entries to ${player.name}`)
                            } else if (count == 1) {
                                owner.sendMessage(`Granted ${count} entry to ${player.name}`)
                            } else {
                                owner.sendMessage(`Granted ${count} entries to ${player.name}`)
                            }
                        }
                    } else if (granttype == "complete") {
                        var count = 0
                        if (entry == "all") {
                            for (const element of entriesArray) {
                                const boss = findBoss(element)
                                if (player.hasTag("dungeons:boa_" + element) == false) {
                                    player.addTag("dungeons:boa_" + element)
                                    count += 1
                                } else if(boss && !player.hasTag("dungeons:boa_defeated_" + boss)) {
                                    count += 1
                                }
                                player.addTag("dungeons:boa_defeated_" + boss)
                            }
                        } else if (entriesArray.includes(entry)) {
                                const boss = findBoss(entry)
                            if (player.hasTag("dungeons:boa_" + entry) == false) {
                                player.addTag("dungeons:boa_" + entry)
                                count += 1
                            } else if(boss && !player.hasTag("dungeons:boa_defeated_" + boss)) {
                                    count += 1
                                }
                                player.addTag("dungeons:boa_defeated_" + boss)
                        }
                        if (world.gameRules.sendCommandFeedback == true) {
                            if (count == 0) {
                                owner.sendMessage(`Could not grant any specified entries to ${player.name}`)
                            } else if (count == 1) {
                                owner.sendMessage(`Granted ${count} entry to ${player.name}`)
                            } else {
                                owner.sendMessage(`Granted ${count} entries to ${player.name}`)
                            }
                        }
                    } else if (granttype == "revoke") {
                        var count = 0
                        if (entry == "all") {
                            for (const element of entriesArray) {
                                const boss = findBoss(element)

                                if (player.hasTag("dungeons:boa_" + element) == true) {
                                    player.removeTag("dungeons:boa_" + element)
                                    count += 1
                                } else if(boss && player.hasTag("dungeons:boa_defeated_" + boss)) {
                                    count += 1
                                }
                                player.removeTag("dungeons:boa_defeated_" + boss)
                            }
                        } else if (entriesArray.includes(entry)) {
                                const boss = findBoss(entry)
                            if (player.hasTag("dungeons:boa_" + entry) == true) {
                                player.removeTag("dungeons:boa_" + entry)
                                count += 1
                            } else if(boss && player.hasTag("dungeons:boa_defeated_" + boss)) {
                                    count += 1
                            }
                            player.removeTag("dungeons:boa_defeated_" + boss)
                        }
                        if (world.gameRules.sendCommandFeedback == true) {
                            if (count == 0) {
                                owner.sendMessage(`Could not revoke any specified entries to ${player.name}`)
                            } else if (count == 1) {
                                owner.sendMessage(`Revoked ${count} entry from ${player.name}`)
                            } else {
                                owner.sendMessage(`Revoked ${count} entries from ${player.name}`)
                            }
                        }
                    }
                }
            })
        }
    );
});

function findBoss(dim) {
    for(const entry of bossesDims) {
        if(entry[0] == dim) return entry[1]
    }
    return undefined
}