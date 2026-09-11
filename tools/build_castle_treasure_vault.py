"""Derive a vault from the blue room; audit NBT differences and navigation."""
from pathlib import Path
import argparse
import copy
import json
import amulet_nbt
from build_castle_navigation_catalog import load_structure, foot_nodes, connected_components


def build(pack):
    directory = pack / 'structures/infinite_castle/generated_variants'
    source = directory / 'castle_part_002_up_r3_rare.mcstructure'
    destination = directory / 'castle_part_002_up_r3_rare_vault.mcstructure'
    original = amulet_nbt.load(str(source), compressed=False, little_endian=True)
    document = copy.deepcopy(original)
    structure = document.tag['structure']
    palette = structure['palette']['default']['block_palette']
    palette_length = len(palette)
    assert tuple(int(n) for n in document.tag['size']) == (43, 31, 43)
    layer = structure['block_indices'][0]
    ids = {}
    for name in ('gold_block', 'bookshelf'):
        block = copy.deepcopy(next(b for b in palette if b['name'].py_str == 'minecraft:oak_planks'))
        block['name'] = amulet_nbt.StringTag(f'minecraft:{name}')
        ids[name] = len(palette)
        palette.append(block)
    changed = {}
    def put(x, y, z, name):
        index = (x * 31 + y) * 43 + z
        old = int(layer[index])
        old_name = 'minecraft:air' if old == -1 else palette[old]['name'].py_str
        assert old_name in ({'minecraft:oak_planks'} if y == 0 else {'minecraft:air'}), (x, y, z, old_name)
        changed[index] = old
        layer[index] = amulet_nbt.IntTag(ids[name])
    for cx in (11, 31):
        for cz in (11, 31):
            for x in range(cx - 1, cx + 2):
                for z in range(cz - 1, cz + 2):
                    put(x, 0, z, 'gold_block')
            shelf_z = 9 if cz == 11 else 33
            for x in range(cx - 1, cx + 2):
                for y in (1, 2):
                    put(x, y, shelf_z, 'bookshelf')
    document.save_to(str(destination), compressed=False, little_endian=True)
    check = amulet_nbt.load(str(destination), compressed=False, little_endian=True)
    for index, old in changed.items():
        check.tag['structure']['block_indices'][0][index] = amulet_nbt.IntTag(old)
    check.tag['structure']['palette']['default']['block_palette'] = amulet_nbt.ListTag(
        list(check.tag['structure']['palette']['default']['block_palette'])[:palette_length])
    assert check.tag == original.tag
    size, solid, names = load_structure(destination)
    doors = {(21, 1, 8), (21, 1, 34), (8, 1, 21), (34, 1, 21)}
    for chest in ((11, 1, 11), (31, 1, 11), (11, 1, 31), (31, 1, 31)):
        assert all((chest[0], y, chest[2]) not in solid for y in (1, 2, 3))
        ground = next(c for c in connected_components(foot_nodes(solid | {chest}, size)) if (21, 1, 21) in c)
        assert doors <= ground
        assert (chest[0] + 1, 1, chest[2]) in ground
    return {'ok': True, 'goldBlocks': 36, 'bookshelves': 24, 'chestSites': 4,
            'connectedApproaches': 4, 'otherNbtPreserved': True, 'asset': destination.name}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pack', type=Path)
    print(json.dumps(build(parser.parse_args().pack)))
