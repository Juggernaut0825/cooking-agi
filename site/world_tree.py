"""The world tree, drawn as light.

Every field is one luminous strand. All strands rise from the same root system,
braid together through the trunk, and leave it at the height of the field's
first milestone; the trunk therefore thins as fields branch off, and the
learning strand continues to the top. Milestones are stars on their strand.
Recorded connections are faint vines between stars; a field that later stood
on its own drops an aerial root back to the ground.

Height stands for time. The trunk is the first period; each later period is one
horizontal band, so stars from the same period sit at the same height. Band
heights follow how many milestones a band holds, not elapsed years. Geometry and
the background star dust are deterministic, so builds are reproducible and a new
milestone needs no coordinates.
"""
import html
import math

LEFT = ("energy", "chips", "memory", "networks", "software", "distributed")
CENTER = "models"
RIGHT = ("algorithms", "data", "applications", "ecosystem")
TINT = {"physical": "#5b9cf0", "software": "#f07a45", "knowledge": "#2fc08b", "people": "#e0a52a"}

LAYOUTS = {
    "wide": {"width": 1200, "gutter": 78, "top": 70, "trunk": 170, "below": 110, "left": (90, 520), "right": (730, 1105),
             "band": 50, "row": 24, "lane": 13, "braid": 9, "field_font": 14, "node_font": 11.5, "labels": True, "dust": 260},
    "narrow": {"width": 560, "gutter": 40, "top": 34, "trunk": 120, "below": 70, "left": (52, 240), "right": (322, 528),
               "band": 36, "row": 18, "lane": 9, "braid": 6, "field_font": 0, "node_font": 0, "labels": False, "dust": 120},
}


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


def _random(seed):
    state = seed
    while True:
        state = (state * 1103515245 + 12345) % 2147483648
        yield state / 2147483648


