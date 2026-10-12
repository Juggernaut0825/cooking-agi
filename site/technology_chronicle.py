import html
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
import world_tree


DATA = Path(__file__).parent / "static/technology-tree-data.json"
MARKER = '<div data-ai-chronicle></div>'


def validate(data):
    def require(condition, message):
        if not condition:
            raise ValueError(f"Technology chronicle: {message}")

    def identifier(value):
        return isinstance(value, str) and re.fullmatch(r"[a-z0-9-]+", value)

    def translated(value):
        return isinstance(value, dict) and set(value) == {"zh", "en"} and all(
            isinstance(text, str) and text.strip() for text in value.values())

    require(data.get("version") == 3, "unsupported data version")
    require(re.fullmatch(r"\d{4}-\d{2}-\d{2}", data.get("reviewed", "")), "missing review date")
    require(isinstance(data.get("nodes"), list) and data["nodes"], "missing works")
    require(isinstance(data.get("eras"), list) and data["eras"], "missing eras")
    require(isinstance(data.get("layers"), list) and data["layers"], "missing layers")
    require(isinstance(data.get("topics"), list) and data["topics"], "missing topics")
    layers, topics = set(), set()
    for layer in data["layers"]:
        require(identifier(layer.get("id")) and layer["id"] not in layers, "invalid layer")
        require(translated(layer.get("title")), "missing layer translation")
        layers.add(layer["id"])
    for topic in data["topics"]:
        require(identifier(topic.get("id")) and topic["id"] not in topics, "invalid topic")
        require(topic.get("layer") in layers, "unknown layer")
        require(all(translated(topic.get(field)) for field in ("title", "subtitle", "description", "next")), "missing topic translation")
        topics.add(topic["id"])
    nodes = {}
    for node in data["nodes"]:
        name = node.get("id")
        require(identifier(name) and name not in nodes, "duplicate or invalid work ID")
        require(isinstance(node.get("year"), int) and 1800 <= node["year"] <= int(data["reviewed"][:4]), f"invalid year: {name}")
        require(node.get("topic") in topics, f"unknown topic: {name}")
        require(node.get("kind") in {"research", "system", "product", "open"}, f"invalid kind: {name}")
        require(node.get("status") in {"historical", "adopted", "evolving"}, f"invalid status: {name}")
        require(all(translated(node.get(field)) for field in ("title", "body", "limit")), f"missing translation: {name}")
        require("detail" not in node or translated(node["detail"]), f"missing detail translation: {name}")
        require("detail" not in node or len(node["detail"]["zh"].split("\n\n")) == len(node["detail"]["en"].split("\n\n")),
                f"detail paragraphs differ between languages: {name}")
        require(isinstance(node.get("sources"), list) and node["sources"], f"missing sources: {name}")
        for source in node["sources"]:
            require(isinstance(source, list) and len(source) == 2 and all(isinstance(part, str) and part.strip() for part in source), f"invalid source: {name}")
            url = urlsplit(source[1])
            require(url.scheme == "https" and url.hostname and not url.username and not url.password, f"unsafe source: {name}")
        nodes[name] = node
    previous_end = 0
    era_ids, branch_ids, used = set(), set(), []
    for era in data["eras"]:
        name = era.get("id")
        require(identifier(name) and name not in era_ids, "duplicate or invalid era ID")
        era_ids.add(name)
        require(isinstance(era.get("start"), int) and isinstance(era.get("end"), int) and previous_end < era["start"] <= era["end"], f"overlapping or unordered era: {name}")
        previous_end = era["end"]
        require(all(translated(era.get(field)) for field in ("title", "summary")), f"missing era translation: {name}")
        require(isinstance(era.get("branches"), list) and era["branches"], f"missing branches: {name}")
        era_works = []
        for branch in era["branches"]:
            branch_id = f'{name}-{branch.get("id")}'
            require(identifier(branch.get("id")) and branch_id not in branch_ids, f"invalid branch: {name}")
            branch_ids.add(branch_id)
            require(all(translated(branch.get(field)) for field in ("title", "summary")), f"missing branch translation: {branch_id}")
            require(isinstance(branch.get("works"), list) and branch["works"], f"empty branch: {branch_id}")
            years = []
            for work in branch["works"]:
                require(work in nodes, f"unknown work: {work}")
                year = nodes[work]["year"]
                require(era["start"] <= year <= era["end"], f"work outside era: {work}")
                years.append(year)
            require(years == sorted(years), f"unordered branch: {branch_id}")
            era_works.extend(branch["works"])
        require(isinstance(era.get("featured"), list) and 1 <= len(era["featured"]) <= 3, f"use 1–3 featured works: {name}")
        require(len(set(era["featured"])) == len(era["featured"]) and set(era["featured"]).issubset(era_works), f"invalid featured works: {name}")
        used.extend(era_works)
    require(len(used) == len(set(used)) and set(used) == set(nodes), "each work needs one canonical branch")
    require(set(node["topic"] for node in nodes.values()) == topics, "each topic needs at least one work")
    for topic in data["topics"]:
        if "root" in topic:
            root = topic["root"]
            require(isinstance(root, dict) and nodes.get(root.get("from"), {}).get("topic") == topic["id"], f"aerial root must start on its own field: {topic['id']}")
            require(translated(root.get("label")) and translated(root.get("note")), f"missing aerial root translation: {topic['id']}")
    connections = set()
    for connection in data.get("connections", []):
        endpoints = (connection.get("from"), connection.get("to"))
        require(all(endpoint in nodes for endpoint in endpoints) and endpoints[0] != endpoints[1], "invalid connection endpoints")
        require(endpoints not in connections, "duplicate connection")
        require(connection.get("type") in {"uses", "adapts", "complements"}, "invalid connection type")
        require(translated(connection.get("description")), "missing connection translation")
        require(connection.get("source") in [source[1] for source in nodes[endpoints[0]]["sources"]], "connection needs evidence from its source work")
        connections.add(endpoints)
    return nodes


