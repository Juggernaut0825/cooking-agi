import html

import prep_progress


def panel(page, root):
    if page.kind in {"home", "index", "project"}:
        return ""
    source = page.src.relative_to(root).as_posix().replace(".en.md", ".md")
    note = prep_progress.identifier(source)
    chinese = page.lang == "zh"
    labels = (["总阅读", "本月阅读", "总收藏", "本月收藏"] if chinese else
              ["Total reads", "Reads this month", "Total saves", "Saves this month"])
    values = "".join(
        f'<div><dt>{label}</dt><dd data-metric="{key}" aria-label="{"暂无数据" if chinese else "Not available"}">—</dd></div>'
        for key, label in zip(["reads", "month-reads", "saves", "month-saves"], labels))
    explanation = (
        "中英文合并计数。阅读：页面在前台停留 15 秒后，同一浏览器每天最多记一次。"
        "收藏：参与统计的浏览器当前保留的收藏；本月收藏只算本月保存且尚未取消的。月份按 UTC 划分。"
        "这些是近似计数，不代表独立人数，也无法回补统计启用前的数据。"
        if chinese else
        "Both languages share one count. A read requires 15 seconds with the page visible, at most once per browser per UTC day. "
        "Saves count currently active bookmarks from participating browsers; monthly saves were added this UTC month and remain active. "
        "These are approximate counts, not unique people. Activity before counting was enabled cannot be recovered.")
    privacy = (
        "默认不参与。开启后，只提交后续阅读和手动收藏操作，使用每篇独立的随机标识；"
        "不上传旧阅读记录、收藏列表或备份。关闭后停止提交，不影响本地收藏。"
        if chinese else
        "Off by default. Opting in sends only subsequent reads and manual save actions, using a separate random identifier for each note. "
        "Past reading history, saved lists, and backups are not uploaded. Turning this off stops submissions without changing local bookmarks.")
    return (
        f'<section id="note-metrics" class="note-metrics" data-note-metrics="{html.escape(note, quote=True)}" '
        f'aria-label="{"本篇阅读与收藏" if chinese else "Reads and saves for this note"}">'
        f'<div class="note-metrics-heading"><span>{"阅读与收藏" if chinese else "Reads & saves"}</span></div>'
        f'<dl class="note-metrics-values">{values}</dl>'
        f'<p class="note-metrics-status" data-metrics-status role="status" aria-live="polite">'
        f'{"公开统计尚未启用" if chinese else "Public counts are not enabled yet"}</p>'
        '<details class="note-metrics-details">'
        f'<summary>{"统计说明" if chinese else "About these counts"}</summary><p>{explanation}</p><p>{privacy}</p>'
        f'<label><input type="checkbox" data-metrics-consent disabled> '
        f'{"参与匿名统计（可选）" if chinese else "Contribute anonymous counts (optional)"}</label>'
        '<p data-metrics-notice></p></details>'
        f'<button type="button" class="note-metrics-retry" data-metrics-retry hidden>{"重试统计连接" if chinese else "Retry counts"}</button>'
        '</section>')
