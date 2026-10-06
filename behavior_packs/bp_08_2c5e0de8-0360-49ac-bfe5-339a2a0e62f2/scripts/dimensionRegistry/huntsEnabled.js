import { world, system } from "@minecraft/server";

var isHuntsEnabled = true
if(world.getPackSettings()["dungeons:ancient_hunts"] !== undefined) isHuntsEnabled = world.getPackSettings()["dungeons:ancient_hunts"]
export {isHuntsEnabled}

system.runInterval(() => {
    if(isHuntsEnabled) return;
    for(const player of world.getPlayers()) {
        if(player.dimension.id.includes("dungeons:ancientdim")) {
            var spawnPoint = player.getSpawnPoint()
            if(spawnPoint == undefined) {
                const worldSpawn = world.getDefaultSpawnLocation()
                spawnPoint = {x:worldSpawn.x,y:worldSpawn.y,z:worldSpawn.z,dimension:world.getDimension("minecraft:overworld")}
            }
            player.teleport({x:spawnPoint.x,y:spawnPoint.y,z:spawnPoint.z}, {dimension: spawnPoint.dimension})
            const runInt = system.runInterval(() => {
                if(player.isValid && player.location.y > 320) {
                    if(!spawnPoint.dimension.isChunkLoaded({x:player.location.x,y:64,z:player.location.z})) return
                    const topMost = player.dimension.getTopmostBlock({x:player.location.x,z:player.location.z}, 320)
                    if(topMost) {
                        player.teleport(topMost.above().bottomCenter())
                    } else {
                        player.teleport({x:player.location.x, y:320, z:player.location.z})
                    }
                    console.warn(player.name + " was forcefully removed from an Ancient Hunt")
                    system.clearRun(runInt)
                }
            })
        }
    }
}, 10)