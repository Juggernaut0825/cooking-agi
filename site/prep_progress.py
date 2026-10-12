import hashlib
import html
import json
import re
from pathlib import Path


SITE = Path(__file__).resolve().parent


def identifier(source):
    overrides = json.loads((SITE / 'progress-id-overrides.json').read_text())
    value = overrides.get(source, 'note-' + hashlib.sha256(source.encode()).hexdigest()[:16])
    if not re.fullmatch(r'note-[a-f0-9]{16}', value):
        raise ValueError(f'Invalid progress ID for {source}')
    return value


def catalog(pairs):
    result = {}
    updates = json.loads((SITE / 'content-updates.json').read_text())
    if updates.get('version') != 1 or type(updates.get('edition')) is not int or updates['edition'] < 1:
        raise ValueError('Invalid content update manifest')
    for source, pair in pairs.items():
        note_id = identifier(source)
        if note_id in result:
            raise ValueError(f'Duplicate progress ID: {note_id}')
        result[note_id] = {
            'source': source,
            'pages': {language: {'url': page.url, 'title': page.title}
                      for language, page in pair.items() if page}
        }
        topics = content_topics(source)
        if topics and any(pair.values()):
            update = updates['notes'].get(note_id)
            if not update:
                raise ValueError(f'Register new learning content in site/content-updates.json: {source}')
            if (type(update.get('introduced')) is not int or type(update.get('revision')) is not int or
                    not 1 <= update['introduced'] <= update['revision'] <= updates['edition']):
                raise ValueError(f'Invalid content revision: {source}')
            if update['revision'] > update['introduced'] and not all(
                    isinstance(update.get('summary', {}).get(lang), str) and update['summary'][lang].strip()
                    for lang in ('zh', 'en')):
                raise ValueError(f'Content updates need a bilingual summary: {source}')
            result[note_id].update(topics=topics, update=update)
    return {'version': 1, 'updatesVersion': 1, 'edition': updates['edition'], 'notes': result}


def content_topics(source):
    if Path(source).name in {'README.md', 'index.md', 'dashboard.md'}:
        return []
    if source.startswith('00-foundations/'):
        return ['ml'] if '/pytorch/' in source or '/from-linear/' in source else ['ml', 'llm']
    if source.startswith(('05-post-training/', 'practice/post-training/')):
        return ['llm', 'post']
    if source.startswith(('06-systems/', 'open-source/', 'practice/')):
        return ['systems']
    if source.startswith('interview/algorithms/'):
        return ['algorithms']
    if source.startswith(('01-', '02-', '03-', '04-', '07-', '08-', '09-')):
        return ['llm']
    if source.startswith('interview/') and not any(part in source for part in ('speedrun', 'study-plan', 'quick', 'guide')):
        return ['ml']
    return []


def note_controls(page, root):
    if page.kind in {'home', 'index', 'project'} or page.src.name in {'dashboard.md', 'dashboard.en.md'}:
        return ''
    source = page.src.relative_to(root).as_posix().replace('.en.md', '.md')
    chinese = page.lang == 'zh'
    title = html.escape(page.title, quote=True)
    labels = ['未开始', '在学', '想再看一次', '这轮练过了'] if chinese else ['Not started', 'Working on it', 'Revisit', 'Practiced this round']
    options = ''.join(f'<option value="{value}">{label}</option>'
                      for value, label in zip(['planned', 'learning', 'revisit', 'practiced'], labels))
    summary = '学习记录' if chinese else 'My preparation'
    status = '这篇的状态' if chinese else 'Status for this note'
    prompt = '下次从哪里继续？（可选，最多 2000 字符）' if chinese else 'Where will you pick up? (optional, up to 2,000 characters)'
    privacy = '只保存在此浏览器；换设备前请导出备份。' if chinese else 'Saved in this browser only. Export a backup before changing devices.'
    dashboard = page.rel('interview/dashboard.html' if chinese else 'interview/dashboard.en.html')
    link = dashboard + '#progress'
    plan_link = dashboard + '?note=' + identifier(source) + '#schedule'
    return (f'<aside class="prep-update-banner" data-prep-update-note="{identifier(source)}" hidden>'
            f'<strong>{"这篇有内容更新" if chinese else "This note has new material"}</strong><p data-prep-update-summary></p>'
            f'<button type="button" data-prep-update-read>{"标记更新已读" if chinese else "Mark this update as read"}</button></aside>'
            f'<details class="prep-note" data-prep-note="{identifier(source)}" data-prep-title="{title}" hidden>'
            f'<summary>{summary}</summary><label>{status}<select data-prep-status>{options}</select></label>'
            f'<label>{prompt}<textarea data-prep-memo rows="2" maxlength="2000"></textarea></label>'
            '<p data-prep-note-message role="status" aria-live="polite"></p>'
            f'<button type="button" data-prep-note-export hidden>{"先导出进度，再离开本页" if chinese else "Export progress before leaving this page"}</button>'
            f'<p class="prep-storage-hint">{privacy}</p><p class="prep-note-actions"><a href="{link}">{"返回学习台" if chinese else "Back to my dashboard"} →</a>'
            f'<a href="{plan_link}">{"安排这篇笔记" if chinese else "Plan a session for this note"}</a></p></details>')


