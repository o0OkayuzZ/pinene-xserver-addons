from __future__ import annotations

import argparse
import json
from collections import defaultdict, deque
from pathlib import Path

import amulet_nbt
import numpy


AIR_NAMES = {"air", "structure_void"}
OAK_ROUTE_SUPPORTS = {"oak_planks", "oak_slab", "oak_stairs", "oak_wood"}
ROUTE_WIDTH = 5
PLAYER_CLEARANCE = 3
CATEGORY_BY_SOURCE = {
    "castle_part_001": "crossroads",
    "castle_part_002": "room",
    "castle_part_003": "bridge",
    "castle_part_004": "stairs",
    "castle_part_005": "stairs",
    "castle_part_006": "stairs",
}
FACE_DATA = {
    "west": (0, 0, 2),
    "east": (0, 1, 2),
    "north": (2, 0, 0),
    "south": (2, 1, 0),
}


def load_structure(path: Path):
    root = amulet_nbt.load(str(path), compressed=False, little_endian=True).tag
    size = tuple(value.py_int for value in root["size"])
    structure = root["structure"]
    indices = numpy.asarray(
        [value.py_int for value in structure["block_indices"][0]], dtype=numpy.int32
    ).reshape(size)
    palette_root = structure["palette"]
    palette_name = next(iter(palette_root))
    palette = [
        entry["name"].py_str.removeprefix("minecraft:")
        for entry in palette_root[palette_name]["block_palette"]
    ]
    names = numpy.empty(size, dtype=object)
    names[:] = "structure_void"
    valid = indices >= 0
    names[valid] = numpy.asarray(palette, dtype=object)[indices[valid]]
    solid = {
        tuple(int(value) for value in position)
        for position in numpy.argwhere(~numpy.isin(names, tuple(AIR_NAMES)))
    }
    solid_types = {position: str(names[position]) for position in solid}
    return size, solid, solid_types


def is_air(solid, position):
    return position not in solid


def foot_nodes(solid, size):
    sx, sy, sz = size
    nodes = set()
    for x in range(sx):
        for y in range(1, sy + 1):
            for z in range(sz):
                if (x, y - 1, z) not in solid:
                    continue
                if all(is_air(solid, (x, y + height, z)) for height in range(PLAYER_CLEARANCE)):
                    nodes.add((x, y, z))
    return nodes


def node_neighbors(node, nodes):
    x, y, z = node
    for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        for dy in (0, 1, -1):
            other = (x + dx, y + dy, z + dz)
            if other in nodes:
                yield other
                break


def connected_components(nodes):
    unseen = set(nodes)
    result = []
    while unseen:
        start = unseen.pop()
        unseen_stack = [start]
        component = {start}
        while unseen_stack:
            node = unseen_stack.pop()
            for other in node_neighbors(node, nodes):
                if other not in unseen:
                    continue
                unseen.remove(other)
                component.add(other)
                unseen_stack.append(other)
        result.append(component)
    return sorted(result, key=len, reverse=True)


def oak_nodes(component, solid_types):
    return {
        node for node in component
        if solid_types.get((node[0], node[1] - 1, node[2])) in OAK_ROUTE_SUPPORTS
    }


def contiguous_runs(values):
    values = sorted(set(values))
    if not values:
        return []
    result = []
    start = previous = values[0]
    for value in values[1:]:
        if value == previous + 1:
            previous = value
            continue
        result.append((start, previous))
        start = previous = value
    result.append((start, previous))
    return result


def best_level_run(points, lateral_axis):
    by_y = defaultdict(list)
    for point in points:
        by_y[point[1]].append(point[lateral_axis])
    choices = []
    for y, values in by_y.items():
        for start, end in contiguous_runs(values):
            choices.append((end - start + 1, y, start, end))
    return max(choices, default=None)


def centered_lanes(axis, fixed, lateral_axis, run, width=ROUTE_WIDTH):
    run_width, y, start, end = run
    if run_width < width:
        return []
    lane_start = start + (run_width - width) // 2
    result = []
    for lateral in range(lane_start, lane_start + width):
        point = [0, y, 0]
        point[axis] = fixed
        point[lateral_axis] = lateral
        result.append(tuple(point))
    return result


