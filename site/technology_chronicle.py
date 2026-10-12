import html
import json
from pathlib import Path
import re
from urllib.parse import urlsplit
import world_grove


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


def overview(data, language):
    chinese = language == "zh"
    say = lambda zh, en: zh if chinese else en
    text = lambda value: html.escape(value[language])
    nodes = {node["id"]: node for node in data["nodes"]}
    groups, panels, legend = [], [], []
    for layer in data["layers"]:
        buttons = []
        members = [topic for topic in data["topics"] if topic["layer"] == layer["id"]]
        legend.append(f'<span data-world-layer="{layer["id"]}"><i aria-hidden="true"></i>{text(layer["title"])}</span>')
        for topic in members:
            name = topic["id"]
            milestones = sorted((node for node in data["nodes"] if node["topic"] == name), key=lambda node: node["year"])
            count = len(milestones)
            coverage = say(f"已收录 {count} 个代表节点。", f"{count} selected milestone{'s' if count != 1 else ''}. ")
            buttons.append(f'<button type="button" id="field-{name}" class="world-topic" data-topic="{name}" data-world-layer="{layer["id"]}" aria-pressed="false" aria-controls="chronicle-content" disabled>'
                           f'<strong>{text(topic["title"])}</strong><small>{text(topic["subtitle"])}</small><span aria-hidden="true">↗</span></button>')
            selected = list(dict.fromkeys([0, len(milestones) // 2, len(milestones) - 1]))
            previews = ''.join(f'<a href="#event-{milestones[index]["id"]}" data-world-peek><time>{milestones[index]["year"]}</time><span>{text(milestones[index]["title"])}</span><i aria-hidden="true">↗</i></a>' for index in selected)
            panels.append(f'<div data-topic-panel="{name}" hidden><div class="world-panel-top"><p class="world-panel-kicker">{text(layer["title"])}</p>'
                          f'<a href="#tree-map">{say("全部方向", "All fields")} ↗</a></div>'
                          f'<h3>{text(topic["title"])}</h3><p>{text(topic["description"])}</p>'
                          f'<div class="world-samples">{previews}</div>'
                          f'<a class="world-read" href="#event-{milestones[0]["id"]}" data-world-peek>{say("从第一个节点读起", "Read from the first milestone")} <span aria-hidden="true">→</span></a>'
                          f'<p class="world-coverage">{coverage}</p></div>')
        groups.append(f'<div class="world-layer"><p class="world-layer-name">{text(layer["title"])}</p><div class="world-topics">{"".join(buttons)}</div></div>')

    full_period = f'{data["eras"][0]["start"]}—{data["eras"][-1]["end"]}'
    eras = [f'<div class="world-era-copy" data-world-era-copy="0"><p class="world-period">{full_period}</p>'
            f'<h2>{say("AI 的背后，<br>不只有算法", "There is more to AI<br>than algorithms.")}</h2>'
            f'<p class="world-era-summary">{say("模型的进展，也靠电力、芯片、软件和数据。沿年代看这些方向怎样发展；碰到感兴趣的节点，再点开了解当时的问题和做法。", "Progress in models also depends on power, chips, software, and data. Follow their histories through the eras, then open a milestone to see the problem and the approach.")}</p>'
            f'<a class="world-era-read" href="#chronicle-content">{say("从头读起", "Start at the beginning")} <span aria-hidden="true">↓</span></a></div>']
    controls = [f'<button type="button" class="world-all-eras" data-world-era="0" data-world-era-key="all" aria-pressed="true" aria-label="{say("查看全景", "Show all periods")}" disabled><span>{say("全景", "All")}</span></button>']
    all_featured = [name for name in ("transistor-1947", "software-linux-kernel-1991", "transformer", "chatgpt") if name in nodes]
    labels = []
    for index, era in enumerate([{"featured": all_featured}, *data["eras"]]):
        hidden = ' hidden' if index else ''
        leaves = []
        for leaf_index, name in enumerate(era["featured"]):
            node = nodes[name]
            title = node["title"][language].split(" · ")[0].split("：")[0].split(": ")[0]
            layer = next(topic["layer"] for topic in data["topics"] if topic["id"] == node["topic"])
            leaves.append(f'<a href="#event-{name}" class="world-landmark world-landmark--{leaf_index}" data-world-peek data-world-layer="{layer}">'
                          f'<span class="world-leaf-dot" aria-hidden="true"></span><time>{node["year"]}</time><strong>{html.escape(title)}</strong><span class="world-leaf-arrow" aria-hidden="true">+</span></a>')
        labels.append(f'<div class="world-era-leaves" data-world-era-leaves="{index}"{hidden}>{"".join(leaves)}</div>')
        if not index:
            continue
        period = f'{era["start"]}—{era["end"]}'
        eras.append(f'<div class="world-era-copy" data-world-era-copy="{index}"{hidden}>'
                    f'<p class="world-period">{period}</p><h2>{text(era["title"])}</h2>'
                    f'<p class="world-era-summary">{text(era["summary"])}</p>'
                    f'<a class="world-era-read" href="#era-{era["id"]}">{say("读这一段历史", "Read this chapter")} <span aria-hidden="true">↗</span></a></div>')
        label = html.escape(period + ': ' + era["title"][language], quote=True)
        controls.append(f'<button type="button" data-world-era="{index}" data-world-era-key="{era["id"]}" data-era-start="{era["start"]}" data-era-end="{era["end"]}" aria-pressed="false" aria-label="{label}" title="{label}" disabled>'
                        f'<span class="world-era-tick" aria-hidden="true"></span><time>{era["start"]}</time></button>')
    return (f'<section class="world-overview" aria-label="{say("技术全景", "Technology overview")}">'
            f'<div class="world-exhibit"><div class="world-exhibit-top"><span>{say("技术如何走到今天", "HOW WE GOT HERE")}</span>'
            f'<button type="button" data-world-motion disabled>{say("暂停动效", "Pause motion")}</button></div>'
            f'<div class="world-era-controls"><span class="world-era-instruction">{say("选一个年代", "CHOOSE A PERIOD")}</span>'
            f'<div class="world-era-rail" role="group" aria-label="{say("预览年代", "Preview a period")}">{"".join(controls)}</div></div>'
            f'{world_grove.render(data, language)}<div class="world-map world-map--narrative">'
            f'<div class="world-history-copy">{"".join(eras)}'
            f'<div class="world-era-steps" hidden><button type="button" data-world-era-step="-1" aria-label="{say("上一个年代", "Previous period")}">←</button>'
            f'<span data-world-era-position></span><button type="button" data-world-era-step="1" aria-label="{say("下一个年代", "Next period")}">→</button></div></div>'
            f'<div class="world-landmarks">{"".join(labels)}</div>'
            '</div>'
            f'<p class="world-announcement" role="status" data-world-era-status></p></div>'
            f'<div class="world-explore-bar"><div class="world-legend">{"".join(legend)}</div>'
            f'<a href="#chronicle-content">{say("从头读年表", "Read the full timeline")} ↓</a></div>'
            f'<section class="world-directory" id="world-fields"><header><h3>{say("也可以只看一个领域", "Or follow one field")}</h3>'
            f'<p>{say("选一个方向，从它最早收录的节点读起。", "Choose a field and follow its milestones in order.")}</p></header>'
            f'<div class="world-directory-grid">{"".join(groups)}</div></section>'
            f'<div class="world-insight" aria-label="{say("分支导览", "Branch guide")}"><div data-topic-panel="all"></div>{"".join(panels)}</div>'
            '<dialog class="world-dialog" aria-labelledby="world-dialog-title"><div class="world-dialog-top">'
            f'<span data-world-dialog-context>{say("节点笔记", "FIELD NOTE")}</span><div class="world-dialog-actions">'
            f'<a data-language-switch="{ "en" if chinese else "zh" }" data-world-language hidden>{say("EN", "中文")}</a>'
            f'<button type="button" data-world-close aria-label="{say("关闭节点", "Close milestone")}">×</button></div></div>'
            f'<button type="button" class="world-reader-back" data-world-reader-back hidden></button>'
            '<div class="world-reader-page"><p class="world-reader-year" data-world-year></p>'
            '<h2 id="world-dialog-title" tabindex="-1"></h2><div data-world-dialog-body></div>'
            f'<a class="world-dialog-read" href="#chronicle-content" data-world-dialog-read>{say("回到年表", "View in timeline")} <span aria-hidden="true">↗</span></a></div>'
            f'<nav class="world-reader-nav" aria-label="{say("继续阅读节点", "Read more milestones")}">'
            f'<button type="button" data-world-reader-step="-1"><small>{say("上一个", "Previous")}</small><span></span></button>'
            f'<button type="button" data-world-reader-step="1"><small>{say("下一个", "Next")}</small><span></span></button></nav></dialog>'
            '<p class="world-announcement" role="status" data-world-announcement></p>'
            f'<noscript><p>{say("未启用 JavaScript：下方年表仍可展开阅读全部作品和来源。", "JavaScript is off. All works and sources remain readable in the timeline below.")}</p></noscript></section>')


def connection_routes(data, language):
    say = lambda zh, en: zh if language == "zh" else en
    nodes = {node["id"]: node for node in data["nodes"]}
    groups = {}
    for connection in data.get("connections", []):
        groups.setdefault(connection["from"], []).append(connection)
    cards = []
    for origin in sorted(groups, key=lambda name: nodes[name]['year']):
        connections = groups[origin]
        node = nodes[origin]
        links = ''.join(f'<a href="#event-{connection["to"]}" data-world-peek>{html.escape(nodes[connection["to"]]["title"][language].split(" · ")[0])} +</a>' for connection in connections)
        cards.append(f'<article class="world-crossing"><p>{node["year"]} · {say("联系", "CONNECTION")}</p>'
                     f'<a class="world-crossing-title" href="#event-{origin}" data-world-peek>{html.escape(node["title"][language].split(" · ")[0])} +</a>'
                     f'<div class="world-crossing-links">{links}</div>'
                     f'<p class="world-crossing-description">{html.escape(connections[0]["description"][language])}</p></article>')
    if not cards:
        return ''
    return (f'<section class="world-crossings" id="world-connections"><span id="connections"></span><header><h2>{say("一个成果，往往连着几条线", "One result, several histories")}</h2>'
            f'<p>{say("AlexNet 用什么数据训练？ViT 借用了什么结构？从一个熟悉的名字出发，往回看它用到的工作。", "What data did AlexNet use? Which architecture did ViT adapt? Start with a familiar result and follow the work behind it.")}</p></header>'
            f'<div class="world-crossing-grid">{"".join(cards)}</div></section>')


def render(data, language):
    nodes = validate(data)
    escape = html.escape
    chinese = language == "zh"
    say = lambda zh, en: zh if chinese else en
    text = lambda value: escape(value[language])
    kinds = {"research": say("研究", "Research"), "system": say("系统", "System"),
             "product": say("产品 / 发布", "Product / release"), "open": say("开放问题", "Open question")}
    legacy_branches = {"transformer": "language", "alexnet": "vision", "qlearning": "rl",
                       "sac": "robotics", "zero": "systems"}
    relations = {"uses": say("用到的数据或工具", "Data or tools used"), "adapts": say("借用的方法", "Method adapted"), "complements": say("互相补充", "Complementary work")}
    navigation, sections = [], []
    for era in data["eras"]:
        era_id = f'era-{era["id"]}'
        period = f'{era["start"]}–{era["end"]}'
        navigation.append(f'<a href="#{era_id}">{period}</a>')
        featured = []
        for name in era["featured"]:
            node = nodes[name]
            short_title = node["title"][language].split(" · ")[0]
            featured.append(f'<a href="#event-{name}" class="chronicle-feature" data-work-topic="{node["topic"]}">'
                            f'<span>{node["year"]} · {kinds[node["kind"]]}</span>'
                            f'<strong>{escape(short_title)}<i aria-hidden="true"> ↗</i></strong></a>')
        branches = []
        for branch in era["branches"]:
            branch_id = f'twig-{era["id"]}-{branch["id"]}'
            works = []
            for name in branch["works"]:
                node = nodes[name]
                sources = ''.join(f'<li><a href="{escape(url, quote=True)}"><span>{escape(label)}</span><span aria-hidden="true">↗</span></a></li>' for label, url in node["sources"])
                state = ' chronicle-work--open' if node["status"] == 'evolving' else ''
                related = []
                for connection in data.get("connections", []):
                    if connection["from"] == name:
                        target = nodes[connection["to"]]
                        related.append(f'<li><span>{relations[connection["type"]]} · </span><a href="#event-{target["id"]}">{text(target["title"])}</a>'
                                       f'<p>{text(connection["description"])}</p></li>')
                connections = f'<ul class="chronicle-connections">{"".join(related)}</ul>' if related else ''
                detail = ''.join(f'<p class="chronicle-explanation">{escape(paragraph)}</p>'
                                 for paragraph in node["detail"][language].split("\n\n")) if "detail" in node else ''
                background = (f'<details class="chronicle-more"><summary>{say("背景与后续", "Background & follow-up")}</summary>'
                              f'<div class="chronicle-more-body">{detail}<p class="chronicle-limit">{text(node["limit"])}</p>{connections}</div></details>')
                references = (f'<details class="chronicle-references"><summary>{say("原始资料", "Sources")} '
                              f'<span class="chronicle-source-count">{len(node["sources"])}</span></summary>'
                              f'<ol class="chronicle-sources">{sources}</ol></details>')
                status = f'<p class="chronicle-unsettled">{say("仍在探索", "Still evolving")}</p>' if node["status"] == 'evolving' else ''
                alias = f'<span id="branch-{legacy_branches[name]}"></span>' if name in legacy_branches else ''
                works.append(f'<details class="chronicle-work{state}" id="event-{name}" data-work-topic="{node["topic"]}">'
                             f'<summary><time>{alias}{node["year"]}</time><span data-work-title>{text(node["title"])}</span><i aria-hidden="true">+</i></summary>'
                             f'<div class="chronicle-work-body">{status}<p class="chronicle-lead">{text(node["body"])}</p>'
                             f'{background}{references}</div></details>')
            evolving = all(nodes[name]["status"] == "evolving" for name in branch["works"])
            state = ' chronicle-branch--open' if evolving else ''
            names = ' · '.join(nodes[name]["title"][language].split(" · ")[0] for name in branch["works"])
            branches.append(f'<details class="chronicle-branch{state}" id="{branch_id}">'
                            f'<summary><span class="chronicle-sprout" aria-hidden="true">'
                            '<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 45V12M20 32Q4 30 4 14Q20 14 20 32M20 24Q36 22 36 6Q20 6 20 24"/></svg></span>'
                            f'<span class="chronicle-branch-label"><strong>{text(branch["title"])}</strong><small>{escape(names)}</small></span>'
                            '<i class="chronicle-expand" aria-hidden="true">+</i></summary>'
                            f'<div class="chronicle-branch-body"><p data-branch-summary>{text(branch["summary"])}</p><div class="chronicle-works">{"".join(works)}</div></div></details>')
        sections.append(f'<section class="chronicle-era" id="{era_id}" aria-labelledby="{era_id}-title">'
                        f'<div class="chronicle-date"><span>{era["start"]}</span><span>— {era["end"]}</span></div>'
                        '<div class="chronicle-branch-line" aria-hidden="true"><svg viewBox="0 0 250 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 90C90 90 95 8 250 8M110 60Q135 28 138 6"/></svg></div>'
                        f'<div class="chronicle-era-content"><h2 id="{era_id}-title"><span data-era-title>{text(era["title"])}</span><span data-era-focus hidden></span></h2>'
                        f'<p class="chronicle-summary">{text(era["summary"])}</p>'
                        f'<div class="chronicle-featured" aria-label="{say("代表工作与产品", "Selected works and products")}">{"".join(featured)}</div>'
                        f'<p class="chronicle-branch-hint">{say("选一个方向，看看具体的工作。", "Choose a field to explore its milestones.")}</p>'
                        f'<div class="chronicle-branches">{"".join(branches)}</div></div></section>')
    return ('<section class="technology-chronicle" id="tree-map" data-chronicle>'
            '<span id="branch-overview"></span><span id="selection"></span>'
            f'{overview(data, language)}{connection_routes(data, language)}<div class="chronicle-toolbar"><p>{say("按年代，往下读", "Follow the timeline")}</p>'
            f'<button type="button" data-topic-reset aria-controls="chronicle-content" disabled>{say("查看全部分支", "Show all branches")}</button></div>'
            f'<nav class="chronicle-nav" aria-label="{say("按年代浏览", "Browse by period")}"><a class="chronicle-home" href="#tree-map">{say("↑ 回到全景", "↑ Back to tree")}</a>{"".join(navigation)}</nav>'
            f'<p class="chronicle-guide">{say("先读每个年代的概括，就能了解大致变化。想多看一点，再展开领域和作品；不用把每个节点都读完。", "The short era summaries give you the broad changes. Open a field or milestone when you want more detail; there is no need to read every entry.")}</p>'
            f'<div class="chronicle-trunk" id="chronicle-content"><span id="turning-points"></span>{"".join(sections)}</div></section>')


def expand(body, language):
    marker = re.search(r'<div data-ai-chronicle(?:="data-ai-chronicle")?></div>', body)
    if marker is None:
        return body
    data = json.loads(DATA.read_text(encoding="utf-8"))
    body = body.replace('class="technology-tree"', 'class="technology-tree tree-chronicle-ready"', 1)
    body = body.replace('class="tree-scene" id="tree-map"', 'class="tree-scene"', 1)
    return re.sub(r'<div data-ai-chronicle(?:="data-ai-chronicle")?></div>', lambda match: render(data, language), body, count=1)