LEGACY_BRANCHES = {"transformer": "language", "alexnet": "vision", "qlearning": "rl", "sac": "robotics", "zero": "systems"}


def split_title(title):
    for separator in (" · ", "：", ": "):
        if separator in title:
            name, rest = title.split(separator, 1)
            return name, rest
    return title, ""


def render(data, language):
    nodes = validate(data)
    escape = html.escape
    chinese = language == "zh"
    say = lambda zh, en: zh if chinese else en
    text = lambda value: escape(value[language])
    topics = {topic["id"]: topic for topic in data["topics"]}
    kinds = {"research": say("研究", "Research"), "system": say("系统", "System"),
             "product": say("产品 / 发布", "Product / release"), "open": say("开放问题", "Open question")}
    outgoing_label = {"uses": say("用到", "Uses"), "adapts": say("借用了", "Adapts"), "complements": say("和它互补", "Complements")}
    incoming_label = {"uses": say("被用于", "Used by"), "adapts": say("被借用于", "Adapted by"), "complements": say("和它互补", "Complements")}
    connections = data.get("connections", [])
    canonical = [name for era in data["eras"] for branch in era["branches"] for name in branch["works"]]
    position = {name: index for index, name in enumerate(canonical)}
    era_of = {name: era["id"] for era in data["eras"] for branch in era["branches"] for name in branch["works"]}
    featured = {name for era in data["eras"] for name in era["featured"]}
    linked = {}
    for connection in connections:
        linked.setdefault(connection["from"], []).append(connection["to"])
        linked.setdefault(connection["to"], []).append(connection["from"])
    short = lambda node: escape(split_title(node["title"][language])[0])

    def chip(node):
        name = node["id"]
        classes = "ch-chip" + (" is-featured" if name in featured else "") + (" is-open" if node["status"] == "evolving" else "")
        related = ""
        if name in linked:
            classes += " has-links"
            related = f' data-links="{" ".join(linked[name])}"'
        label = escape(f'{node["year"]} · {node["title"][language]}', quote=True)
        return f'<a class="{classes}" href="#event-{name}" data-node="{name}"{related} aria-label="{label}">{short(node)}</a>'

    columns = ''.join(f'<th scope="col"><a href="#era-{era["id"]}" title="{escape(era["title"][language], quote=True)}">'
                      f'<span>{era["start"]}</span><small>–{era["end"]}</small></a></th>' for era in data["eras"])
    bodies, legend = [], []
    for layer in data["layers"]:
        legend.append(f'<li data-layer="{layer["id"]}">{text(layer["title"])}</li>')
        rows = [f'<tr class="ch-layer-name"><th scope="colgroup" colspan="{len(data["eras"]) + 1}">{text(layer["title"])}</th></tr>']
        for topic in (item for item in data["topics"] if item["layer"] == layer["id"]):
            members = sorted((node for node in data["nodes"] if node["topic"] == topic["id"]),
                             key=lambda node: (node["year"], position[node["id"]]))
            cells = ''.join(f'<td>{"".join(chip(node) for node in members if era_of[node["id"]] == era["id"])}</td>' for era in data["eras"])
            count = say(f"{len(members)} 个节点", f"{len(members)} milestone{'s' if len(members) != 1 else ''}")
            rows.append(f'<tr data-topic="{topic["id"]}"><th scope="row">'
                        f'<button type="button" class="ch-field" data-field="{topic["id"]}" aria-pressed="false" aria-controls="chronicle-content" disabled>'
                        f'<strong>{text(topic["title"])}</strong><small>{count}</small></button></th>{cells}</tr>')
        bodies.append(f'<tbody data-layer="{layer["id"]}">{"".join(rows)}</tbody>')
    period = f'{data["eras"][0]["start"]}–{data["eras"][-1]["end"]}'
    table = (f'<details class="ch-table-view"><summary>{say("用表格看：领域 × 年代", "Table view: field × period")}</summary>'
             f'<div class="ch-matrix" role="region" tabindex="0" aria-label="{say("领域 × 年代表格", "Field × period table")}">'
             f'<table><caption>{say("各领域在各年代收录的节点", "Milestones collected for each field and period")}</caption>'
             f'<colgroup><col class="ch-col-field">{"<col>" * len(data["eras"])}</colgroup>'
             f'<thead><tr><th scope="col" class="ch-corner">{say("领域 ／ 年代", "Field / period")}</th>{columns}</tr></thead>{"".join(bodies)}</table></div>'
             f'<p class="ch-table-note">{say("空着的格子只是这里还没收录，不代表那时没有进展。", "An empty cell means nothing is collected there yet, not that nothing happened.")}</p></details>')
    period = f'{data["eras"][0]["start"]}–{data["eras"][-1]["end"]}'
    overview = (f'<section class="ch-overview" aria-labelledby="ch-overview-title">'
                f'<header class="ch-overview-head"><p class="ch-kicker">{say("全景", "Overview")} · {period}</p>'
                f'<h2 id="ch-overview-title">{say("同一个根，长出许多枝", "One root, many branches")}</h2>'
                f'<blockquote class="ch-myth"><p>{say("「建木……百仞无枝，上有九欘，下有九枸。」", "“Jianmu … a hundred ren without a branch, nine bends above, nine tangled roots below.”")}</p>'
                f'<cite>{say("《山海经·海内经》", "Classic of Mountains and Seas")}</cite></blockquote>'
                f'<p>{say("古人想象天地中央有一棵通天的树，叫建木：主干高高的、不分枝，上面九道弯枝，下面九条盘根，《淮南子》说众帝就沿着它上下天地。这棵技术树借了它的样子：主干是电、计算和晶体管这些共同的起点，往上分出各个领域，往下扎进同一片地。", "Chinese myth imagined a tree at the centre of heaven and earth called Jianmu: a tall trunk without branches, nine bends above and nine roots below, the path by which, the Huainanzi says, the gods went up and down. This tree borrows its shape. The trunk holds the shared beginnings in power, computation, and the transistor; fields branch off above and root into the same ground below.")}</p>'
                f'<p>{say("越往上年代越晚，同一高度属于同一个年代。枝和枝之间的细藤是有记录的联系；从枝上垂回地面的气根，表示这条线后来自成一片，并不是为 AI 而存在。", "Higher means later, and stars at the same height share a period. Fine vines between branches are recorded connections; an aerial root dropping back to the ground marks a line that later stood on its own rather than existing for AI.")}</p></header>'
                f'<div class="wt-stage" data-world-tree>{world_tree.render(data, language, "wide")}{world_tree.render(data, language, "narrow")}</div>'
                f'<div class="ch-matrix-foot"><ul class="ch-legend">{"".join(legend)}</ul>'
                f'<p>{say("大点是该年代的代表作；点名字跳到正文，点枝头的领域名，下面的年表只留这一条线。", "Large points are each period’s featured works. Select a point to read it, or a field name at a branch tip to follow only that line below.")}</p></div>'
                f'{table}</section>')

    navigation = ''.join(f'<a href="#era-{era["id"]}" data-era-link="{era["id"]}" title="{escape(era["title"][language], quote=True)}">{era["start"]}</a>' for era in data["eras"])
    era_nav = (f'<nav class="ch-eras" aria-label="{say("按年代浏览", "Browse by period")}">'
               f'<a class="ch-eras-home" href="#tree-map">{say("↑ 全景", "↑ Overview")}</a>{navigation}</nav>')
    banner = (f'<div class="ch-filter" data-filter-banner hidden><p data-filter-label></p>'
              f'<button type="button" data-filter-reset>{say("显示全部领域", "Show every field")}</button></div>')

    def card(node):
        name = node["id"]
        topic = topics[node["topic"]]
        outgoing = [connection for connection in connections if connection["from"] == name]
        incoming = [connection for connection in connections if connection["to"] == name]
        groups = {}
        for connection in outgoing:
            groups.setdefault(outgoing_label[connection["type"]], []).append(nodes[connection["to"]])
        for connection in incoming:
            groups.setdefault(incoming_label[connection["type"]], []).append(nodes[connection["from"]])
        quick = ''.join(f'<span><span class="ch-link-type">{label}</span> '
                        + ' · '.join(f'<a href="#event-{other["id"]}">{short(other)}</a>' for other in others) + '</span>'
                        for label, others in groups.items())
        quick = f'<p class="ch-links">{quick}</p>' if quick else ''
        detail = ''.join(f'<p class="chronicle-explanation">{escape(paragraph)}</p>'
                         for paragraph in node["detail"][language].split("\n\n")) if "detail" in node else ''
        evidence = ''.join(f'<li><span>{outgoing_label[connection["type"]]} · </span><a href="#event-{connection["to"]}">{text(nodes[connection["to"]]["title"])}</a>'
                           f'<p>{text(connection["description"])}</p></li>' for connection in outgoing)
        evidence = f'<ul class="chronicle-connections">{evidence}</ul>' if evidence else ''
        sources = ''.join(f'<li><a href="{escape(url, quote=True)}"><span>{escape(label)}</span><span aria-hidden="true">↗</span></a></li>' for label, url in node["sources"])
        status = f'<span class="ch-unsettled">{say("仍在探索", "Still evolving")}</span>' if node["status"] == "evolving" else ''
        alias = f'<span id="branch-{LEGACY_BRANCHES[name]}"></span>' if name in LEGACY_BRANCHES else ''
        title, subtitle = split_title(node["title"][language])
        subtitle = f'<span class="ch-sub"> · {escape(subtitle)}</span>' if subtitle else ''
        state = ' chronicle-work--open' if node["status"] == "evolving" else ''
        return (f'<article class="chronicle-work{state}" id="event-{name}" data-work-topic="{node["topic"]}" data-layer="{topic["layer"]}" aria-labelledby="event-{name}-title">{alias}'
                f'<p class="ch-work-meta"><time>{node["year"]}</time><span class="ch-topic"><i aria-hidden="true"></i>{text(topic["title"])}</span>'
                f'<span>{kinds[node["kind"]]}</span>{status}</p>'
                f'<h4 id="event-{name}-title" data-work-title><span class="ch-name">{escape(title)}</span>{subtitle}</h4>'
                f'<p class="chronicle-lead">{text(node["body"])}</p>{quick}'
                f'<details class="chronicle-more"><summary>{say("背景与后续", "Background & follow-up")}</summary>'
                f'<div class="chronicle-more-body">{detail}<p class="ch-fold-label">{say("要注意的地方", "Keep in mind")}</p>'
                f'<p class="chronicle-limit">{text(node["limit"])}</p>{evidence}</div></details>'
                f'<details class="chronicle-references"><summary>{say("原始资料", "Sources")} <span class="chronicle-source-count">{len(node["sources"])}</span></summary>'
                f'<ol class="chronicle-sources">{sources}</ol></details></article>')

    sections = []
    for era in data["eras"]:
        era_id = f'era-{era["id"]}'
        works = [name for branch in era["branches"] for name in branch["works"]]
        fields = len({nodes[name]["topic"] for name in works})
        stats = say(f"{len(works)} 个节点 · {fields} 个领域", f"{len(works)} milestone{'s' if len(works) != 1 else ''} · {fields} field{'s' if fields != 1 else ''}")
        branches = ''.join(f'<div class="chronicle-branch" id="twig-{era["id"]}-{branch["id"]}"><h3>{text(branch["title"])}</h3>'
                           f'<p class="ch-branch-summary" data-branch-summary>{text(branch["summary"])}</p>'
                           f'{"".join(card(nodes[name]) for name in branch["works"])}</div>' for branch in era["branches"])
        sections.append(f'<section class="chronicle-era" id="{era_id}" data-era="{era["id"]}" aria-labelledby="{era_id}-title">'
                        f'<header class="ch-era-head"><p class="ch-era-years"><span>{era["start"]}</span> <span>– {era["end"]}</span></p>'
                        f'<h2 id="{era_id}-title">{text(era["title"])}</h2><p class="ch-era-stats">{stats}</p></header>'
                        f'<div class="ch-era-body"><p class="chronicle-summary">{text(era["summary"])}</p>{branches}</div></section>')
    return ('<section class="technology-chronicle" id="tree-map" data-chronicle>'
            '<span id="branch-overview"></span><span id="selection"></span><span id="connections"></span>'
            f'{overview}{era_nav}{banner}'
            f'<div class="chronicle-trunk" id="chronicle-content"><span id="turning-points"></span>{"".join(sections)}</div></section>')


def expand(body, language):
    marker = re.search(r'<div data-ai-chronicle(?:="data-ai-chronicle")?></div>', body)
    if marker is None:
        return body
    data = json.loads(DATA.read_text(encoding="utf-8"))
    body = body.replace('class="technology-tree"', 'class="technology-tree tree-chronicle-ready"', 1)
    body = body.replace('class="tree-scene" id="tree-map"', 'class="tree-scene"', 1)
    return re.sub(r'<div data-ai-chronicle(?:="data-ai-chronicle")?></div>', lambda match: render(data, language), body, count=1)
