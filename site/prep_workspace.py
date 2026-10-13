import html
import json
import re
from pathlib import Path

import prep_progress


def load_routes(pairs):
    data = json.loads((Path(__file__).parent / 'study-routes.json').read_text())
    if data.get('version') != 1:
        raise ValueError('Unsupported study route version')
    seen = set()
    exercise_ids = set()
    for route in data['routes']:
        if not re.fullmatch(r'[a-z][a-z0-9-]*', route['id']) or route['id'] in seen:
            raise ValueError('Invalid or duplicate study route ID')
        seen.add(route['id'])
        if route['topic'] not in {'ml', 'post', 'systems', 'algorithms'} or route['level'] not in {'start', 'refresh'}:
            raise ValueError('Unknown study route filter')
        for labels in [route['title'], route['audience']]:
            if not all(isinstance(labels.get(language), str) and labels[language].strip() for language in ('zh', 'en')):
                raise ValueError('Missing study route translation')
        if not route['steps']:
            raise ValueError('Empty study route')
        for step in route['steps']:
            if not re.fullmatch(r'exercise-[a-z0-9-]{1,80}', step.get('id', '')) or step['id'] in exercise_ids:
                raise ValueError('Invalid or duplicate exercise ID')
            exercise_ids.add(step['id'])
            if step['source'] not in pairs or not all(pairs[step['source']].get(language) for language in ('zh', 'en')):
                raise ValueError(f'Missing bilingual route source: {step["source"]}')
            if type(step['minutes']) is not int or not 5 <= step['minutes'] <= 120:
                raise ValueError('Invalid exercise duration')
            for labels in [step['title'], step['task']]:
                if not all(isinstance(labels.get(language), str) and 0 < len(labels[language].strip()) <= 160 for language in ('zh', 'en')):
                    raise ValueError('Invalid study exercise translation')
    return data['routes']


def library(page, pairs):
    language = page.lang
    chinese = language == 'zh'
    choose = lambda zh, en: zh if chinese else en
    escape = lambda text: html.escape(str(text), quote=True)
    filters = (
        ('topic', choose('想准备什么？', 'What are you preparing?'), [
            ('ml', 'ML 基础与 coding', 'ML foundations & coding'),
            ('post', 'LLM 后训练', 'LLM post-training'),
            ('systems', '推理与 ML 系统', 'Inference & ML systems'),
            ('algorithms', '算法与数据结构', 'Algorithms & data structures')]),
        ('level', choose('从哪儿开始？', 'Where are you starting?'), [
            ('start', '从基础开始', 'New to this · build the basics'),
            ('refresh', '已有基础，查漏补缺', 'Some experience · practice & review')])
    )
    output = ['<div class="study-route-filters" data-route-filters hidden>']
    for kind, label, options in filters:
        output.append(f'<fieldset><legend>{label}</legend><div class="study-segments">')
        for index, (value, zh, en) in enumerate(options):
            output.append(f'<button type="button" data-route-{kind}="{value}" aria-pressed="{str(index == 0).lower()}">{choose(zh, en)}</button>')
        output.append('</div></fieldset>')
    output.append('</div><p class="study-route-result" data-route-result role="status"></p>')
    output.append(f'<p class="study-route-result" data-route-catalog-status>{choose("加入安排需要先加载笔记目录。如果一直没加载好，可以直接阅读，或到学习安排里手动添加。", "Planning from a route needs the note catalog to load. If it stays unavailable, read the linked notes or add a task manually in My schedule.")}</p><div class="study-route-list">')
    for route in load_routes(pairs):
        output.append(f'<article class="study-route-sheet" data-study-route data-topic="{route["topic"]}" data-level="{route["level"]}" aria-labelledby="route-{route["id"]}">')
        output.append(f'<header><p class="study-kicker">{choose("练习顺序", "THREE STARTING POINTS · SKIP WHAT YOU KNOW")}</p><h2 id="route-{route["id"]}">{escape(route["title"][language])}</h2><p>{escape(route["audience"][language])}</p></header><ol class="study-steps">')
        for index, step in enumerate(route['steps'], 1):
            destination = page.rel(pairs[step['source']][language].url)
            output.append(f'<li><span class="study-step-number" aria-hidden="true">{index:02}</span><div><h3>{escape(step["title"][language])}</h3><p>{escape(step["task"][language])}</p><div class="study-step-actions"><a href="{escape(destination)}">{choose("看笔记", "Read the note")} ↗</a>')
            output.append(f'<button type="button" data-route-plan data-exercise-id="{step["id"]}" data-note-id="{prep_progress.identifier(step["source"])}" data-task-title="{escape(step["title"][language])}" data-task-minutes="{step["minutes"]}" aria-label="{choose("安排：", "Plan: ")}{escape(step["title"][language])}" hidden>{choose("加入安排", "Plan this exercise")} +</button><span>{choose("建议留 ", "Allow about ")}{step["minutes"]}{choose(" 分钟", " min")}</span></div></div></li>')
        output.append(f'</ol><div class="study-route-batch"><button type="button" data-route-batch hidden>{choose("安排这组练习", "Plan this route")} →</button><span>{choose("先选练习、日期和时长，再确认保存；已有安排不变。", "Preview dates and durations before saving. Existing sessions stay as they are.")}</span></div></article>')
    output.append('</div>' + route_preview(chinese))
    return ''.join(output)


def route_preview(chinese):
    choose = lambda zh, en: zh if chinese else en
    return f'''<form class="study-route-preview" data-route-preview hidden aria-labelledby="route-preview-heading">
<p class="study-kicker">{choose('计划草稿 · 还没保存', 'DRAFT · NOT SAVED YET')}</p>
<h2 id="route-preview-heading" data-route-preview-title tabindex="-1"></h2>
<p>{choose('默认每隔一天安排一次。可以逐项修改日期和时长，取消不需要的练习，再确认保存。时长是本次练习的计划用时，不是学完整章的期限。', 'Dates start two days apart. Change any date or duration, and uncheck exercises you do not need. These are practice slots, not deadlines for mastering a chapter.')}</p>
<div data-route-preview-rows></div>
<p data-route-preview-summary role="status"></p>
<p data-route-preview-error role="alert"></p>
<div class="study-route-preview-actions"><button type="submit" data-route-preview-save>{choose('确认加入安排', 'Add selected sessions')}</button><button type="button" data-route-preview-cancel>{choose('取消草稿', 'Cancel draft')}</button><a href="#schedule">{choose('查看已有安排', 'View my schedule')} →</a></div>
</form><p class="study-route-save-message" data-route-save-message role="status" hidden></p>'''
