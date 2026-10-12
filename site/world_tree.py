"""The world tree, drawn from the data.

A tree grows outward: old wood near the root, new growth at the tips, so the
distance from the root along the wood stands for time. The trunk is the first
period, made of the four groups of fields twisted together. It opens into four
limbs; a field either continues its group's limb (the field with the most
milestones) or leaves it at its first milestone, and in the same way each
direction within a field (`track`) continues the field or leaves it as a twig.
Milestones hang on short stems; thickness follows how many milestones lie beyond
a point. Vines come only from recorded connections; a field may drop an aerial
root back to the ground (`root` in the data).

Period lengths along the wood follow how many milestones a period holds, not
elapsed years. Geometry and foliage are deterministic: the same data always
draws the same tree, and a new milestone needs no coordinates.
"""
import html
import math

WIDTH = 1200
TRUNK = 240
TINT = {"physical": "#6aa6f2", "software": "#f08a55", "knowledge": "#3cc795", "people": "#e8b33c"}
LIMBS = {  # heading at the fork and at the tip (degrees, 90 = up), sideways offset at the fork
    "physical": (160, 124, -14), "software": (124, 103, -5), "knowledge": (90, 90, 3), "people": (26, 66, 14),
}
FIELD_TURN, TRACK_TURN = (34, 22), (44, 30)


