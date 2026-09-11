"""Derive room assets by replacing ONLY stripped spruce palette names.

Geometry, both block layers, block states (including pillar_axis), entities,
and all other NBT data are preserved and checked after writing.
"""
from pathlib import Path
import argparse
import copy
import json
import re
import amulet_nbt


def build(pack):
    directory = pack / 'structures/infinite_castle/generated_variants'
    results = []
    for source in sorted(directory.glob('castle_part_002_*.mcstructure')):
        if not re.fullmatch(r'castle_part_002_(up|down|east|south)_r\d+', source.stem):
            continue
        original = amulet_nbt.load(str(source), compressed=False, little_endian=True)
        for theme, name in [('boss', 'minecraft:crimson_stem'), ('rare', 'minecraft:warped_stem')]:
            document = copy.deepcopy(original)
            palette = document.tag['structure']['palette']['default']['block_palette']
            indices = []
            for index, block in enumerate(palette):
                if block['name'].py_str == 'minecraft:stripped_spruce_log':
                    block['name'] = amulet_nbt.StringTag(name)
                    indices.append(index)
            if not indices:
                raise ValueError(f'No stripped spruce in {source}')
            destination = source.with_stem(f'{source.stem}_{theme}')
            document.save_to(str(destination), compressed=False, little_endian=True)
            restored = amulet_nbt.load(str(destination), compressed=False, little_endian=True)
            restored_palette = restored.tag['structure']['palette']['default']['block_palette']
            for index in indices:
                assert restored_palette[index]['name'].py_str == name
                restored_palette[index]['name'] = amulet_nbt.StringTag('minecraft:stripped_spruce_log')
            assert restored.tag == original.tag, f'Unexpected NBT changes: {destination}'
            results.append({'asset': destination.name, 'paletteEntries': len(indices)})
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pack', type=Path)
    args = parser.parse_args()
    print(json.dumps(build(args.pack), ensure_ascii=False))
