// The strip under a demo window says, in plain words, what the last thing done in it would change.
// Shared by the landing page and the docs, so the two explain the app the same way.
(function () {
    var readout = document.getElementById('readout');
    var stage = document.getElementById('winhance-demo');
    if (!readout || !stage) return;
    var idle = readout.innerHTML;

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function say(title, detail, writes, link) {
        readout.textContent = '';
        var what = el('div', 'readout-what');
        what.appendChild(el('strong', null, title));
        if (detail) what.appendChild(el('span', null, detail));
        readout.appendChild(what);
        if (writes && writes.length) {
            var box = el('div', 'readout-writes');
            writes.slice(0, 2).forEach(function (w) {
                box.appendChild(el('code', 'readout-path', w.path));
                w.values.slice(0, 3).forEach(function (v) {
                    var line = el('code', 'readout-value');
                    line.appendChild(document.createTextNode(v.name + ' = '));
                    line.appendChild(el('b', null, v.value || '(removed)'));
                    if (v.type) line.appendChild(el('span', 'readout-type', '  ' + v.type));
                    box.appendChild(line);
                });
            });
            readout.appendChild(box);
        }
        if (link) {
            var a = el('a', null, link.text);
            a.href = link.href;
            readout.appendChild(a);
        }
    }

    function demo() { return window.WinhanceDemo; }

    function hook() {
        var demo = window.WinhanceDemo;
        if (!demo) return;
        demo.on(function (e) {
            if (e.type === 'change') {
                var s = e.setting;
                var writes = demo.write(s, e.to);
                var docs = null;
                demo.data.features.forEach(function (f) {
                    if (f.settings.indexOf(s) >= 0) docs = f;
                });
                say(s.name + ': ' + e.label,
                    writes.length ? 'In Winhance, this writes:' : 'In Winhance, this applies the option straight away.',
                    writes,
                    { text: 'How it works', href: docsLink(docs, s) });
            } else if (e.type === 'bulk' && (e.kind === 'accept' || e.kind === 'reject')) {
                say(e.count + (e.count === 1 ? ' change ' : ' changes ') + (e.kind === 'accept' ? 'accepted' : 'rejected'),
                    'Every change in ' + e.scope.join(', ') + ' is marked at once. The count in the bar at the top moves with it.');
            } else if (e.type === 'decide') {
                say(e.setting.name + ': ' + (e.apply ? 'will apply' : "won't apply"),
                    e.apply ? 'Apply Config changes it from ' + e.from + ' to ' + e.to + '.' : 'It stays at ' + e.from + '. Nothing from the config touches it.');
            } else if (e.type === 'reviewApplied') {
                var appsDone = [];
                if (e.remove) appsDone.push(e.remove + ' apps removed');
                if (e.install) appsDone.push(e.install + ' apps installed');
                say('Config applied',
                    e.applied + (e.applied === 1 ? ' setting' : ' settings') + ' changed' + (appsDone.length ? ', ' + appsDone.join(' and ') : '') + '. ' +
                    (e.skipped ? e.skipped + ' you said no to stayed as they were. ' : '') + 'In the app, this is the moment Winhance writes to your PC. Here, the window just shows the new values.');
            } else if (e.type === 'mode' && e.mode === 'ConfigReview') {
                say('Reviewing the Winhance recommended config',
                    'It would change ' + e.changes + ' settings and ticks ' + e.apps + ' apps. Each change shows Current and Config, with Apply or Don\'t apply. Quick Actions accepts or rejects a whole page at once. Apply Config unlocks once everything is reviewed.');
            } else if (e.type === 'bulk') {
                say(e.count + (e.count === 1 ? ' setting changed' : ' settings changed'),
                    e.count ? 'Quick Actions set everything in ' + e.scope.join(', ') + ' at once. Open a card to see its Technical Details.' : 'Everything here was already set that way.');
            } else if (e.type === 'apps') {
                var list = e.names.slice(0, 6).join(', ') + (e.names.length > 6 ? ' and ' + (e.names.length - 6) + ' more' : '') + '. ';
                var count = e.names.length + (e.names.length === 1 ? ' item ' : ' items ');
                if (e.action === 'remove') say(count + (e.save ? 'removed, and kept removed' : 'removed once'),
                    list + (e.save
                        ? 'Winhance saves a removal script and a scheduled task, so Windows can\'t quietly bring them back.'
                        : 'Winhance also deletes every removal script and task it saved before, not just ones for these.'),
                    null, { text: 'How removal works', href: demo.asset('docs/features/software-apps/windows-apps.html#how-removal-works') });
                else say(count + (e.action === 'install' ? 'ready to install' : 'ready to uninstall'),
                    list + (e.action === 'install' ? 'In the app, Winhance installs them one after another and shows the progress of each.' : 'In the app, Continue starts the uninstall.'), null,
                    { text: 'How it works', href: demo.asset('docs/features/software-apps/external-apps.html') });
            } else if (e.type === 'locked') {
                if (stage.dataset.focus != null && e.page !== stage.dataset.page) say(stage.dataset.focus, 'The full demo on the home page opens every page.', null, { text: 'Open the full demo', href: demo.asset('index.html#top') });
                else if (e.page === 'Autounattend') say('Unattend lives in Builder mode', 'Pick Builder in the title bar, then Autounattend in the bar under it, to build an answer file. Nothing you choose there touches the PC you are on.');
                else say(demo.data.strings.Builder.wimLocked, 'Finish or cancel the config review to use WIMUtil again.');
            } else if (e.type === 'target') {
                if (e.target === 'Autounattend') say('Unattend is open', 'The Unattend page in the sidebar now builds an autounattend.xml answer file for a clean Windows install.');
            } else if (e.type === 'filter') {
                var C = demo.data.strings.common;
                say(e.on ? C.filterOn : C.filterOff, e.on ? C.filterOnText : C.filterOffText);
            } else if (e.type === 'wim') {
                if (e.step === 'session') say('Building an answer file for this media', 'WIMUtil has a Windows 11 ISO extracted and ready. Generate and add Winhance XML switches Winhance to Builder mode, and the Unattend settings appear right in the card. Pick what the new install should do, then click Generate.');
                else if (e.step === 'generated') say('autounattend.xml added to the media', 'In the app, Winhance writes the answer file into the working folder and checks it. Add drivers next, or go straight to step 4 and build the ISO or USB.');
                else say('In the app, this opens a file picker or runs the step', 'The demo stops here. Nothing is downloaded or written.');
            } else if (e.type === 'refresh') {
                say('Refresh', 'In the app, this checks again what is installed on your PC.');
            } else if (e.type === 'save') {
                say('Nothing is saved here', 'In the app, this writes the file or applies the choices. The demo only shows the window.');
            } else if (e.type === 'mode') {
                var tip = demo.data.shell.modes.filter(function (m) { return m.id === e.mode; })[0];
                if (tip) say(tip.label, tip.tooltip);
            } else if (e.type === 'theme') {
                // Winhance's theme setting drives the page too, the way it drives the app.
                document.documentElement.setAttribute('data-theme', e.theme);
                try { localStorage.setItem('theme', e.theme); } catch (err) { /* not remembered, still applied */ }
            } else if (e.type === 'language') {
                say(e.name, 'Winhance is translated into ' + demo.data.shell.languages.length + ' languages. The demo stays in English.');
            } else if (e.type === 'page') {
                var fresh = demo.data.freshInstall;
                if (e.page === 'SoftwareApps') say(demo.data.strings.SoftwareApps.title, 'Installed marks what a fresh ' + fresh.name + ' ' + fresh.version + ' install comes with. In the app, it shows what is on your PC.');
                else readout.innerHTML = idle;
            } else if (e.type === 'action') {
                say(e.setting.name, 'In the app, this runs once when you click it.');
            }
        });
    }

    function docsLink(feature, s) {
        return demo().asset(feature ? feature.docs + '#' + s.id : 'docs/index.html');
    }

    hook();
})();
