import html
import math


def render(data, language):
    say = lambda zh, en: zh if language == "zh" else en
    text = lambda value: html.escape(value[language])
    nodes = data["nodes"]
    scenes, branches, labels = [], [], []
    positions = [(180, 540), (180, 380), (250, 225), (410, 85), (490, 365), (640, 200),
                 (850, 80), (1120, 175), (925, 340), (1210, 390), (1130, 555)]
    width, height = 1400, 760
    stars = ''.join(f'<circle cx="{(index * 193 + 59) % width}" cy="{(index * 127 + 23) % height}" r="{.6 + index % 3 * .35}"/>' for index in range(85))
    for index, topic in enumerate(data["topics"]):
        name = topic["id"]
        layer = topic["layer"]
        works = sorted((node for node in nodes if node["topic"] == name), key=lambda node: node["year"])
        horizontal, vertical = positions[index]
        side = -1 if horizontal < 700 else 1
        control_x = 700 + (horizontal - 700) * .16
        path = f'M700 695C{control_x} 525 {horizontal - side * 85} {vertical + 100} {horizontal} {vertical}'
        twigs = []
        for twig in range(6):
            fraction = .3 + twig * .1
            remaining = 1 - fraction
            start_x = remaining ** 3 * 700 + 3 * remaining ** 2 * fraction * control_x + 3 * remaining * fraction ** 2 * (horizontal - side * 85) + fraction ** 3 * horizontal
            start_y = remaining ** 3 * 695 + 3 * remaining ** 2 * fraction * 525 + 3 * remaining * fraction ** 2 * (vertical + 100) + fraction ** 3 * vertical
            end_x = start_x + side * (32 + twig * 6)
            end_y = start_y - 25 - twig * 4
            twigs.append(f'<path class="grove-twig" d="M{start_x:.1f} {start_y:.1f}Q{start_x + side * 16:.1f} {end_y + 10:.1f} {end_x:.1f} {end_y:.1f}"/>')
        branches.append(f'<g data-limb="{name}" data-world-layer="{layer}"><path class="grove-stem" d="{path}"/>'
                        f'<path class="grove-flow" pathLength="100" style="--flow-delay:-{index * 1.3}s" d="{path}"/>{"".join(twigs)}</g>')
        count = say(f'{len(works)} 个节点', f'{len(works)} milestones')
        labels.append(f'<a class="grove-field" href="#field-{name}" data-grove-field="{name}" data-world-layer="{layer}" data-grove-x="{horizontal}" data-grove-y="{vertical}" '
                      f'style="left:{horizontal}px;top:{vertical}px" aria-label="{text(topic["title"])} · {count}">'
                      f'<span class="grove-field-dot" aria-hidden="true"></span><strong>{text(topic["title"])}</strong>'
                      f'<small>{works[0]["year"]}–{works[-1]["year"]} · {count} <span aria-hidden="true">↗</span></small></a>')
        tree_height = max(850, 250 + math.ceil(len(works) / 2) * 220)
        limbs, leaves = [], []
        for position, node in enumerate(works):
            direction = -1 if position % 2 == 0 else 1
            leaf_x = 700 + direction * (325 + (position % 3) * 25)
            leaf_y = tree_height - 185 - (position // 2) * 220 - (position % 2) * 46
            stem = f'M700 {leaf_y + 120}C{700 + direction * 75} {leaf_y + 60} {leaf_x - direction * 100} {leaf_y + 60} {leaf_x} {leaf_y}'
            state = ' grove-leaf--open' if node["status"] == "evolving" else ''
            limbs.append(f'<path class="grove-stem{state}" d="{stem}"/>')
            title = node["title"][language].split(' · ')[0].split('：')[0].split(': ')[0]
            subtitle = node["title"][language][len(title):].lstrip(' ·：:')
            caption = say("仍在探索", "Still evolving") if node["status"] == "evolving" else subtitle
            leaves.append(f'<a class="grove-leaf{state}" href="#event-{node["id"]}" data-world-peek data-grove-year="{node["year"]}" '
                          f'data-grove-x="{leaf_x}" data-grove-y="{leaf_y}" style="left:{leaf_x}px;top:{leaf_y}px" '
                          f'aria-label="{node["year"]} · {text(node["title"])}">'
                          f'<time>{node["year"]}</time><strong>{html.escape(title)}</strong>'
                          f'<span>{html.escape(caption)}</span></a>')
        scenes.append(f'<div class="grove-scene" data-grove-scene="{name}" data-world-layer="{layer}" data-grove-width="1400" '
                      f'data-grove-height="{tree_height}" data-grove-title="{text(topic["title"])}" hidden>'
                      f'<svg viewBox="0 0 1400 {tree_height}" aria-hidden="true"><path class="grove-trunk" d="M700 {tree_height - 30}Q665 {tree_height / 2} 700 30"/>{"".join(limbs)}</svg>'
                      f'{"".join(leaves)}<span class="grove-root-label" style="left:700px;top:{tree_height - 60}px">{text(topic["title"])}</span></div>')
    roots = ''.join(f'<path d="M700 695Q{620 + index * 20} 717 {460 + index * 60} 745"/>' for index in range(9))
    overview = (f'<div class="grove-scene" data-grove-scene="all" data-grove-width="{width}" data-grove-height="{height}" '
                f'data-grove-title="{say("技术世界树", "Technology world tree")}"><svg viewBox="0 0 {width} {height}" aria-hidden="true">'
                f'<g class="grove-stars">{stars}</g><g class="grove-branches">{"".join(branches)}</g>'
                f'<g class="grove-roots">{roots}</g></svg>{"".join(labels)}'
                f'<span class="grove-root-label" style="left:700px;top:675px">{say("许多条路，在这里交汇", "Many histories, meeting here")}</span></div>')
    options = ''.join(f'<option value="{topic["id"]}">{text(topic["title"])}</option>' for topic in data["topics"])
    mobile_fields = ''.join(f'<a href="#field-{topic["id"]}" data-grove-field="{topic["id"]}" data-world-layer="{topic["layer"]}"><strong>{text(topic["title"])}</strong><small>{text(topic["subtitle"])}</small></a>' for topic in data["topics"])
    return (f'<section class="world-grove" data-world-grove aria-label="{say("可探索的世界树", "Explore the world tree")}">'
            f'<div class="grove-toolbar"><div class="grove-breadcrumb"><button type="button" data-grove-home disabled>{say("世界树", "World tree")}</button>'
            f'<span aria-hidden="true">/</span><strong data-grove-current>{say("全景", "Overview")}</strong></div>'
            f'<label class="grove-jump"><span>{say("进入领域", "Explore a field")}</span><select data-grove-select disabled>'
            f'<option value="all">{say("全部领域", "All fields")}</option>{options}</select></label>'
            f'<button type="button" class="grove-expand" data-grove-expand aria-expanded="false" disabled>{say("扩大画布", "Larger canvas")}</button></div>'
            f'<div class="grove-tools" role="group" aria-label="{say("地图操作", "Map controls")}">'
            f'<button type="button" data-grove-back disabled>{say("← 全部领域", "← All fields")}</button>'
            f'<button type="button" data-grove-zoom="-1" aria-label="{say("缩小世界树", "Zoom out tree")}" disabled>−</button>'
            f'<output data-grove-zoom-label>100%</output><button type="button" data-grove-zoom="1" aria-label="{say("放大世界树", "Zoom in tree")}" disabled>+</button>'
            f'<button type="button" data-grove-fit disabled>{say("看全图", "Fit tree")}</button>'
            f'<div class="grove-node-nav" data-grove-node-nav hidden><button type="button" data-grove-step="-1" aria-label="{say("前一个节点", "Previous milestone")}">←</button>'
            f'<output data-grove-position></output><button type="button" data-grove-step="1" aria-label="{say("后一个节点", "Next milestone")}">→</button></div>'
            f'<button type="button" data-grove-latest hidden>{say("最近的节点 ↑", "Latest milestones ↑")}</button>'
            f'<button type="button" data-grove-earliest hidden>{say("最早的节点 ↓", "Earliest milestones ↓")}</button>'
            f'<button type="button" data-grove-touch aria-pressed="false" disabled>{say("触屏拖动", "Touch pan")}</button></div>'
            f'<div class="grove-mobile-fields">{mobile_fields}</div>'
            f'<div class="grove-viewport" data-grove-viewport tabindex="0" role="region" aria-label="{say("世界树画布：方向键平移，加减号缩放，0 回到全图", "Tree canvas: arrow keys to pan, plus or minus to zoom, 0 to fit")}" aria-describedby="grove-help">'
            f'<div class="grove-camera" data-grove-camera>{overview}{"".join(scenes)}</div></div>'
            f'<p class="grove-help" id="grove-help">{say("点年份节点看内容，也可以用 ← → 逐个浏览。拖动平移，Alt + 滚轮缩放；普通滚动仍然翻页。", "Open a dated milestone, or use ← → to visit them in order. Drag to pan; Alt + wheel to zoom. Normal scrolling still moves the page.")}</p>'
            f'<p class="grove-caption">{say("枝干按领域分类，不表示继承关系。小树中的节点从下到上按年份排列，间距不代表实际时长。", "Branches organize fields, not ancestry. Within each field, milestones grow upward in date order; spacing is not a time scale.")}</p>'
            f'<p class="world-announcement" role="status" data-grove-status></p></section>')