def dashboard(chinese):
    words = {
        'title': ('我的准备', 'My preparation'),
        'summary': ('进度、备注与备份', 'Progress, notes & backups'),
        'hint': ('自动保存在此浏览器，不需要登录。主站更新不会重置记录；清理浏览器数据、无痕模式或换设备可能丢失，请另存一份备份。',
                 'Saved in this browser, without an account. Site updates do not reset it. Clearing browser data, private browsing, or changing devices can lose it—keep a backup.'),
        'export': ('导出进度', 'Export progress'),
        'import': ('选择备份文件', 'Choose a backup'),
        'drop': ('也可以把本站导出的进度 JSON 拖到这里。文件只在浏览器读取，不会上传。',
                 'Or drop a progress JSON exported by this site here. It is read in your browser, not uploaded.'),
        'policy': ('同一篇笔记或同一次安排有不同记录时', 'When note or session records differ'),
        'keep': ('保留当前记录（默认）', 'Keep current records (default)'),
        'newer': ('采用时间更新的记录', 'Use the newer record'),
        'backup': ('采用备份记录（可恢复较早的备份）', 'Use the backup record (including older backups)'),
        'confirm': ('合并这份备份', 'Merge this backup'),
        'cancel': ('取消', 'Cancel'),
        'recovery': ('导出导入前的备份', 'Export the pre-import backup'),
        'empty': ('还没有给笔记记录状态或备注。打开一篇笔记，展开「学习记录」，选个状态或写下次想做什么。',
                  'No chapter notes or statuses yet. Open a note, expand “My preparation,” and choose a status or leave a next step.'),
        'scope': ('备份包含笔记进度、学习安排与完成记录、收藏、最近阅读、阅读位置、关注主题、更新设置、待安排内容和最近 100 条更新操作。不含未保存的表单或主题等显示偏好。JSON 没有加密，请不要提交到公开仓库。', 'One backup contains study records, sessions, check-ins, bookmarks, recent reading, reading positions, followed topics, update settings, the queue, and the latest 100 update actions. Unsaved forms and display preferences such as the theme are not included. JSON backups are not encrypted; keep them out of public repositories.')
    }
    def word(key):
        return words[key][not chinese]
    return (f'<section id="progress" class="prep-progress" data-prep-dashboard hidden aria-label="{word("title")}">'
            f'<div class="prep-progress-heading"><strong>{word("title")}</strong><a data-prep-continue hidden></a></div>'
            f'<details data-prep-backups><summary>{word("summary")}</summary><p>{word("hint")}</p>'
            '<p data-prep-storage role="status" aria-live="polite"></p>'
            '<p data-prep-library-summary></p>'
            '<ul data-prep-records></ul>'
            f'<p data-prep-empty>{word("empty")}</p><p data-prep-unknown hidden></p>'
            f'<div class="prep-backup-actions"><button type="button" data-prep-export>{word("export")}</button>'
            f'<button type="button" data-prep-import>{word("import")}</button>'
            f'<input type="file" data-prep-file accept=".json,application/json" hidden></div>'
            f'<div class="prep-drop" data-prep-drop><p>{word("drop")}</p></div>'
            '<div class="prep-import-preview" data-prep-preview hidden>'
            '<p data-prep-preview-text></p>'
            f'<label>{word("policy")}<select data-prep-policy><option value="keep-local">{word("keep")}</option>'
            f'<option value="newer">{word("newer")}</option><option value="prefer-backup">{word("backup")}</option></select></label>'
            f'<div class="prep-backup-actions"><button type="button" data-prep-confirm>{word("confirm")}</button>'
            f'<button type="button" data-prep-cancel>{word("cancel")}</button></div></div>'
            f'<button type="button" data-prep-recovery hidden>{word("recovery")}</button>'
            f'<section class="prep-recovery-panel"><h3>{"恢复记录" if chinese else "Recovery copies"}</h3>'
            f'<p>{"浏览器内保留最多 3 份恢复记录。清理整个浏览器会一并删掉它们，所以还要导出文件。可以把文件放进自己的 iCloud / Drive 同步文件夹；本站不会连接云盘，也不会自动同步。" if chinese else "Up to three recovery copies stay in this browser. Clearing all browser data removes them too, so keep a file backup as well. You can store that file in your own iCloud / Drive folder; this site does not connect to or sync with those services."}</p>'
            '<ul data-prep-snapshots></ul></section>'
            '<p data-prep-message role="status" aria-live="polite"></p>'
            f'<p class="prep-storage-hint">{word("scope")}</p></details></section>')


