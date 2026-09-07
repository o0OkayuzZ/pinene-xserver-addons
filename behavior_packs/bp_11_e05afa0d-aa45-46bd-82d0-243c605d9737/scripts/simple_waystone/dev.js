import { world } from "@minecraft/server";
world.afterEvents.itemUse.subscribe(({ source: player, itemStack: item }) => {
    if (!player.hasTag("dev"))
        return;
    if (item.typeId == "minecraft:stick") {
        // world.sendMessage(`${JSON.stringify(world.getDynamicPropertyIds(), null, 2)}`)
        // world.sendMessage(`${JSON.stringify(apiScoreboard.getObj("simple_waystone/p/" + player.id).getParticipants().map(value => value.displayName).sort(), null, 2)}`)
        // for(const score of world.scoreboard.getObjectives()){
        // if(score.id.startsWith("simple_waystone/player")) continue
        // const partes = score.id.split("/")
        // const [ prefix, type ] = partes
        // const newScore = apiScoreboard.getObj(`${prefix}/${type?.slice(0, 1)}/${partes.slice(2).join("/")}`)
        // score.getParticipants().forEach(part => { apiScoreboard.setScore(newScore, part, score.getScore(part)) })
        // score.getParticipants().forEach(part => {  })
        // apiScoreboard.removeObj(score)
        // }
    }
});
