"""Build the first rare room: four moss beds and eight azalea bushes.

The central cross and all authored entrances are unchanged. Only ground-floor
oak and selected decorative buttons are replaced; every other NBT value stays.
Run after build_castle_room_materials.py.
"""
from pathlib import Path
import argparse
import copy
import json
import amulet_nbt
from build_castle_navigation_catalog import load_structure, foot_nodes, connected_components


def build(pack):
    directory = pack / 'structures/infinite_castle/generated_variants'
    source = directory / 'castle_part_002_up_r3_rare.mcstructure'
    destination = directory / 'castle_part_002_up_r3_rare_garden.mcstructure'
    original = amulet_nbt.load(str(source), compressed=False, little_endian=True)
    document = copy.deepcopy(original)
    structure = document.tag['structure']
    palette = structure['palette']['default']['block_palette']
    original_palette_length = len(palette)
    size = tuple(int(n) for n in document.tag['size'])
    assert size == (43, 31, 43)
    layer = structure['block_indices'][0]
    indices = {}
    for name in ('moss_block', 'azalea', 'flowering_azalea'):
        block = copy.deepcopy(next(b for b in palette if b['name'].py_str == 'minecraft:oak_planks'))
        block['name'] = amulet_nbt.StringTag(f'minecraft:{name}')
        indices[name] = len(palette)
        palette.append(block)
    changed = {}

    def put(x, y, z, name, expected):
        index = (x * size[1] + y) * size[2] + z
        old = int(layer[index])
        old_name = 'minecraft:air' if old == -1 else palette[old]['name'].py_str
        assert old_name in expected, (x, y, z, old_name)
        changed[index] = old
        layer[index] = amulet_nbt.IntTag(indices[name])

    for cx in (12, 30):
        for cz in (12, 30):
            for x in range(cx - 2, cx + 3):
                for z in range(cz - 2, cz + 3):
                    put(x, 0, z, 'moss_block', {'minecraft:oak_planks'})
            put(cx, 1, cz, 'flowering_azalea', {'minecraft:air', 'minecraft:wooden_button'})
            put(cx + 1, 1, cz + 1, 'azalea', {'minecraft:air', 'minecraft:wooden_button'})
    document.save_to(str(destination), compressed=False, little_endian=True)

    check = amulet_nbt.load(str(destination), compressed=False, little_endian=True)
    for index, old in changed.items():
        check.tag['structure']['block_indices'][0][index] = amulet_nbt.IntTag(old)
    check.tag['structure']['palette']['default']['block_palette'] = amulet_nbt.ListTag(
        list(check.tag['structure']['palette']['default']['block_palette'])[:original_palette_length])
    assert check.tag == original.tag, 'Unexpected edits outside the garden beds'

    size, solid, names = load_structure(destination)
    # Audit bushes conservatively as solid even if the general scanner treats
    # plants as passable. Doorway walls are opened later by the runtime.
    solid.update((cx + offset, 1, cz + offset) for cx in (12, 30) for cz in (12, 30) for offset in (0, 1))
    ground = next(c for c in connected_components(foot_nodes(solid, size)) if (21, 1, 21) in c)
    doors = {(21, 1, 8), (21, 1, 34), (8, 1, 21), (34, 1, 21)}
    assert doors <= ground, 'A garden bed blocked a doorway'
    return {'ok': True, 'asset': destination.name, 'moss': 100, 'bushes': 8,
            'changedBlocks': len(changed), 'connectedDoorApproaches': len(doors),
            'otherNbtPreserved': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pack', type=Path)
    print(json.dumps(build(parser.parse_args().pack)))
