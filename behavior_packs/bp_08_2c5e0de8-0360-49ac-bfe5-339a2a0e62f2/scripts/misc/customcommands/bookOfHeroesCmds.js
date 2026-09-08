import { world, system } from "@minecraft/server";
import { weaponData, bowData, armourData, artefactData } from "components/other/theBookOfHeroes.js"

const entriesArray = ["all"]
for (const entry of weaponData) entriesArray.push(entry.id)
for (const entry of bowData) entriesArray.push(entry.id)
for (const entry of armourData) entriesArray.push(entry.id)
for (const entry of artefactData) entriesArray.push(entry.id)

system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const PlayerSelector = { name: "victim", type: "PlayerSelector" };
    const GrantRevoke = { name: "dungeons:grant|revoke", type: "Enum" };
    registry.registerEnum("dungeons:grant|revoke", ["grant", "revoke"])
    const Entries = { name: "dungeons:entry", type: "Enum" };
    registry.registerEnum("dungeons:entry", entriesArray)
    const bookofheroes = {
        name: "dungeons:bookofheroes",
        description: "英雄の書の項目を解放・解除します。",
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
                                if (player.hasTag("boh_collected:" + element) == false) {
                                    player.addTag("boh_collected:" + element)
                                    count += 1
                                }
                            }
                        } else if (entriesArray.includes(entry)) {
                            if (player.hasTag("boh_collected:" + entry) == false) {
                                player.addTag("boh_collected:" + entry)
                                count += 1
                            }
                        }
                        if (world.gameRules.sendCommandFeedback == true) {
                            if (count == 0) {
                                owner.sendMessage(`${player.name} の指定項目は解放できませんでした。`)
                            } else if (count == 1) {
                                owner.sendMessage(`${player.name} の項目を ${count} 件解放しました。`)
                            } else {
                                owner.sendMessage(`${player.name} の項目を ${count} 件解放しました。`)
                            }
                        }
                    } else if (granttype == "revoke") {
                        var count = 0
                        if (entry == "all") {
                            for (const element of entriesArray) {
                                if (player.hasTag("boh_collected:" + element) == true) {
                                    player.removeTag("boh_collected:" + element)
                                    count += 1
                                }
                            }
                        } else if (entriesArray.includes(entry)) {
                            if (player.hasTag("boh_collected:" + entry) == true) {
                                player.removeTag("boh_collected:" + entry)
                                count += 1
                            }
                        }
                        if (world.gameRules.sendCommandFeedback == true) {
                            if (count == 0) {
                                owner.sendMessage(`${player.name} の指定項目は解除できませんでした。`)
                            } else if (count == 1) {
                                owner.sendMessage(`${player.name} の項目を ${count} 件解除しました。`)
                            } else {
                                owner.sendMessage(`${player.name} の項目を ${count} 件解除しました。`)
                            }
                        }
                    }
                }
            })
        }
    );
});