def render(data, language, layout="wide"):
    shape = LAYOUTS[layout]
    escape = html.escape
    say = lambda zh, en: zh if language == "zh" else en
    eras, topics = data["eras"], data["topics"]
    nodes = {node["id"]: node for node in data["nodes"]}
    canonical = [name for era in eras for branch in era["branches"] for name in branch["works"]]
    era_index = {name: index for index, era in enumerate(eras) for branch in era["branches"] for name in branch["works"]}
    featured = {name for era in eras for name in era["featured"]}
    layer_of = {topic["id"]: topic["layer"] for topic in topics}
    titles = {topic["id"]: topic["title"][language] for topic in topics}
    linked = {}
    for connection in data.get("connections", []):
        linked.setdefault(connection["from"], []).append(connection["to"])
        linked.setdefault(connection["to"], []).append(connection["from"])

    order = [topic["id"] for topic in topics]
    extra = [name for name in order if name not in LEFT + RIGHT + (CENTER,)]
    left_side = [name for name in LEFT if name in order] + [name for name in extra if layer_of[name] in ("physical", "software")]
    right_side = [name for name in RIGHT if name in order] + [name for name in extra if name not in left_side]
    width = shape["width"]
    cx = (shape["left"][1] + shape["right"][0]) / 2

    # Bands: one per period after the first, tall enough for its busiest field.
    clusters = {}
    for name in canonical:
        clusters.setdefault((nodes[name]["topic"], era_index[name]), []).append(name)
    rows = {}
    for (topic, index), names in clusters.items():
        rows[index] = max(rows.get(index, 1), math.ceil(len(names) / 2))
    heights = {index: shape["band"] + shape["row"] * rows.get(index, 1) for index in range(1, len(eras))}
    ground = shape["top"] + sum(heights.values()) + shape["trunk"]
    total = ground + shape["below"]
    fork = ground - shape["trunk"]
    band_bottom, cursor = {}, fork
    for index in range(1, len(eras)):
        band_bottom[index] = cursor
        cursor -= heights[index]

    heights_of, lanes = {}, {}
    for (topic, index), names in clusters.items():
        if index == 0:
            continue
        bottom, height = band_bottom[index], heights[index]
        count = math.ceil(len(names) / 2)
        for rank, name in enumerate(names):
            row, lane = divmod(rank, 2)
            heights_of[name] = bottom - height * (row + 1) / (count + 1) if len(names) > 1 else bottom - height * .5
            single = len(names) == 1 or (rank == len(names) - 1 and lane == 0)
            lanes[name] = 0 if single else (-1 if lane == 0 else 1) * shape["lane"]
    trunk_nodes = [name for name in canonical if era_index[name] == 0]
    for rank, name in enumerate(trunk_nodes):
        heights_of[name] = ground - shape["trunk"] * (rank + 1) / (len(trunk_nodes) + 1)
        lanes[name] = 0

    first_seen = {}
    for name in canonical:
        if era_index[name] > 0:
            first_seen.setdefault(nodes[name]["topic"], heights_of[name])
    # Earlier branches go farther out, so a late branch never sweeps across an early one.
    left_side.sort(key=lambda name: -first_seen.get(name, fork))
    right_side.sort(key=lambda name: first_seen.get(name, fork))
    column = {CENTER: cx}
    for side, (start, end) in ((left_side, shape["left"]), (right_side, shape["right"])):
        step = (end - start) / max(1, len(side) - 1)
        for index, name in enumerate(side):
            column[name] = start + index * step

    reach_of, spans = {}, {}
    for topic in order:
        ys = [heights_of[name] for name in canonical if nodes[name]["topic"] == topic and era_index[name] > 0]
        reach_of[topic] = 46 + .32 * abs(column[topic] - cx)
        depart = min(fork - 6, max(ys) + .55 * reach_of[topic]) if ys else fork - 6
        tip = min(ys) - 24 if ys else fork - 40
        spans[topic] = (depart, tip)
    phase = {name: 2 * math.pi * index / len(order) for index, name in enumerate(order)}

    def braid(topic, y):
        return shape["braid"] * math.sin((ground - y) / 38 + phase[topic])

    def x_at(topic, y):
        depart, tip = spans[topic]
        if topic == CENTER:
            fade = _smooth((fork - y) / 260)
            return cx + braid(topic, y) * (1 - .7 * fade)
        u = _smooth((depart - y) / reach_of[topic])
        sway = 5 * math.sin((depart - y) / 80 + phase[topic]) * u
        return cx + braid(topic, y) * (1 - u) + (column[topic] - cx) * u + sway

    positions = {name: (x_at(nodes[name]["topic"], heights_of[name]) + lanes[name], heights_of[name]) for name in canonical}

    defs = (f'<defs><filter id="wt-glow-{layout}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>'
            f'<filter id="wt-haze-{layout}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>'
            f'<radialGradient id="wt-nebula-{layout}" cx="50%" cy="38%" r="60%"><stop offset="0" stop-color="#2a3d6b" stop-opacity=".42"/>'
            f'<stop offset=".55" stop-color="#101a33" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="wt-ember-{layout}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e9b36a" stop-opacity=".28"/><stop offset="1" stop-color="#e9b36a" stop-opacity="0"/></radialGradient>'
            f'<linearGradient id="wt-horizon-{layout}" x1="0" x2="1"><stop offset="0" stop-color="#9fc4ff" stop-opacity="0"/><stop offset=".5" stop-color="#e8f1ff" stop-opacity=".75"/><stop offset="1" stop-color="#9fc4ff" stop-opacity="0"/></linearGradient>'
            f'<radialGradient id="wt-disk-{layout}" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#3a5a8c" stop-opacity=".34"/><stop offset=".7" stop-color="#14213b" stop-opacity=".22"/><stop offset="1" stop-color="#0a1020" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="wt-crown-{layout}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffffff" stop-opacity=".34"/><stop offset=".3" stop-color="#d9ecff" stop-opacity=".16"/>'
            f'<stop offset=".6" stop-color="#5fb7d8" stop-opacity=".08"/><stop offset="1" stop-color="#5fb7d8" stop-opacity="0"/></radialGradient>'
            f'<linearGradient id="wt-root-{layout}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0dcc0" stop-opacity=".75"/><stop offset="1" stop-color="#f0dcc0" stop-opacity="0"/></linearGradient>'
            + "".join(f'<radialGradient id="wt-halo-{layout}-{layer}"><stop offset="0" stop-color="{tint}" stop-opacity=".85"/><stop offset=".35" stop-color="{tint}" stop-opacity=".32"/>'
                      f'<stop offset="1" stop-color="{tint}" stop-opacity="0"/></radialGradient>' for layer, tint in TINT.items())
            + "</defs>")

    sky = [f'<rect class="wt-nebula" x="0" y="0" width="{width}" height="{total:.0f}" fill="url(#wt-nebula-{layout})"/>',
           f'<ellipse cx="{cx:.1f}" cy="{ground:.1f}" rx="{width * .32:.1f}" ry="{shape["below"] * .9:.1f}" fill="url(#wt-ember-{layout})"/>']
    rng = _random(20261012 + (7 if layout == "narrow" else 0))
    dust = []
    for index in range(shape["dust"]):
        x, y = next(rng) * width, next(rng) * (ground - 10)
        size = .35 + next(rng) ** 3 * 1.3
        alpha = .12 + next(rng) ** 2 * .55
        warm = next(rng)
        color = "#ffe6c4" if warm > .86 else ("#cfe0ff" if warm > .55 else "#ffffff")
        twinkle = ' class="wt-twinkle"' if index % 17 == 0 else ""
        dust.append(f'<circle{twinkle} cx="{x:.1f}" cy="{y:.1f}" r="{size:.2f}" fill="{color}" fill-opacity="{alpha:.2f}"/>')
    sky.append(f'<g class="wt-dust">{"".join(dust)}</g>')
    crown_y = shape["top"] - 6
    sky.append(f'<ellipse class="wt-crown" cx="{cx:.1f}" cy="{crown_y:.1f}" rx="{width * .3:.1f}" ry="{(fork - crown_y) * .34:.1f}" fill="url(#wt-crown-{layout})"/>')

    for index in range(1, len(eras)):
        y = band_bottom[index]
        sky.append(f'<line class="wt-band" data-era-band="{eras[index]["id"]}" x1="{shape["gutter"]}" y1="{y:.1f}" x2="{width - 16}" y2="{y:.1f}"/>')
        sky.append(f'<text class="wt-band-label" x="{shape["gutter"] - 12}" y="{y + 4:.1f}" text-anchor="end">{eras[index]["start"]}</text>')
    sky.append(f'<text class="wt-band-label" x="{shape["gutter"] - 12}" y="{ground + 4:.1f}" text-anchor="end">{eras[0]["start"]}</text>')
    disk_rx, disk_ry = width * .4, shape["below"] * .26
    sky.append(f'<ellipse class="wt-disk" cx="{cx:.1f}" cy="{ground:.1f}" rx="{disk_rx:.1f}" ry="{disk_ry:.1f}" fill="url(#wt-disk-{layout})"/>')
    sky.append(f'<path class="wt-rim" d="M{cx - disk_rx:.1f},{ground:.1f}A{disk_rx:.1f},{disk_ry:.1f} 0 0 0 {cx + disk_rx:.1f},{ground:.1f}" stroke="url(#wt-horizon-{layout})"/>')
    sky.append(f'<path class="wt-rim wt-rim--back" d="M{cx - disk_rx:.1f},{ground:.1f}A{disk_rx:.1f},{disk_ry:.1f} 0 0 1 {cx + disk_rx:.1f},{ground:.1f}" stroke="url(#wt-horizon-{layout})"/>')
    # Nine roots below the trunk (下有九枸).
    nine = []
    for index in range(9):
        spread = (index - 4) / 4
        depth = shape["below"] * (.62 + .3 * abs(math.sin(index * 2.1)))
        end_x = cx + spread * width * .15
        nine.append(f'M{cx + spread * shape["braid"] * 1.4:.1f},{ground - 1:.1f}C{cx + spread * shape["braid"] * 3:.1f},{ground + depth * .4:.1f} '
                    f'{end_x - spread * 26:.1f},{ground + depth * .7:.1f} {end_x:.1f},{ground + depth:.1f}')
    sky.append(f'<path class="wt-nine-roots" d="{"".join(nine)}" stroke="url(#wt-root-{layout})"/>')

    # Strands: one per field, from its root tendril through the braided trunk to its tip.
    strands, roots = [], []
    for index, topic in enumerate(order):
        depart, tip = spans[topic]
        ys = [ground - (ground - tip) * i / 90 for i in range(91)]
        points = [(x_at(topic, y), y) for y in ys]
        spread = (index - (len(order) - 1) / 2) / ((len(order) - 1) / 2)
        depth = shape["below"] * (.45 + .4 * abs(math.sin(index * 1.3)))
        tint = TINT[layer_of[topic]]
        d = _path(points)
        strands.append(f'<path class="wt-strand" data-topic="{topic}" data-layer="{layer_of[topic]}" style="--tint:{tint}" d="{d}"/>')
    glow = "".join(strand.replace('class="wt-strand"', 'class="wt-strand-glow"') for strand in strands)

    aerial = []
    landings = []
    for topic in topics:
        root = topic.get("root")
        if not root or root.get("from") not in positions or era_index[root["from"]] == 0:
            continue
        x, y = positions[root["from"]]
        side = 1 if x > cx else -1
        land = x + side * 26
        level = sum(1 for other in landings if abs(other - land) < 170)
        landings.append(land)
        tint = TINT[layer_of[topic["id"]]]
        mid = (y + ground) / 2
        aerial.append(f'<g class="wt-aerial" data-topic="{topic["id"]}" style="--tint:{tint}">'
                      f'<path d="M{x:.1f},{y:.1f}C{x + side * 4:.1f},{mid:.1f} {land - side * 6:.1f},{mid + 40:.1f} {land:.1f},{ground}'
                      f'M{land:.1f},{ground}q-5,14 -18,24M{land:.1f},{ground}q2,16 -1,30M{land:.1f},{ground}q7,12 18,20"/>'
                      + (f'<text x="{land:.1f}" y="{ground + 50 + 16 * level}" text-anchor="middle">{escape(root["label"][language])}</text>' if shape["labels"] else "")
                      + "</g>")

    vines = []
    for connection in data.get("connections", []):
        (x1, y1), (x2, y2) = positions[connection["from"]], positions[connection["to"]]
        lift = 34 + abs(x1 - x2) * .14
        vines.append(f'<path class="wt-vine" data-from="{connection["from"]}" data-to="{connection["to"]}" '
                     f'd="M{x1:.1f},{y1:.1f}C{x1:.1f},{y1 - lift:.1f} {x2:.1f},{y2 - lift:.1f} {x2:.1f},{y2:.1f}"/>')

    twigs = "".join(f'M{x - lanes[name]:.1f},{y + 3:.1f}L{x:.1f},{y:.1f}' for name, (x, y) in positions.items() if lanes[name])

    taken = []

    def text_width(value, size):
        return sum(size * (1.0 if ord(char) > 0x2e80 else .56) for char in value)

    def free(box):
        return all(box[2] < other[0] or box[0] > other[2] or box[3] < other[1] or box[1] > other[3] for other in taken)

    def place(x, y, side, value, size):
        width_px = text_width(value, size)
        for dy in (0, -14, 14, -28, 28, -42, 42):
            for direction in (side, -side):
                left_edge = x + direction * 14 if direction > 0 else x - 14 - width_px
                box = (left_edge - 2, y + dy - size * .8, left_edge + width_px + 2, y + dy + size * .35)
                if free(box):
                    taken.append(box)
                    return direction, dy
        return side, 0

    for name, (x, y) in positions.items():
        taken.append((x - 4, y - 4, x + 4, y + 4))

    fields, placed = [], []
    for topic in order:
        depart, tip = spans[topic]
        x, y = x_at(topic, tip), tip - 12
        members = [name for name in canonical if nodes[name]["topic"] == topic]
        if shape["labels"]:
            half = text_width(titles[topic], shape["field_font"]) / 2 + 14
            x = min(max(x, shape["gutter"] + half + 6), width - half - 6)
            for _ in range(8):
                if any(abs(px - x) < 112 and abs(py - y) < 19 for px, py in placed):
                    y -= 19
            placed.append((x, y))
            span = text_width(titles[topic], shape["field_font"]) / 2 + 18
            taken.append((x - span, y - shape["field_font"], x + span, y + 4))
        anchor_id = f' id="field-{topic}"' if layout == "wide" else ""
        label = escape(say(f"{titles[topic]}：{len(members)} 个节点", f"{titles[topic]}: {len(members)} milestone{'s' if len(members) != 1 else ''}"), quote=True)
        body = (f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" style="font-size:{shape["field_font"]}px">{escape(titles[topic])}'
                f'<tspan class="wt-count" dx="6">{len(members)}</tspan></text>') if shape["labels"] else f'<circle class="wt-tip" cx="{x:.1f}" cy="{tip:.1f}" r="3"/>'
        fields.append(f'<a class="wt-field"{anchor_id} href="#event-{members[0]}" data-field-link="{topic}" data-layer="{layer_of[topic]}" aria-label="{label}">{body}</a>')

    marks = []
    for name in canonical:
        node = nodes[name]
        x, y = positions[name]
        topic = node["topic"]
        layer = layer_of[topic]
        big = name in featured
        scale = 1 if layout == "wide" else .85
        classes = "wt-node" + (" is-featured" if big else "") + (" is-open" if node["status"] == "evolving" else "") + (" has-links" if name in linked else "")
        related = f' data-links="{" ".join(linked[name])}"' if name in linked else ""
        flare = (f'<path class="wt-flare" d="M{x - 13 * scale:.1f},{y:.1f}H{x + 13 * scale:.1f}M{x:.1f},{y - 13 * scale:.1f}V{y + 13 * scale:.1f}"/>' if big else "")
        caption = ""
        if shape["labels"] and big:
            short = node["title"][language].split(" · ")[0].split("：")[0].split(": ")[0]
            if era_index[name] == 0:
                side = 1 if trunk_nodes.index(name) % 2 == 0 else -1
            elif topic == CENTER:
                side = -1 if lanes[name] < 0 else 1
            else:
                side = 1 if column[topic] > cx else -1
            side, dy = place(x, y + 4, side, f'{node["year"]} {short}', shape["node_font"])
            caption = (f'<text x="{x + side * 14:.1f}" y="{y + 4 + dy:.1f}" text-anchor="{"start" if side > 0 else "end"}" style="font-size:{shape["node_font"]}px">'
                       f'<tspan class="wt-year">{node["year"]}</tspan> {escape(short)}</text>')
        label = escape(f'{node["year"]} · {node["title"][language]}', quote=True)
        marks.append(f'<a class="{classes}" href="#event-{name}" data-node="{name}" data-topic="{topic}" data-layer="{layer}" '
                     f'data-era="{eras[era_index[name]]["id"]}"{related} aria-label="{label}">'
                     f'<circle class="wt-halo" cx="{x:.1f}" cy="{y:.1f}" r="{(15 if big else 9) * scale:.1f}" fill="url(#wt-halo-{layout}-{layer})"/>{flare}'
                     f'<circle class="wt-core" cx="{x:.1f}" cy="{y:.1f}" r="{(2.9 if big else 1.9) * scale:.1f}"/>{caption}</a>')

    root_label = ""
    if shape["labels"]:
        root_label = (f'<text class="wt-root-label" x="{cx:.1f}" y="{ground + shape["below"] - 14}" text-anchor="middle">'
                      f'{escape(say(f"同一个根 · 电力、计算与晶体管 · {eras[0]["start"]}–{eras[0]["end"]}", f"One root · power, computation, the transistor · {eras[0]["start"]}–{eras[0]["end"]}"))}</text>')
    title = say("技术世界树", "Technology world tree")
    return (f'<svg class="wt-svg wt-svg--{layout}" viewBox="0 0 {width} {total:.0f}" role="group" aria-label="{title}">{defs}'
            f'<g aria-hidden="true">{"".join(sky)}<g class="wt-glow" filter="url(#wt-haze-{layout})">{glow}</g>'
            f'{"".join(strands)}{"".join(aerial)}<path class="wt-twigs" d="{twigs}"/>{"".join(vines)}{root_label}</g>'
            f'{"".join(marks)}{"".join(fields)}</svg>')
