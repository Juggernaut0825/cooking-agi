def planner(chinese):
    words = {
        'title': ('我的学习安排', 'My study schedule'),
        'intro': ('选有空的日期，写下要做的练习。每次时长可以不同，安排好后也能修改。',
                  'Pick days that work for you and one task at a time. Twenty minutes today, an hour next time—leave the other days free.'),
        'add': ('安排一次学习', 'Plan a session'),
        'backup': ('备份与恢复', 'Back up or restore'),
        'view': ('显示', 'Show'),
        'planned': ('待完成', 'Planned'),
        'done': ('已完成', 'Completed'),
        'cancelled': ('已移除的安排', 'Removed'),
        'all': ('全部安排', 'All active sessions'),
        'form': ('安排一次学习', 'Plan a session'),
        'task': ('这次想做什么？', 'What will you work on?'),
        'placeholder': ('比如：手写 softmax，补两个测试', 'e.g. Implement softmax and add two tests'),
        'date': ('计划日期', 'Planned date'),
        'minutes': ('计划学习时长（分钟）', 'Planned focus time (minutes)'),
        'note': ('关联一篇笔记（可选）', 'Link a note (optional)'),
        'none': ('不关联，自己安排', 'No note—use my own task'),
        'save': ('保存安排', 'Save session'),
        'cancel': ('取消', 'Cancel'),
        'record': ('记录本次学习', 'Record this session'),
        'actualDate': ('实际学习日期', 'Date you studied'),
        'actualMinutes': ('实际学习时长（分钟，可不填）', 'Actual focus time (minutes, optional)'),
        'recordHint': ('时长按实际学习时间估算，不含休息，可以与计划不同。保存后，本次安排标为已完成，笔记的学习状态不变。',
                       'A rough estimate is fine—no timer or minimum target needed. Finishing a session does not mark its note as mastered.'),
        'check': ('保存记录', 'Save check-in'),
        'privacy': ('安排和完成记录只保存在此浏览器，与笔记进度一起导出，不会上传。换设备或清理浏览器前，请先备份。',
                    'Sessions and check-ins stay in this browser and use the same progress backup. Nothing is uploaded. Export before switching devices or clearing browser data.'),
        'nojs': ('日期计划需要开启 JavaScript。也可以按学习路线，用自己的日历或笔记记录。',
                 'The schedule needs JavaScript. You can also follow a study route and keep dates in your own calendar or notes.')
    }
    def word(key):
        return words[key][not chinese]
    return (f'<section id="schedule" class="prep-schedule" data-prep-schedule hidden aria-labelledby="schedule-title">'
            f'<div class="prep-schedule-heading"><div><p class="prep-eyebrow">{"日期与任务" if chinese else "At your pace"}</p>'
            f'<h2 id="schedule-title">{word("title")}</h2></div><button type="button" data-schedule-add>{word("add")} <span aria-hidden="true">+</span></button></div>'
            f'<p class="prep-schedule-intro">{word("intro")}</p>'
            '<div class="study-calendar" data-prep-calendar hidden>'
            f'<div class="study-calendar-heading"><h3 data-calendar-heading></h3><div><button type="button" data-calendar-prev aria-label="{"上一周" if chinese else "Previous week"}">←</button>'
            f'<button type="button" data-calendar-today>{"本周" if chinese else "This week"}</button><button type="button" data-calendar-next aria-label="{"下一周" if chinese else "Next week"}">→</button></div></div>'
            '<div class="study-calendar-days" data-calendar-days></div>'
            f'<p>{"日历显示待完成的安排。点选日期，查看当天的任务。" if chinese else "Planned sessions, not a streak. Select a day to see its plans; empty days are fine."}</p></div>'
            '<p data-schedule-message role="status" aria-live="polite"></p>'
            '<form class="prep-session-form" data-schedule-form hidden>'
            f'<h3 data-schedule-form-title tabindex="-1">{word("form")}</h3><fieldset data-schedule-fields>'
            f'<label class="prep-session-wide">{word("task")}<input data-session-title type="text" required maxlength="160" placeholder="{word("placeholder")}"></label>'
            f'<label>{word("date")}<input data-session-date type="date" required min="1900-01-01" max="2200-12-31"></label>'
            f'<label>{word("minutes")}<input data-session-minutes type="number" required min="1" max="1440" step="1" value="30"></label>'
            f'<label class="prep-session-wide">{"找一篇笔记" if chinese else "Find a note"}<input data-session-search type="search" maxlength="120" placeholder="{"输入标题或关键词，如 attention" if chinese else "Search by title or keyword, e.g. attention"}"></label>'
            f'<label class="prep-session-wide">{word("note")}<select data-session-note><option value="">{word("none")}</option></select></label>'
            f'<div class="prep-session-wide prep-session-actions"><button type="submit">{word("save")}</button><button type="button" data-schedule-cancel>{word("cancel")}</button></div>'
            '</fieldset><p data-schedule-form-error role="alert"></p></form>'
            '<form class="prep-session-form" data-schedule-checkin hidden>'
            f'<h3 tabindex="-1">{word("record")}</h3><p data-checkin-task></p><fieldset data-checkin-fields>'
            f'<label>{word("actualDate")}<input data-checkin-date type="date" required min="1900-01-01" max="2200-12-31"></label>'
            f'<label>{word("actualMinutes")}<input data-checkin-minutes type="number" min="0" max="1440" step="1"></label>'
            f'<p class="prep-session-wide">{word("recordHint")}</p><div class="prep-session-wide prep-session-actions"><button type="submit">{word("check")}</button><button type="button" data-checkin-cancel>{word("cancel")}</button></div>'
            '</fieldset><p data-checkin-error role="alert"></p></form>'
            f'<div class="prep-schedule-toolbar"><p data-schedule-summary></p><label>{word("view")}<select data-schedule-filter>'
            f'<option value="planned">{word("planned")}</option><option value="done">{word("done")}</option><option value="all">{word("all")}</option><option value="cancelled">{word("cancelled")}</option></select></label></div>'
            f'<div class="study-day-filter" data-schedule-day-filter hidden><span data-schedule-day-label></span><button type="button" data-schedule-clear-day>{"查看所有日期" if chinese else "Show all dates"}</button></div>'
            '<div data-schedule-list></div><p class="prep-schedule-empty" data-schedule-empty></p>'
            f'<p class="prep-schedule-privacy">{word("privacy")} <a href="#progress">{word("backup")} →</a></p></section>'
            f'<noscript><p>{word("nojs")}</p></noscript>')