def _smooth(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def _path(points):
    """Smooth path through points (Catmull-Rom as cubic Béziers)."""
    parts = [f"M{points[0][0]:.1f},{points[0][1]:.1f}"]
    for index in range(len(points) - 1):
        p0 = points[index - 1] if index else points[index]
        p1, p2 = points[index], points[index + 1]
        p3 = points[index + 2] if index + 2 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        parts.append(f"C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}")
    return "".join(parts)


def _ribbon(points, widths):
    """A tapered shape around a centre line."""
    left, right = [], []
    for index, (x, y) in enumerate(points):
        a, b = points[max(0, index - 1)], points[min(len(points) - 1, index + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy) or 1
        nx, ny = -dy / length, dx / length
        half = widths[index] / 2
        left.append((x + nx * half, y + ny * half))
        right.append((x - nx * half, y - ny * half))
    return _path(left) + "L" + _path(list(reversed(right)))[1:] + "Z"


def _random(seed):
    state = seed
    while True:
        state = (state * 1103515245 + 12345) % 2147483648
        yield state / 2147483648


def _gauss(rng):
    u, v = max(1e-9, next(rng)), next(rng)
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)


def _walk(start, length, heading, wiggle, step=4.0):
    x, y = start
    points, headings = [(x, y)], [heading(0) + wiggle(0)]
    for index in range(1, max(1, int(length / step)) + 1):
        s = index * step
        h = heading(s) + wiggle(s)
        x, y = x + math.cos(math.radians(h)) * step, y - math.sin(math.radians(h)) * step
        points.append((x, y))
        headings.append(h)
    return points, headings


def layout(data):
    """Positions, routes and widths (pure; shared by render and tests)."""
    eras, topics = data["eras"], data["topics"]
    nodes = {node["id"]: node for node in data["nodes"]}
    canonical = [name for era in eras for branch in era["branches"] for name in branch["works"]]
    era_index = {name: index for index, era in enumerate(eras) for branch in era["branches"] for name in branch["works"]}
    layer_of = {topic["id"]: topic["layer"] for topic in topics}
    order = [topic["id"] for topic in topics]
    track_order = {topic["id"]: [track["id"] for track in topic.get("tracks", [])] for topic in topics}
    track_of = {name: nodes[name].get("track") or "_" for name in canonical}

    # Arc length from the root for every milestone.
    clusters = {}
    for name in canonical:
        key = ("trunk",) if era_index[name] == 0 else (nodes[name]["topic"], track_of[name], era_index[name])
        clusters.setdefault(key, []).append(name)
    busiest = {}
    for key, names in clusters.items():
        if key[0] != "trunk":
            busiest[key[2]] = max(busiest.get(key[2], 1), len(names))
    per_field = {}
    for name in canonical:
        if era_index[name]:
            key = (nodes[name]["topic"], era_index[name])
            per_field[key] = per_field.get(key, 0) + 1
    for (topic, index), count in per_field.items():
        busiest[index] = max(busiest.get(index, 1), math.ceil(count / 2))
    span = {index: 34 + 11 * busiest.get(index, 1) for index in range(1, len(eras))}
    start = {1: TRUNK}
    for index in range(2, len(eras)):
        start[index] = start[index - 1] + span[index - 1]
    arc = {}
    for key, names in clusters.items():
        for rank, name in enumerate(names):
            if key[0] == "trunk":
                arc[name] = TRUNK * (rank + 1) / (len(names) + 1)
            else:
                arc[name] = start[key[2]] + span[key[2]] * (rank + 1) / (len(names) + 1)

    canopy = [name for name in canonical if era_index[name] > 0]
    fields = {topic: [name for name in canopy if nodes[name]["topic"] == topic] for topic in order}
    tracks = {}
    for topic in order:
        seen = [track for track in track_order[topic] if any(track_of[name] == track for name in fields[topic])]
        seen += sorted({track_of[name] for name in fields[topic]} - set(seen))
        tracks[topic] = {track: [name for name in fields[topic] if track_of[name] == track] for track in seen}

    def busiest_of(groups):
        return max(groups, key=lambda key: (len(groups[key]), -list(groups).index(key))) if groups else None

    lead_field = {}
    for topic in order:
        if fields[topic] and (layer_of[topic] not in lead_field or len(fields[topic]) > len(fields[lead_field[layer_of[topic]]])):
            lead_field[layer_of[topic]] = topic
    lead_track = {topic: busiest_of(tracks[topic]) for topic in order}

    def first(names):
        return min(arc[name] for name in names)

    def last(names):
        return max(arc[name] for name in names)

    cx, ground = WIDTH / 2, 0.0
    fork_y = ground - TRUNK
    routes = {}

    def plan(key, carried, children, start_arc):
        need = [last(carried) + 24] if carried else [start_arc + 30]
        need += [depart + 10 for _, depart in children]
        return max(need) - start_arc

    def spawn(key, parent, depart_arc, turn, carried, children, phase):
        index = max(0, min(len(parent["points"]) - 1, int(round((depart_arc - parent["start"]) / 4))))
        base = parent["headings"][index]
        hb = max(18.0, min(162.0, base + turn))  # branches grow upward, never droop
        length = plan(key, carried, children, depart_arc)
        heading = lambda s, hb=hb, length=length: hb + (90 - hb) * .55 * _smooth(s / length)
        wiggle = lambda s, phase=phase: 2.4 * math.sin(s / 38 + phase)
        points, headings = _walk(parent["points"][index], length, heading, wiggle)
        routes[key] = {"points": points, "headings": headings, "start": depart_arc, "parent": parent["key"], "key": key,
                       "carried": carried, "children": children}
        return routes[key]

    for rank, (layer, (h0, h1, offset)) in enumerate(LIMBS.items()):
        if layer not in lead_field:
            continue
        lead = lead_field[layer]
        others = [topic for topic in order if layer_of[topic] == layer and topic != lead and fields[topic]]
        lead_tracks = [track for track in tracks[lead] if track != lead_track[lead]]
        carried = tracks[lead][lead_track[lead]]
        children = [(("field", topic), first(fields[topic]) - 22) for topic in others] + \
                   [(("track", lead, track), first(tracks[lead][track]) - 14) for track in lead_tracks]
        length = plan(("limb", layer), carried, children, TRUNK)
        heading = lambda s, h0=h0, h1=h1, length=length: h0 + (h1 - h0) * _smooth(s / length)
        wiggle = lambda s, phase=rank * 1.9: 3 * math.sin(s / 55 + phase)
        points, headings = _walk((cx + offset, fork_y), length, heading, wiggle)
        limb = {"points": points, "headings": headings, "start": TRUNK, "parent": None, "key": ("limb", layer),
                "carried": carried, "children": children}
        routes[("limb", layer)] = limb
        lean = 1 if h0 > 92 else (-1 if h0 < 88 else 0)
        # Fields leave the limb, alternating sides, bigger turn away from the centre.
        field_children = sorted([child for child in children if child[0][0] == "field"], key=lambda child: child[1])
        for order_index, (key, depart) in enumerate(field_children):
            topic = key[1]
            side = (lean or 1) * (1 if order_index % 2 == 0 else -1)
            turn = side * (FIELD_TURN[0] if order_index % 2 == 0 else FIELD_TURN[1])
            sub = [track for track in tracks[topic] if track != lead_track[topic]]
            branch = spawn(key, limb, depart, turn, tracks[topic][lead_track[topic]],
                           [(("track", topic, track), first(tracks[topic][track]) - 14) for track in sub], rank + order_index * 1.3)
            for sub_index, (track_key, track_depart) in enumerate(sorted(branch["children"], key=lambda child: child[1])):
                tside = (1 if branch["headings"][0] > 90 else -1) * (1 if sub_index % 2 == 0 else -1)
                spawn(track_key, branch, track_depart, tside * (TRACK_TURN[0] if sub_index % 2 == 0 else TRACK_TURN[1]),
                      tracks[topic][track_key[2]], [], rank + sub_index * .9 + 2)
        for sub_index, (track_key, track_depart) in enumerate(sorted([child for child in children if child[0][0] == "track"], key=lambda child: child[1])):
            tside = (lean or 1) * (-1 if sub_index % 2 == 0 else 1)
            spawn(track_key, limb, track_depart, tside * (TRACK_TURN[0] if sub_index % 2 == 0 else TRACK_TURN[1]),
                  tracks[lead][track_key[2]], [], rank + sub_index * .7 + 4)

    def route_of(name):
        topic, track = nodes[name]["topic"], track_of[name]
        if ("track", topic, track) in routes:
            return routes[("track", topic, track)]
        if ("field", topic) in routes:
            return routes[("field", topic)]
        return routes[("limb", layer_of[topic])]

    def field_route(topic):
        return routes.get(("field", topic)) or routes[("limb", layer_of[topic])]

    # Braided trunk.
    trunk = {}
    for rank, layer in enumerate([layer for layer in LIMBS if ("limb", layer) in routes]):
        offset = LIMBS[layer][2]
        trunk[layer] = [(cx + offset * (i / 55) + 7 * math.sin(2 * math.pi * TRUNK * (i / 55) / 160 + rank * math.pi / 2) * (1 - .35 * i / 55),
                         ground - TRUNK * i / 55) for i in range(56)]

    positions, stems = {}, {}
    for name in canonical:
        if era_index[name] == 0:
            y = ground - arc[name]
            strand = trunk[layer_of[nodes[name]["topic"]]]
            bx = min(strand, key=lambda point: abs(point[1] - y))[0]
            side = 1 if canonical.index(name) % 2 == 0 else -1
            positions[name] = (bx + side * 32, y)
            stems[name] = ((bx, y), positions[name])
    for route in routes.values():
        carried = sorted(route["carried"], key=lambda name: arc[name])
        for rank, name in enumerate(carried):
            index = max(0, min(len(route["points"]) - 1, int(round((arc[name] - route["start"]) / 4))))
            (bx, by), heading = route["points"][index], route["headings"][index]
            side = 1 if rank % 2 == 0 else -1
            angle = math.radians(heading + side * 60)
            reach = 11 + 6 * ((rank // 2) % 3)
            positions[name] = (bx + math.cos(angle) * reach, by - math.sin(angle) * reach)
            stems[name] = ((bx, by), positions[name])

    widths = {}
    for key, route in routes.items():
        events = [(arc[name], 1) for name in route["carried"]]
        for child_key, depart in route["children"]:
            child = routes.get(child_key)
            if child:
                total = len(child["carried"]) + sum(len(routes[k]["carried"]) for k, _ in child["children"] if k in routes)
                events.append((depart, total))
        widths[key] = [1.0 + 2.5 * math.sqrt(sum(weight for at, weight in events if at >= route["start"] + 4 * i))
                       for i in range(len(route["points"]))]
    for layer in trunk:
        total = sum(1 for name in canopy if layer_of[nodes[name]["topic"]] == layer)
        widths[("trunk", layer)] = [1.2 + 2.5 * math.sqrt(total)] * 56

    return {"positions": positions, "stems": stems, "arc": arc, "routes": routes, "trunk": trunk, "widths": widths,
            "ground": ground, "cx": cx, "fork_y": fork_y, "route_of": route_of, "field_route": field_route,
            "lead_field": lead_field, "lead_track": lead_track, "tracks": tracks, "fields": fields,
            "canonical": canonical, "era_index": era_index, "layer_of": layer_of, "order": order, "track_of": track_of}


def render(data, language):
    escape = html.escape
    say = lambda zh, en: zh if language == "zh" else en
    tree = layout(data)
    eras, topics = data["eras"], data["topics"]
    nodes = {node["id"]: node for node in data["nodes"]}
    positions, stems, routes = tree["positions"], tree["stems"], tree["routes"]
    layer_of, order, canonical, era_index = tree["layer_of"], tree["order"], tree["canonical"], tree["era_index"]
    cx, ground = tree["cx"], tree["ground"]
    featured = {name for era in eras for name in era["featured"]}
    titles = {topic["id"]: topic["title"][language] for topic in topics}
    track_titles = {(topic["id"], track["id"]): track["title"][language] for topic in topics for track in topic.get("tracks", [])}
    linked = {}
    for connection in data.get("connections", []):
        linked.setdefault(connection["from"], []).append(connection["to"])
        linked.setdefault(connection["to"], []).append(connection["from"])
    rng = _random(20261012)

    xs = [x for route in routes.values() for x, _ in route["points"]]
    ys = [y for route in routes.values() for _, y in route["points"]]
    top, bottom = min(ys) - 70, ground + 150
    height = bottom - top

    defs = ('<defs><filter id="wt-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.4"/></filter>'
            f'<linearGradient id="wt-bark" gradientUnits="userSpaceOnUse" x1="0" y1="{ground + 30:.0f}" x2="0" y2="{top + 60:.0f}">'
            '<stop offset="0" stop-color="#f0cf98"/><stop offset=".3" stop-color="#f5e4c6"/><stop offset="1" stop-color="#e4eeff"/></linearGradient>'
            f'<linearGradient id="wt-rootfade" gradientUnits="userSpaceOnUse" x1="0" y1="{ground:.0f}" x2="0" y2="{ground + 125:.0f}">'
            '<stop offset="0" stop-color="#efcf9c" stop-opacity=".9"/><stop offset="1" stop-color="#efcf9c" stop-opacity="0"/></linearGradient>'
            '<radialGradient id="wt-crown" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff4df" stop-opacity=".2"/>'
            '<stop offset=".5" stop-color="#bcd6ff" stop-opacity=".07"/><stop offset="1" stop-color="#bcd6ff" stop-opacity="0"/></radialGradient>'
            '<radialGradient id="wt-earth" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#e9b873" stop-opacity=".2"/><stop offset="1" stop-color="#e9b873" stop-opacity="0"/></radialGradient>'
            + "".join(f'<radialGradient id="wt-halo-{layer}"><stop offset="0" stop-color="{tint}" stop-opacity=".9"/><stop offset=".4" stop-color="{tint}" stop-opacity=".3"/>'
                      f'<stop offset="1" stop-color="{tint}" stop-opacity="0"/></radialGradient>' for layer, tint in TINT.items())
            + '</defs>')

    paint = []
    crown_y = (min(ys) + tree["fork_y"]) / 2
    paint.append(f'<ellipse cx="{cx:.0f}" cy="{crown_y:.0f}" rx="{(max(xs) - min(xs)) * .6:.0f}" ry="{(tree["fork_y"] - min(ys)) * .75:.0f}" fill="url(#wt-crown)"/>')
    paint.append(f'<ellipse cx="{cx:.0f}" cy="{ground:.0f}" rx="430" ry="70" fill="url(#wt-earth)"/>')
    paint.append(f'<path class="wt-ground" d="M{cx - 480:.0f},{ground:.0f}Q{cx:.0f},{ground + 12:.0f} {cx + 480:.0f},{ground:.0f}"/>')
    dust = []
    for index in range(220):
        x, y = next(rng) * WIDTH, top + next(rng) * (ground - top)
        dust.append(f'<circle{" class=\"wt-twinkle\"" if index % 19 == 0 else ""} cx="{x:.1f}" cy="{y:.1f}" r="{.35 + next(rng) ** 3 * 1.2:.2f}" fill-opacity="{.1 + next(rng) ** 2 * .5:.2f}"/>')
    paint.append(f'<g class="wt-dust">{"".join(dust)}</g>')

    roots = []
    for index in range(9):
        spread = (index - 4) / 4
        depth = 72 + 46 * abs(math.sin(index * 2.3))
        end = (cx + spread * 240 + (next(rng) - .5) * 30, ground + depth)
        pts = [(cx + spread * 12, ground - 6), (cx + spread * 46, ground + depth * .3), (cx + spread * 130, ground + depth * .66), end]
        roots.append(f'<path d="{_ribbon(pts, [10 - abs(spread) * 3, 5.4, 2.6, .5])}"/>')
        mid = pts[2]
        roots.append(f'<path class="wt-rootlet" d="M{mid[0]:.1f},{mid[1]:.1f}q{spread * 18 + 4:.1f},12 {spread * 30 + 8:.1f},26"/>')
    paint.append(f'<g class="wt-roots">{"".join(roots)}</g>')

    for topic in topics:
        root = topic.get("root")
        if not root or root.get("from") not in positions or era_index[root["from"]] == 0:
            continue
        x, y = positions[root["from"]]
        side = 1 if x > cx else -1
        land = x + side * 16
        paint.append(f'<g class="wt-aerial" data-topic="{topic["id"]}"><title>{escape(root["label"][language])}</title>'
                     f'<path d="M{x:.1f},{y:.1f}C{x + side * 3:.1f},{(y + ground) / 2:.1f} {land - side * 4:.1f},{ground - 60:.1f} {land:.1f},{ground:.1f}'
                     f'M{land:.1f},{ground:.1f}q-6,10 -15,18M{land:.1f},{ground:.1f}q2,12 0,22M{land:.1f},{ground:.1f}q7,9 15,15"/></g>')

    wood = []
    for layer, pts in tree["trunk"].items():
        wood.append(f'<path class="wt-branch" data-layer="{layer}" d="{_ribbon(pts, [w * .9 for w in tree["widths"][("trunk", layer)]])}"/>')
    for key, route in routes.items():
        topic = (tree["lead_field"][key[1]] if key[0] == "limb" else key[1])
        track = tree["lead_track"][topic] if key[0] != "track" else key[2]
        wood.append(f'<path class="wt-branch" data-layer="{layer_of[topic]}" data-topic="{topic}" data-track="{track}" d="{_ribbon(route["points"], tree["widths"][key])}"/>')
    sprigs = []
    for route in routes.values():
        pts, heads = route["points"], route["headings"]
        for index in range(7, len(pts) - 2, 8):
            side = 1 if (index // 8) % 2 else -1
            angle = math.radians(heads[index] + side * (36 + 16 * next(rng)))
            reach = 6 + 9 * next(rng)
            x, y = pts[index]
            sprigs.append(f"M{x:.1f},{y:.1f}l{math.cos(angle) * reach:.1f},{-math.sin(angle) * reach:.1f}")
    stem_d = "".join(f"M{a[0]:.1f},{a[1]:.1f}L{b[0]:.1f},{b[1]:.1f}" for a, b in stems.values())
    paint.append(f'<g class="wt-glow" filter="url(#wt-glow)">{"".join(wood)}</g><g class="wt-wood">{"".join(wood)}</g>')
    paint.append(f'<path class="wt-sprigs" d="{"".join(sprigs)}"/><path class="wt-twigs" d="{stem_d}"/>')

    leaves = []
    for name in canonical:
        if era_index[name] == 0:
            continue
        x, y = positions[name]
        tint = TINT[layer_of[nodes[name]["topic"]]]
        for _ in range(18):
            color = tint if next(rng) < .45 else "#fff8ea"
            leaves.append(f'<circle cx="{x + _gauss(rng) * 14:.1f}" cy="{y + _gauss(rng) * 12:.1f}" r="{.5 + next(rng) * 1.3:.2f}" fill="{color}" fill-opacity="{.18 + next(rng) * .5:.2f}"/>')
    for route in routes.values():
        pts = route["points"]
        for index in range(int(len(pts) * .3), len(pts), 2):
            x, y = pts[index]
            reach = 10 + 16 * index / len(pts)
            for _ in range(2):
                leaves.append(f'<circle cx="{x + _gauss(rng) * reach:.1f}" cy="{y + _gauss(rng) * reach * .8:.1f}" r="{.4 + next(rng) * 1.1:.2f}" fill="#fff8ea" fill-opacity="{.08 + next(rng) * .34:.2f}"/>')
    paint.append(f'<g class="wt-leaves">{"".join(leaves)}</g>')

    for connection in data.get("connections", []):
        (x1, y1), (x2, y2) = positions[connection["from"]], positions[connection["to"]]
        mx, my = (x1 + x2) / 2, min(y1, y2) - 30 - abs(x1 - x2) * .1
        paint.append(f'<path class="wt-vine" data-from="{connection["from"]}" data-to="{connection["to"]}" d="M{x1:.1f},{y1:.1f}Q{mx:.1f},{my:.1f} {x2:.1f},{y2:.1f}"/>')

    taken = [(x - 5, y - 5, x + 5, y + 5) for x, y in positions.values()]

    def text_width(value, size):
        return sum(size * (1.0 if ord(char) > 0x2e80 else .56) for char in value)

    def free(box):
        return all(box[2] < o[0] or box[0] > o[2] or box[3] < o[1] or box[1] > o[3] for o in taken)

    def tip_label(route, label, size, extra=0):
        (tx, ty), heading = route["points"][-1], route["headings"][-1]
        width_px = text_width(label, size) + extra
        anchor = "middle" if 72 <= heading <= 108 else ("end" if heading > 108 else "start")
        for reach in (14, 28, 44):
            lx, ly = tx + math.cos(math.radians(heading)) * reach, ty - math.sin(math.radians(heading)) * reach
            for dy in (0, -14, 14, -28, 28):
                left = lx - width_px / 2 if anchor == "middle" else (lx - width_px if anchor == "end" else lx)
                box = (left - 3, ly + dy - size, left + width_px + 3, ly + dy + 4)
                if free(box):
                    taken.append(box)
                    return lx, ly + dy, anchor
        return None

    # Field names sit in two columns beside the crown, joined to their tips by fine leader lines.
    tips = {}
    for topic in order:
        if not any(nodes[name]["topic"] == topic for name in canonical):
            continue
        tips[topic] = tree["field_route"](topic)["points"][-1]
    leader_topic = max(tips, key=lambda topic: len(tree["fields"][topic]))  # the main leader gets its name on top
    sides = {"left": [], "right": []}
    for topic, (tx, ty) in tips.items():
        if topic != leader_topic:
            sides["left" if tx < cx else "right"].append(topic)
    outer_left = min(x for route in routes.values() for x, _ in route["points"])
    outer_right = max(x for route in routes.values() for x, _ in route["points"])
    columns = {"left": min([outer_left] + [tips[t][0] for t in sides["left"]]) - 34,
               "right": max([outer_right] + [tips[t][0] for t in sides["right"]]) + 34}
    columns["left"] = max(130.0, columns["left"])
    columns["right"] = min(WIDTH - 130.0, columns["right"])
    placed_y = {}
    for side, items in sides.items():
        items.sort(key=lambda topic: tips[topic][1])
        ys = [tips[topic][1] for topic in items]
        for i in range(1, len(ys)):
            ys[i] = max(ys[i], ys[i - 1] + 26)
        overflow = ys[-1] - (tree["fork_y"] - 10) if ys else 0
        if overflow > 0:
            ys = [y - overflow for y in ys]
            for i in range(len(ys) - 2, -1, -1):
                ys[i] = min(ys[i], ys[i + 1] - 26)
        placed_y.update(zip(items, ys))
    fields, leaders = [], []
    for topic, (tx, ty) in tips.items():
        members = [name for name in canonical if nodes[name]["topic"] == topic]
        count = len(members)
        size = 14
        width_px = text_width(titles[topic], size) + 24
        if topic == leader_topic:
            lx, ly, anchor = tx, ty - 22, "middle"
            taken.append((lx - width_px / 2 - 4, ly - size, lx + width_px / 2 + 4, ly + 5))
        else:
            side = "left" if tx < cx else "right"
            lx, ly = columns[side], placed_y[topic]
            anchor = "end" if side == "left" else "start"
            end_x = lx + 8 if side == "left" else lx - 8
            leaders.append(f'<path class="wt-leader" data-topic="{topic}" d="M{tx:.1f},{ty:.1f}L{end_x:.1f},{ly - 4:.1f}"/>'
                           f'<circle class="wt-leader-dot" data-topic="{topic}" cx="{tx:.1f}" cy="{ty:.1f}" r="1.8"/>')
            left_edge = lx - width_px if side == "left" else lx
            taken.append((left_edge - 4, ly - size, left_edge + width_px + 4, ly + 5))
        aria = escape(say(f"{titles[topic]}：{count} 个节点", f"{titles[topic]}: {count} milestone{'s' if count != 1 else ''}"), quote=True)
        fields.append(f'<a class="wt-field" id="field-{topic}" href="#event-{members[0]}" data-field-link="{topic}" data-layer="{layer_of[topic]}" aria-label="{aria}">'
                      f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}">{escape(titles[topic])}<tspan class="wt-count" dx="5">{count}</tspan></text></a>')
    marks = []
    for name in canonical:
        node = nodes[name]
        x, y = positions[name]
        topic = node["topic"]
        layer = layer_of[topic]
        big = name in featured
        classes = "wt-node" + (" is-featured" if big else "") + (" is-open" if node["status"] == "evolving" else "") + (" has-links" if name in linked else "")
        related = f' data-links="{" ".join(linked[name])}"' if name in linked else ""
        flare = f'<path class="wt-flare" d="M{x - 12:.1f},{y:.1f}H{x + 12:.1f}M{x:.1f},{y - 12:.1f}V{y + 12:.1f}"/>' if big else ""
        caption = ""
        if big:
            short = node["title"][language].split(" · ")[0].split("：")[0].split(": ")[0]
            size = 11.5
            width_px = text_width(f'{node["year"]} {short}', size)
            (bx, _), _ = stems[name]
            side = 1 if x >= bx else -1
            chosen = None
            for dy in (0, -13, 13, -26, 26):
                for direction in (side, -side):
                    left = x + 10 if direction > 0 else x - 10 - width_px
                    box = (left - 2, y + 4 + dy - size * .85, left + width_px + 2, y + 4 + dy + size * .3)
                    if free(box):
                        chosen = (direction, dy)
                        taken.append(box)
                        break
                if chosen:
                    break
            direction, dy = chosen or (side, 0)
            caption = (f'<text x="{x + direction * 10:.1f}" y="{y + 4 + dy:.1f}" text-anchor="{"start" if direction > 0 else "end"}">'
                       f'<tspan class="wt-year">{node["year"]}</tspan> {escape(short)}</text>')
        track = tree["track_of"][name]
        label = escape(f'{node["year"]} · {node["title"][language]}', quote=True)
        marks.append(f'<a class="{classes}" href="#event-{name}" data-node="{name}" data-topic="{topic}" data-track="{track}" data-layer="{layer}" '
                     f'data-era="{eras[era_index[name]]["id"]}"{related} aria-label="{label}">'
                     f'<circle class="wt-halo" cx="{x:.1f}" cy="{y:.1f}" r="{14 if big else 8.5}" fill="url(#wt-halo-{layer})"/>{flare}'
                     f'<circle class="wt-core" cx="{x:.1f}" cy="{y:.1f}" r="{2.8 if big else 1.8}"/>{caption}</a>')

    track_labels = []
    for key, route in routes.items():
        if key[0] != "track":
            continue
        label = track_titles.get((key[1], key[2]))
        if not label:
            continue
        placed = tip_label(route, label, 10.5)
        if placed:
            lx, ly, anchor = placed
            track_labels.append(f'<text class="wt-track" data-topic="{key[1]}" x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}">{escape(label)}</text>')

    title = say("技术世界树", "Technology world tree")
    return (f'<svg class="wt-svg" viewBox="0 {top:.0f} {WIDTH} {height:.0f}" role="group" aria-label="{title}">{defs}'
            f'<g aria-hidden="true">{"".join(paint)}{"".join(leaders)}{"".join(track_labels)}</g>{"".join(marks)}{"".join(fields)}</svg>')