def updates_panel(chinese):
    def choose(zh, en):
        return zh if chinese else en
    topics = [('ml', 'ML 基础', 'ML foundations'), ('llm', '语言模型', 'Language models'),
              ('post', '后训练', 'Post-training'), ('systems', '工程与系统', 'Systems'),
              ('algorithms', '算法与编程', 'Algorithms')]
    choices = ''.join(f'<label><input type="checkbox" data-update-follow="{key}" disabled> {choose(zh, en)}</label>'
                      for key, zh, en in topics)
    return (f'<section id="updates" data-workspace-panel="updates" class="study-updates">'
            f'<section class="study-update-settings"><h2>{choose("关注主题", "Follow what you are learning")}</h2>'
            f'<p>{choose("保存学习记录或安排笔记后，会自动关注相关主题。也可以在下方选择；手动取消关注后，不会再自动勾选。", "Saving a note or planning a session follows its topics. You can also choose below; unfollowing stays in effect.")}</p>'
            f'<fieldset><legend>{choose("选择主题", "Topics to follow")}</legend><div class="study-follow-grid">{choices}</div></fieldset>'
            f'<label class="study-auto-add"><input type="checkbox" data-update-auto disabled> <span><strong>{choose("新笔记自动加入待安排", "Add new notes to my queue")}</strong>'
            f'<small>{choose("默认开启，只加入关注后新发布的笔记，不包含历史文章，也不会自动排进日历。关闭后可手动添加。", "On by default. Only notes published after you follow a topic are added, not its whole archive. Nothing is assigned a date. Turn this off to add notes yourself.")}</small></span></label>'
            f'<p class="study-update-rule">{choose("已有学习记录的文章补充了实质内容或有纠错时，会显示提醒。只改措辞、排版或分类不提醒，也不重置学习状态。", "Substantive changes to tracked notes get a separate notice. Formatting, wording, and reorganizing do not count and never reset your progress.")}</p></section>'
            '<p data-update-message role="status" aria-live="polite"></p>'
            f'<noscript><p>{choose("更新设置需要启用 JavaScript；仍可从路线库打开正文。", "Update settings need JavaScript. You can still open notes from the study routes.")}</p></noscript>'
            f'<div class="study-section-heading"><h2>{choose("待安排与内容更新", "Your queue & content updates")}</h2><p data-update-count></p></div>'
            '<div data-update-list class="study-update-list"></div>'
            f'<p data-update-empty>{choose("目前没有新的待处理内容。先选关注方向，之后的新文章会出现在这里。", "Nothing new to work through. Follow a topic and its future notes will appear here.")}</p>'
            f'<details class="study-update-history"><summary>{choose("最近的更新操作", "Recent update activity")}</summary><p>{choose("保留最近 100 条，不是永久日志。关闭的提醒可以在这里重新打开。", "The latest 100 actions, not a permanent log. You can reopen dismissed notices here.")}</p><ul data-update-history></ul></details>'
            '</section>')