def best_component_by_oak(components, solid_types):
    choices = [
        (len(oak_nodes(component, solid_types)), len(component), component)
        for component in components
    ]
    return max(choices, default=(0, 0, set()))[2]


def face_lanes(oak, size, direction):
    axis, maximum_side, lateral_axis = FACE_DATA[direction]
    fixed = size[axis] - 1 if maximum_side else 0
    face = [point for point in oak if point[axis] == fixed]
    run = best_level_run(face, lateral_axis)
    return centered_lanes(axis, fixed, lateral_axis, run) if run else []


def object_position(position):
    return {"x": position[0], "y": position[1], "z": position[2]}


def point_key(position):
    return f"{position[0]},{position[1]},{position[2]}"


def compress_x_runs(points):
    rows = defaultdict(list)
    for x, y, z in points:
        rows[(y, z)].append(x)
    runs = []
    for (y, z), values in sorted(rows.items()):
        values.sort()
        start = previous = values[0]
        for value in values[1:]:
            if value == previous + 1:
                previous = value
                continue
            runs.append([y, z, start, previous])
            start = previous = value
        runs.append([y, z, start, previous])
    return runs


def socket_record(direction, lanes, carve_by_lane=None):
    carve_by_lane = carve_by_lane or [[] for _ in lanes]
    carve = sorted({point for lane in carve_by_lane for point in lane})
    center = lanes[len(lanes) // 2]
    return {
        "direction": direction,
        "localPosition": object_position(center),
        "floorNormal": "up",
        "opening": {"width": len(lanes), "height": 4},
        "confidence": 1,
        "walkPosition": object_position(center),
        "walkLanes": [object_position(point) for point in lanes],
        "carveMask": [object_position(point) for point in carve],
        "carveByLane": [
            [object_position(point) for point in sorted(points)] for points in carve_by_lane
        ],
        "protectedObstructions": [],
        "protectedByLane": [[] for _ in lanes],
        "structuralObstructions": [],
        "structuralByLane": [[] for _ in lanes],
    }


def clearance_points(route):
    return {
        (x, y + height, z)
        for x, y, z in route
        for height in range(PLAYER_CLEARANCE)
    }


def flat_route(variant, size, components, solid_types, required_faces):
    if variant["floor_normal"] != "up":
        return None, "authored floor is not upright"
    component = best_component_by_oak(components, solid_types)
    oak = oak_nodes(component, solid_types)
    sockets = []
    for direction in required_faces:
        lanes = face_lanes(oak, size, direction)
        if len(lanes) < ROUTE_WIDTH:
            return None, f"oak route does not reach {direction} at width {ROUTE_WIDTH}"
        sockets.append(socket_record(direction, lanes))
    return {
        "sockets": sockets,
        "route": component,
        "routeWidth": ROUTE_WIDTH,
        "verticalSpan": max(point[1] for point in component) - min(point[1] for point in component),
        "navigationKind": "oak_cross" if len(required_faces) == 4 else "oak_bridge",
    }, None


def room_route(variant, size, solid, solid_types):
    if variant["floor_normal"] != "up":
        return None, "room oak floors are vertical in this orientation"
    nodes = foot_nodes(solid, size)
    components = connected_components(nodes)
    candidates = []
    for component in components:
        oak = oak_nodes(component, solid_types)
        if len(oak) < 100:
            continue
        levels = {point[1] for point in oak}
        if len(levels) == 1:
            candidates.append((min(levels), -len(oak), component, oak))
    if not candidates:
        return None, "no broad horizontal oak room floor"
    foot_y, _, component, oak = min(candidates, key=lambda item: (item[0], item[1]))
    support_y = foot_y - 1
    oak_support = [
        point for point, name in solid_types.items()
        if name == "oak_planks" and point[1] == support_y
    ]
    min_x = min(point[0] for point in oak_support)
    max_x = max(point[0] for point in oak_support)
    min_z = min(point[2] for point in oak_support)
    max_z = max(point[2] for point in oak_support)
    center_x = (min_x + max_x) // 2
    center_z = (min_z + max_z) // 2
    specs = [
        ("north", 2, min_z - 1, 0, center_x, 1),
        ("south", 2, max_z + 1, 0, center_x, -1),
        ("west", 0, min_x - 1, 2, center_z, 1),
        ("east", 0, max_x + 1, 2, center_z, -1),
    ]
    sockets = []
    all_carve = set()
    potential_route = set(component)
    for direction, axis, sill, lateral_axis, center, inward_sign in specs:
        lane_start = center - ROUTE_WIDTH // 2
        lanes = []
        carve_by_lane = []
        for lane_index, lateral in enumerate(range(lane_start, lane_start + ROUTE_WIDTH)):
            point = [0, foot_y, 0]
            point[axis] = sill
            point[lateral_axis] = lateral
            lane = tuple(point)
            if (lane[0], foot_y - 1, lane[2]) not in solid:
                return None, f"room {direction} sill has no support at {lane}"
            lanes.append(lane)
            lane_carve = set()
            for depth in (0, 1):
                base = list(lane)
                base[axis] += inward_sign * depth
                for height in range(3):
                    candidate = (base[0], foot_y + height, base[2])
                    if candidate in solid:
                        lane_carve.add(candidate)
                if 0 < lane_index < ROUTE_WIDTH - 1:
                    candidate = (base[0], foot_y + 3, base[2])
                    if candidate in solid:
                        lane_carve.add(candidate)
            carve_by_lane.append(sorted(lane_carve))
            all_carve.update(lane_carve)
            potential_route.add(lane)
            inward = list(lane)
            inward[axis] += inward_sign
            potential_route.add(tuple(inward))
        sockets.append(socket_record(direction, lanes, carve_by_lane))

    opened_solid = solid - all_carve
    opened_nodes = foot_nodes(opened_solid, size)
    opened_components = connected_components(opened_nodes)
    socket_centers = {
        tuple(socket["walkPosition"][axis] for axis in ("x", "y", "z"))
        for socket in sockets
    }
    connected = next(
        (candidate for candidate in opened_components if socket_centers <= candidate), None
    )
    if connected is None:
        return None, "arched room sockets do not share one traversable component"
    return {
        "sockets": sockets,
        "route": connected | potential_route,
        "routeWidth": ROUTE_WIDTH,
        "verticalSpan": 0,
        "navigationKind": "oak_room_lower_floor",
    }, None


def axis_endpoint(oak, axis, lateral_axis, maximum):
    fixed = (max if maximum else min)(point[axis] for point in oak)
    points = [point for point in oak if point[axis] == fixed]
    run = best_level_run(points, lateral_axis)
    lanes = centered_lanes(axis, fixed, lateral_axis, run) if run else []
    return fixed, run, lanes


def ascending_route(variant, components, solid_types):
    choices = []
    for component in components:
        oak = oak_nodes(component, solid_types)
        if len(oak) < ROUTE_WIDTH:
            continue
        for axis, lateral_axis, low_direction, high_direction in (
            (0, 2, "west", "east"),
            (2, 0, "north", "south"),
        ):
            minimum, min_run, min_lanes = axis_endpoint(oak, axis, lateral_axis, False)
            maximum, max_run, max_lanes = axis_endpoint(oak, axis, lateral_axis, True)
            if len(min_lanes) < ROUTE_WIDTH or len(max_lanes) < ROUTE_WIDTH:
                continue
            widths = []
            complete = True
            for coordinate in range(minimum, maximum + 1):
                cross_section = [point for point in oak if point[axis] == coordinate]
                run = best_level_run(cross_section, lateral_axis)
                if not run:
                    complete = False
                    break
                widths.append(run[0])
            if not complete or min(widths) < ROUTE_WIDTH:
                continue
            vertical_span = abs(min_lanes[0][1] - max_lanes[0][1])
            if vertical_span < 2:
                continue
            choices.append((
                min(widths), maximum - minimum, vertical_span, len(oak),
                component, low_direction, high_direction, min_lanes, max_lanes,
            ))
    if not choices:
        return None, "no continuous width-5 oak route under normal gravity"
    (
        minimum_width, _, vertical_span, _, component,
        low_direction, high_direction, min_lanes, max_lanes,
    ) = max(choices, key=lambda item: item[:4])
    return {
        "sockets": [
            socket_record(low_direction, min_lanes),
            socket_record(high_direction, max_lanes),
        ],
        "route": component,
        "routeWidth": minimum_width,
        "verticalSpan": vertical_span,
        "navigationKind": "oak_ascending_route",
    }, None


def build_variant(variant, path):
    size, solid, solid_types = load_structure(path)
    components = connected_components(foot_nodes(solid, size))
    category = variant.get("category", CATEGORY_BY_SOURCE[variant["source"]])
    if category == "crossroads":
        navigation, reason = flat_route(
            variant, size, components, solid_types,
            ["north", "south", "west", "east"],
        )
    elif category == "bridge":
        candidates = []
        for faces in (["west", "east"], ["north", "south"]):
            candidate, candidate_reason = flat_route(
                variant, size, components, solid_types, faces
            )
            if candidate:
                candidates.append(candidate)
            reason = candidate_reason
        navigation = max(candidates, key=lambda item: len(item["route"]), default=None)
        if navigation is None:
            reason = reason or "oak bridge has no opposite boundary pair"
    elif category == "room":
        navigation, reason = room_route(variant, size, solid, solid_types)
    else:
        navigation, reason = ascending_route(variant, components, solid_types)
    if navigation is None:
        return None, reason

    route_clearance = clearance_points(navigation["route"])
    record = {
        "id": variant["id"],
        "structureId": f"infinite_castle:generated_variants/{variant['id']}",
        "source": variant["source"],
        "displayName": variant.get("display_name", variant["source"]),
        "category": category,
        "floorNormal": "up",
        "authoredFloorNormal": variant["floor_normal"],
        "navigationValidated": True,
        "navigationKind": navigation["navigationKind"],
        "routeWidth": navigation["routeWidth"],
        "verticalSpan": navigation["verticalSpan"],
        "size": {"x": size[0], "y": size[1], "z": size[2]},
        "sockets": navigation["sockets"],
        "solidRuns": compress_x_runs(solid),
        "walkRuns": compress_x_runs(route_clearance),
    }
    return record, None


def main():
    parser = argparse.ArgumentParser(
        description="Build a material-aware, normal-gravity navigation catalog."
    )
    parser.add_argument("variant_dir", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    metadata = json.loads((args.variant_dir / "variants.json").read_text(encoding="utf-8"))

    accepted = []
    rejected = []
    for variant in metadata["variants"]:
        record, reason = build_variant(
            variant, args.variant_dir / f"{variant['id']}.mcstructure"
        )
        if record:
            accepted.append(record)
            print(
                f"ACCEPT {record['id']} sockets={len(record['sockets'])} "
                f"width={record['routeWidth']} dy={record['verticalSpan']} "
                f"authoredFloor={record['authoredFloorNormal']}"
            )
        else:
            rejected.append({"id": variant["id"], "reason": reason})
            print(f"REJECT {variant['id']}: {reason}")

    source = "// Generated by tools/build_castle_navigation_catalog.py. Do not edit manually.\n"
    source += (
        "export const GENERATED_SOURCE_VARIANTS = Object.freeze("
        + json.dumps(accepted, ensure_ascii=True, separators=(",", ":"))
        + ");\n"
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(source, encoding="utf-8")
    json_output = args.output.with_suffix(".json")
    json_output.write_text(
        json.dumps(
            {"schema_version": 3, "variants": accepted, "rejected": rejected},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        f"accepted={len(accepted)} rejected={len(rejected)} "
        f"output={args.output} json={json_output}"
    )


if __name__ == "__main__":
    main()
