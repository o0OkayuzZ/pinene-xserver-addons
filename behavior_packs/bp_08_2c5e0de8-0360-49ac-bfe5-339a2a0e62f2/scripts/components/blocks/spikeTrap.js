import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:spike_trap', {
        onRedstoneUpdate(e) {
            const block = e.block;
            const newPower = e.powerLevel;
            const oldPower = e.previousPowerLevel
            const dim = e.dimension;
            if(!dim.isChunkLoaded(block.location)) return;
            const perm = block.permutation
            const active = perm.getState("dungeons:active")
            if (oldPower > 0) return;
            if (newPower == 0) return;
            if(active) return
            activate(block, dim)
        },
        onTick(e) {
            const block = e.block;
            const dim = e.dimension
            if(!dim.isChunkLoaded(block.location)) return;
            const perm = block.permutation
            const active = perm.getState("dungeons:active")
            if(active) {
                dim.playSound("tile.piston.in", block.center(), {pitch:1.2,volume:0.01})
                block.setPermutation(perm.withState("dungeons:active", false))
            } else {
                if(dim.id.includes("dungeons:ancientdim_")) { 
                    if(world.getDynamicProperty("dungeons:spike")) activate(block, dim)
                }
            }
        }
    })
})

const canSpikeThru = [
    "minecraft:air",
    "minecraft:vines",
    "minecraft:vine"
]

function activate(block, dim) {
    if(dim.isChunkLoaded(block) == false || !canSpikeThru.includes(block.above().typeId)) return;
    const perm = block.permutation
    block.setPermutation(perm.withState("dungeons:active", true))
    if(dim.id.includes("dungeons:ancientdim_")) {
        const playerC = dim.getPlayers({location: block.location, maxDistance: 16})
        if(playerC.length == 0) return;
    }
    dim.playSound("block.spike_trap.slice", block.center(), {pitch:0.8,volume:0.15})
    dim.playSound("tile.piston.out", block.center(), {pitch:1.2,volume:0.05})
    dim.spawnEntity("dungeons:spike_trap_entity", block.above().bottomCenter())
}

system.runInterval(() => {
    world.setDynamicProperty("dungeons:spike", true)
    system.runTimeout(() => {
        world.setDynamicProperty("dungeons:spike", false)
    },4)
}, 40)