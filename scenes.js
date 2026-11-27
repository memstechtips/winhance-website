/* ===== What's in the app: before/after scenes =====
   Each area pins while its scene runs from 0 (Windows as it ships) to 1 (after Winhance's recommended set).
   The scenes are drawn from the demo's own data (demo/app.js): the apps a fresh 25H2 Pro install has, the
   recommended config's settings and apps, each setting's Windows default, and the app's strings. So when the
   app's defaults or recommendations change, the scenes follow at the next gen-demo run. Every moving part
   has a window [a, b] of the run, and its eased progress there is written to a CSS variable (--e unless
   named); scenes.css draws everything from those, so scrolling back plays it in reverse. */
(function () {
    var demo = window.WinhanceDemo;
    var areas = document.querySelector('.areas');
    if (!demo || !demo.data || !areas) return;
    var app = demo.data, S = app.strings, review = app.review;
    var settings = {};
    app.features.forEach(function (f) { f.settings.forEach(function (s) { settings[s.id] = s; }); });

    var esc = function (t) {
        return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    };
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var check = '<svg class="i"><use href="#i-CheckmarkCircleFilled"/></svg>';
    // Installed packages that never show on Start.
    var HIDDEN = ['App Installer', 'Xbox Identity Provider', 'Xbox Live In-Game Experience', 'Windows Advanced Settings', 'Bing Search'];
    var onStart = function (a) { return a.installed && HIDDEN.indexOf(a.name) < 0; };

    // A setting the recommended set moves off its Windows default, and the option labels either side.
    var change = function (id) {
        var s = settings[id], to = review.settings[id];
        if (!s || to === undefined || !s.windowsDefault.length || s.windowsDefault.indexOf(to) >= 0) return null;
        return { setting: s, from: s.options[s.windowsDefault[0]], to: s.options[to] };
    };
    var changedIn = function (area) {
        return app.features.filter(function (f) { return f.area === area; }).reduce(function (n, f) {
            return n + f.settings.filter(function (s) { return change(s.id); }).length;
        }, 0);
    };
    var byName = function (list, name) { return list.filter(function (a) { return a.name === name; })[0]; };
    var removes = {};
    review.apps.forEach(function (k) { removes[k] = true; });

    // Windows 11 26H2's Start menu, as screenshots of a fresh install show it. Its default pins in order (LinkedIn
    // left out: no icon for it ships), with the shorter names Start gives some of them.
    var PINS = ['Microsoft Edge', 'Outlook for Windows', 'Microsoft Store', 'Photos', 'Settings', 'Xbox', 'Solitaire Collection', 'WhatsApp',
        'Paint', 'Calculator', 'Alarms & Clock', 'Notepad', 'Snipping Tool', 'File Explorer'];
    var SHORT = { 'Outlook for Windows': 'Outlook', 'Solitaire Collection': 'Solitaire & Casual Games', 'Alarms & Clock': 'Clock' };
    var pinned = function (name) { return !removes['windows:' + name]; };
    var shown = function (name) { return SHORT[name] || name; };
    var abc = function (a, b) { return shown(a).localeCompare(shown(b)); };
    var startIcon = function (name) {
        if (name === 'Settings') return demo.glyph('Fluent/SettingsColor');
        if (name === 'File Explorer') return '<svg class="i sm-folder"><use href="#i-FolderFilled"/></svg>';
        var a = byName(app.apps.windows, name) || byName(app.apps.external, name);
        return a ? demo.appIcon(a, '') : '';
    };
    var startApp = function (name, cls, style) {
        return '<span class="sm-app' + (cls ? ' ' + cls : '') + '" data-n="' + esc(name) + '"' + (style ? ' style="' + style + '"' : '') + '><span class="sm-icon">' + startIcon(name) +
            '</span><span class="sm-name">' + esc(SHORT[name] || name) + '</span></span>';
    };
    var viewLabel = function (v) { return '<span class="sm-view">View: ' + v + demo.glyph('Fluent/ChevronDown') + '</span>'; };
    // Recommended on a fresh install holds one item, Get Started; the Tips app's icon stands in for its own.
    var getStarted = function (cls, style) {
        return '<div class="sm-reco' + (cls ? ' ' + cls : '') + '"' + (style ? ' style="' + style + '"' : '') + '><span class="sm-icon">' +
            startIcon('Tips') + '</span><span>Get Started</span><span>Welcome to Windows</span></div>';
    };

    var tally = function (scene, before, after) {
        scene.querySelector('[data-tally="before"]').textContent = before;
        scene.querySelector('[data-tally="after"]').textContent = after;
    };

    var builders = {
        // Start as Windows ships it, All in Grid view: the pins and apps the recommended set removes go, the list scrolling
        // past as they do, and what is left closes up. Then the programs the recommended config lists, as a choice:
        // nothing is ticked until you tick it.
        apps: function (scene, part) {
            var COLS = 8, COL = 72, LEFT = 28, PIN_ROW = 76, ROW = 78, LETTER = 30;
            var shipped = app.apps.windows.filter(onStart).sort(function (a, b) { return abc(a.name, b.name); });
            var kept = shipped.filter(function (a) { return !removes['windows:' + a.name]; });
            var gone = shipped.filter(function (a) { return removes['windows:' + a.name]; });
            var offered = review.apps.filter(function (k) { return k.indexOf('external:') === 0; }).map(function (k) {
                return app.apps.external.filter(function (a) { return a.name === k.slice(9); })[0];
            }).filter(Boolean);
            var keptPins = PINS.filter(pinned);

            // Where everything sits, top to bottom, for a pin list and an app list.
            var layout = function (pins, apps) {
                var at = { pin: {}, app: {}, letter: {} }, y = 16;
                at.pinned = y; y += 30;
                pins.forEach(function (n, i) { at.pin[n] = [LEFT + i % COLS * COL, y + Math.floor(i / COLS) * PIN_ROW]; });
                y += Math.ceil(pins.length / COLS) * PIN_ROW + 14;
                at.recoH = y; at.reco = y + 26; y += 86;
                at.all = y; y += 34;
                var letter = null, i = 0;
                apps.forEach(function (a) {
                    var l = shown(a.name).charAt(0).toUpperCase();
                    if (l !== letter) { if (letter !== null) y += ROW; letter = l; at.letter[l] = y; y += LETTER; i = 0; }
                    else if (i % COLS === 0) y += ROW;
                    at.app[a.name] = [LEFT + i % COLS * COL, y];
                    i++;
                });
                at.height = y + ROW;
                return at;
            };
            var L0 = layout(PINS, shipped), L1 = layout(keptPins, kept);
            var pos = function (p0, p1) { p1 = p1 || p0; return '--x0:' + p0[0] + ';--y0:' + p0[1] + ';--x1:' + p1[0] + ';--y1:' + p1[1]; };
            var row = function (y0, y1) { return pos([0, y0], [0, y1 === undefined ? y0 : y1]); };
            var html = '<div class="sm-h sm-at" style="' + row(L0.pinned, L1.pinned) + '">Pinned</div>' +
                PINS.map(function (n) { return startApp(n, 'sm-at is-pin' + (pinned(n) ? '' : ' is-gone'), pos(L0.pin[n], L1.pin[n])); }).join('') +
                '<div class="sm-h sm-at" style="' + row(L0.recoH, L1.recoH) + '">Recommended</div>' + getStarted('sm-at', row(L0.reco, L1.reco)) +
                '<div class="sm-h sm-at" style="' + row(L0.all, L1.all) + '">All' + viewLabel('Grid') + '</div>' +
                Object.keys(L0.letter).map(function (l) {
                    return '<div class="sm-letter sm-at' + (L1.letter[l] === undefined ? ' is-gone' : '') + '" data-l="' + l + '" style="' + row(L0.letter[l], L1.letter[l]) + '">' + l + '</div>';
                }).join('') +
                shipped.map(function (a) { return startApp(a.name, 'sm-at' + (kept.indexOf(a) < 0 ? ' is-gone' : ''), pos(L0.app[a.name], L1.app[a.name])); }).join('');
            var menu = scene.querySelector('.sx-start'), scroll = menu.querySelector('.sm-scroll');
            scroll.innerHTML = html;
            scroll.style.height = L0.height + 'px';

            // Pins first, then the list in reading order as it scrolls past; a letter goes with its last app.
            var VIEW = 498, deepest = Math.max(0, L0.height - VIEW), span = L0.height - L0.all;
            var lastOf = {};
            gone.forEach(function (a) { lastOf[shown(a.name).charAt(0).toUpperCase()] = a; });
            var g = 0, removal = {};
            Array.prototype.forEach.call(scroll.querySelectorAll('.is-gone'), function (el) {
                if (el.classList.contains('sm-letter')) return;
                var t = .03 + .05 * g++ / 7;
                if (!el.classList.contains('is-pin')) {
                    var name = el.getAttribute('data-n');
                    t = .1 + .3 * (L0.app[name][1] - L0.all) / span;
                    removal[name] = t;
                }
                part(el, t, t + .07);
            });
            scroll.querySelectorAll('.sm-letter.is-gone').forEach(function (el) {
                var t = removal[lastOf[el.getAttribute('data-l')].name];
                part(el, t, t + .07);
            });
            var down = part(scroll, .1, .42, null), back = part(scroll, .46, .56, '--m');
            // Down through the list while it empties, back to the top as it closes up.
            part(scroll, 0, 1, null, function () {
                var y = (down.value - back.value) * deepest;
                scroll.style.transform = 'translateY(' + (-y).toFixed(1) + 'px)';
            });
            part(menu, .56, .64);

            // A few ticked by hand, to show the list is yours to pick from.
            var ticked = offered.filter(function (a, i) { return i % 5 === 0; });
            var list = scene.querySelector('.sx-picks-list');
            list.innerHTML = offered.map(function (a) {
                return '<span class="wd-compact-row"><span class="wd-checkbox-box">' + demo.glyph('Fluent/Checkmark') + '</span>' +
                    '<span class="wd-row-app">' + demo.appIcon(a, '') + '</span><span class="wd-compact-name">' + esc(a.name) + '</span></span>';
            }).join('');
            var picks = scene.querySelector('.sx-picks');
            part(picks, .56, .66);
            Array.prototype.forEach.call(list.children, function (row, i) {
                var a = .6 + .14 * i / offered.length;
                part(row, a, a + .06);
                var t = ticked.indexOf(offered[i]);
                if (t >= 0) part(row.querySelector('.wd-checkbox-box'), .8 + t * .05, .84 + t * .05, '--t');
            });
            part(scene.querySelector('.sx-picks-btn'), .8, .84, '--t');
            var count = scene.querySelector('.sx-picks-count');
            var boxes = Array.prototype.map.call(list.querySelectorAll('.wd-checkbox-box'), function (b) { return b; });
            part(picks, 0, 1, null, function () {
                var n = boxes.filter(function (b) { return parseFloat(b.style.getPropertyValue('--t')) > .5; }).length;
                count.textContent = n + ' of ' + offered.length + ' selected';
            });
            scene.querySelector('[data-str="install"]').textContent = S.SoftwareApps.install;
            tally(scene, shipped.length + ' apps preinstalled', gone.length + ' removed, then you pick from ' + offered.length + ' programs');
        },

        // The Settings app, three pages in turn: privacy switches turned off, then gaming, then power. Each row
        // is a setting the recommended set moves off its Windows default, in the app's own words.
        optimize: function (scene, part) {
            var PAGES = {
                privacy: ['privacy-language-list', 'privacy-app-launch-tracking', 'privacy-settings-content', 'privacy-tailored-experiences',
                    'privacy-activity-history', 'privacy-search-highlights', 'privacy-feedback-frequency', 'privacy-disable-copilot-nudges'],
                gaming: ['gaming-xbox-game-dvr', 'gaming-game-bar-controller', 'gaming-game-bar-tips', 'gaming-cpu-priority',
                    'gaming-system-responsiveness', 'gaming-scheduling-category'],
                power: ['power-plan-selection', 'processor-min-state', 'power-throttling', 'power-sleep-timeout', 'power-hibernation-enable', 'power-fast-startup'],
            };
            // Windows ships with Balanced as the active plan; the catalog reads the plan list at run time, so names no default.
            var shipsAs = { 'power-plan-selection': 'Balanced' };
            var rowOf = function (id) {
                var c = change(id), s = settings[id];
                if (!c && s && shipsAs[id] && review.settings[id] !== undefined) c = { setting: s, from: shipsAs[id], to: s.options[review.settings[id]] };
                if (!c) return null;
                var toggle = (c.from === S.common.on || c.from === S.common.off) && (c.to === S.common.on || c.to === S.common.off);
                var control = toggle
                    ? '<span class="sx-switch"><span class="sx-state"><span>' + esc(c.from) + '</span><span>' + esc(c.to) + '</span></span><span class="sx-toggle"></span></span>'
                    : '<span class="sx-drop"><span><span>' + esc(c.from) + '</span><span>' + esc(c.to) + '</span></span>' + demo.glyph('Fluent/ChevronDown') + '</span>';
                return '<div class="sx-row' + (c.to === S.common.on ? ' is-up' : '') + '">' + (s.icon ? demo.glyph(s.icon) : '<span></span>') +
                    '<span class="sx-row-text"><b>' + esc(s.name) + '</b><span>' + esc(s.description) + '</span></span>' + control + '</div>';
            };
            // [rows start, rows end] for each page; a page hands over to the next just after its last row.
            var SPANS = [[.04, .24], [.38, .56], [.68, .9]];
            var pages = scene.querySelectorAll('.sx-spage');
            var shown = Array.prototype.map.call(pages, function (page, k) {
                var box = page.querySelector('.sx-rows');
                box.innerHTML = PAGES[page.getAttribute('data-rows')].map(rowOf).filter(Boolean).slice(0, 6).join('');
                var span = SPANS[k];
                Array.prototype.forEach.call(box.children, function (row, i) { var a = span[0] + (span[1] - span[0]) * i / box.children.length; part(row, a, a + .07); });
                if (k) part(page, span[0] - .055, span[0] - .01, '--in');
                return k < pages.length - 1 ? part(page, SPANS[k + 1][0] - .1, SPANS[k + 1][0] - .06, '--out') : null;
            });
            var nav = scene.querySelectorAll('.sx-snav [data-page]');
            part(scene.querySelector('.sx-pages'), 0, 1, null, function () {
                var here = shown.filter(function (out) { return out && out.value > .5; }).length;
                Array.prototype.forEach.call(nav, function (el) { el.classList.toggle('is-here', +el.getAttribute('data-page') === here); });
            });
            tally(scene, 'Tracking on, Game Bar recording, a Balanced plan', changedIn('Optimize') + ' settings changed across privacy, gaming and power');
        },

        // A light desktop that turns dark while the taskbar sheds what the recommended set hides and moves left,
        // then Start opens from its new place, drops the Recommended section and shows All as a list.
        customize: function (scene, part) {
            var desk = scene.querySelector('.sx-desk');
            // Start without what the Software & Apps scene removed, as the taskbar below it is.
            var kept = app.apps.windows.filter(function (a) { return onStart(a) && !removes['windows:' + a.name]; });
            var listed = kept.map(function (a) { return a.name; }).concat(['Accessibility', 'File Explorer', 'Settings']).sort(abc);
            var letter = null;
            var menuEl = scene.querySelector('.sx-menu');
            menuEl.querySelector('.sm-scroll').innerHTML =
                '<div class="sm-h">Pinned</div><div class="sm-pins">' + PINS.filter(pinned).map(function (n) { return startApp(n); }).join('') + '</div>' +
                '<div class="sm-reco-box" data-off="start-recommended-section"><div class="sm-h">Recommended</div>' + getStarted() + '</div>' +
                '<div class="sm-allbox"><div class="sm-h">All' + '<span class="sm-view"><span><span>View: Category</span><span>View: List</span></span>' + demo.glyph('Fluent/ChevronDown') + '</span></div>' +
                '<div class="sm-all"><div class="sm-cats"><span class="sm-cat"><span>' + kept.slice(0, 4).map(function (a) { return '<span class="sm-icon">' + demo.appIcon(a, '') + '</span>'; }).join('') +
                '</span><span>Other</span></span><span class="sm-cat"><span class="is-one"><span class="sm-icon"><svg class="i"><use href="#i-Accessibility"/></svg></span></span><span>Accessibility</span></span></div>' +
                '<div class="sm-list">' + listed.map(function (n) {
                    var l = shown(n).charAt(0).toUpperCase(), head = l !== letter ? '<div class="sm-letter">' + l + '</div>' : '';
                    letter = l;
                    var icon = n === 'Accessibility' ? '<svg class="i sm-folder"><use href="#i-FolderFilled"/></svg>' : startIcon(n);
                    return head + '<div class="sm-row"><span class="sm-icon">' + icon + '</span>' + esc(SHORT[n] || n) + '</div>';
                }).join('') + '</div></div></div>';
            // The taskbar a fresh install pins; an app the recommended set removes takes its pin with it.
            var tbPins = ['Microsoft Edge', 'Microsoft Store', 'Outlook for Windows'].map(function (n) { return byName(app.apps.windows, n); }).filter(Boolean);
            var copilot = scene.querySelector('[data-app]');
            copilot.innerHTML = '<span class="sx-tile-icon">' + demo.appIcon(byName(app.apps.windows, copilot.getAttribute('data-app')), '') + '</span>';
            var pinBox = scene.querySelector('.sx-tb-pins');
            pinBox.innerHTML = tbPins.map(function (a) {
                return '<span class="sx-tb-btn' + (removes['windows:' + a.name] ? ' is-gone' : '') + '"><span class="sx-tile-icon">' + demo.appIcon(a, '') + '</span></span>';
            }).join('');

            var steps = [];
            var step = function (id, el, a, b, name) {
                var c = change(id);
                if (!c) return;
                part(el, a, b, name);
                steps.push([c, a]);
            };
            step('theme-mode-windows', desk, .04, .24, '--dk');
            step('taskbar-search-box-11', scene.querySelector('[data-off="taskbar-search-box-11"]'), .22, .32);
            step('taskbar-task-view', scene.querySelector('[data-off="taskbar-task-view"]'), .28, .38);
            step('taskbar-copilot', scene.querySelector('[data-off="taskbar-copilot"]'), .34, .44);
            step('taskbar-widgets', scene.querySelector('[data-off="taskbar-widgets"]'), .4, .5);
            pinBox.querySelectorAll('.is-gone').forEach(function (el, i) { part(el, .44 + i * .04, .52 + i * .04); });
            step('taskbar-alignment', desk, .54, .68, '--al');
            part(menuEl, .66, .74, '--open');
            step('start-recommended-section', scene.querySelector('[data-off="start-recommended-section"]'), .76, .86);
            step('start-all-apps-view', menuEl.querySelector('.sm-allbox'), .86, .96);

            // The newest four changes, each in the app's own words; older ones slide up and out.
            var list = scene.querySelector('.sx-changes');
            list.innerHTML = steps.map(function (st) {
                var s = st[0].setting;
                return '<div class="sx-change">' + (s.icon ? demo.glyph(s.icon) : '<span></span>') + '<b>' + esc(s.name) + '</b><span>' +
                    esc(st[0].from) + ' → <em>' + esc(st[0].to) + '</em></span></div>';
            }).join('');
            var rows = Array.prototype.map.call(list.children, function (row, i) { return part(row, steps[i][1], steps[i][1] + .06); });
            part(list, 0, 1, null, function () {
                var shown = rows.reduce(function (n, r) { return n + r.value; }, 0);
                var step = rows.length ? rows[0].el.offsetHeight + 6 : 0;
                list.style.transform = 'translateY(' + (-Math.max(0, shown - 4) * step).toFixed(1) + 'px)';
                rows.forEach(function (r, i) { r.el.style.visibility = shown - i > 4.9 ? 'hidden' : ''; });
            });
            tally(scene, 'Light mode, a busy taskbar', changedIn('Customize') + ' settings changed');
        },

        // Setup's own screens, then the first-run screens after the restart, each stamped with the answer-file
        // setting that answers it and dealt away. The screens follow a 25H2 install; the answers are an example
        // file's. Which setting skips which screen is the app's answer-file writer: Setup's first screens need the
        // setup language and the Customize region cards, the rest each have their own setting.
        unattend: function (scene, part) {
            var g = demo.glyph, sprite = function (id) { return '<svg class="i"><use href="#i-' + id + '"/></svg>'; };
            var drop = function (v) { return '<span class="sx-pe-drop">' + esc(v) + g('Fluent/ChevronDown') + '</span>'; };
            var field = function (label, v) { return '<div class="sx-pe-field"><span>' + label + '</span>' + drop(v) + '</div>'; };
            var pe = [
                { answer: 'autounattend-setup-language', value: 'English (United States)', title: 'Select language settings',
                    body: field('Language to install', 'English (United States)') + field('Time and currency format', 'English (United States)'), back: false },
                { answer: 'region-keyboard-layout', value: 'US', title: 'Select keyboard settings', body: field('Keyboard or input method', 'US') },
                { answer: 'autounattend-edition', value: 'Windows 11 Pro', title: 'Product key', next: false, link: "I don't have a product key",
                    body: '<p>The product key should be with the box the DVD came in or on your email receipt.<br>It looks similar to this: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX</p>' +
                        '<p style="margin-top:18px">Enter Product key</p><div class="sx-pe-input">Dashes will be added automatically</div>' },
                { answer: 'autounattend-edition', value: 'Windows 11 Pro', title: 'Select Image',
                    body: '<p>Please select the image you want to install.</p><div class="sx-pe-list"><span>Operating System:</span>' +
                        ['Windows 11 Home', 'Windows 11 Home N', 'Windows 11 Home Single Language', 'Windows 11 Education', 'Windows 11 Education N', 'Windows 11 Pro']
                            .map(function (n, i) { return '<span' + (i ? '' : ' class="is-sel"') + '>' + n + '</span>'; }).join('') + '</div>' },
                { answer: 'autounattend-licence-page', value: S.common.off, title: 'Applicable notices and license terms', yes: 'Accept', no: 'Decline',
                    body: '<p>Please read this so you know what you’re agreeing to.</p><div class="sx-pe-legal"><span>MICROSOFT SOFTWARE LICENSE TERMS</span>' +
                        '<span>WINDOWS OPERATING SYSTEM</span><span>IF YOU LIVE IN (OR IF YOUR PRINCIPAL PLACE OF BUSINESS IS IN) THE UNITED STATES, PLEASE READ THE BINDING ARBITRATION CLAUSE…</span></div>' },
                { answer: 'autounattend-disk', value: 'Wipe the disk, UEFI (GPT)', title: 'Select location to install Windows 11',
                    body: '<div class="sx-pe-tools"><span>Refresh</span><span>Load Driver</span><span class="is-off">Bring Disk Online</span>' +
                        '<span class="is-off">Delete Partition</span><span class="is-off">Format Partition</span><span>Create Partition</span></div>' +
                        '<div class="sx-pe-table"><span><b>Name</b><b>Total Size</b><b>Free Space</b><b>Type</b></span>' +
                        '<span class="is-sel"><span>Disk 0 Unallocated Space</span><span>80.0 GB</span><span>80.0 GB</span><span>Unallocated Space</span></span></div>' },
            ];
            var list = function (items) { return '<div class="sx-ob-list">' + items.map(function (n, i) { return '<span' + (i ? '' : ' class="is-sel"') + '>' + n + '</span>'; }).join('') + '</div>'; };
            var ob = [
                { answer: 'region-home-location', value: 'United States', title: 'Is this the right country or region?', yes: 'Yes', back: false,
                    body: list(['United States', 'Afghanistan', 'Åland Islands', 'Albania', 'Algeria', 'American Samoa']) },
                { answer: 'region-keyboard-layout', value: 'US', title: 'Is this the right keyboard layout or input method?', yes: 'Yes',
                    body: '<p>If you also use another keyboard layout, you can add that next.</p>' + list(['US', 'Canadian Multilingual Standard', 'Colemak', 'English (India)', 'Irish']) },
                { answer: 'region-keyboard-layout', value: 'US', title: 'Want to add a second keyboard layout?', yes: 'Skip', no: 'Add layout', body: '' },
                { answer: 'autounattend-network-page', value: S.common.off, title: "Let's connect you to a network", yes: 'Next', off: true, no: "I don't have internet", back: false,
                    body: '<p>You’ll need an internet connection to continue setting up your device. Once connected, you’ll get the latest features and security updates.</p>' +
                        '<div class="sx-ob-net">' + sprite('Desktop') + '<span><b>Ethernet</b>Not connected</span></div><span class="sx-ob-btn">Install driver</span>' },
                { answer: 'autounattend-computer-name', value: 'OFFICE-PC-01', title: 'Name your device', yes: 'Next', off: true, no: 'Skip for now', back: false,
                    body: '<p>Make this device yours with unique names. You can set your PC name so it’s easy to recognize when connecting to it from other devices.</p>' +
                        '<p><b>Your device will restart after you name it.</b></p><div class="sx-ob-input">Name your device</div><p>Can’t contain only numbers</p>' },
                { answer: 'autounattend-accounts', value: '1 local account', title: "Let's set things up for your work or school", yes: 'Next',
                    body: '<p>You’ll use this info to sign in to your devices.</p><div class="sx-ob-ms">Microsoft</div><b style="font-size:16px;color:#222">Sign in</b>' +
                        '<div class="sx-ob-input">someone@example.com</div><p><u>Sign-in options</u></p>' },
                { answer: 'autounattend-privacy', value: 'Turn them all off', title: 'Choose privacy settings for your device', yes: 'Next', no: 'Learn more', back: false,
                    body: '<p>Microsoft puts you in control of your privacy. Choose your settings, then select <b>Accept</b> to save them.</p>' +
                        '<div class="sx-ob-row"><b>Location</b>Get location-based experiences like directions and weather.<i><span class="sx-ob-sw"></span>Yes</i></div>' +
                        '<div class="sx-ob-row"><b>Find my device</b>Turn on Find my device and use your device’s location data.<i><span class="sx-ob-sw"></span>Yes</i></div>' },
            ];

            var stamp = function (q) {
                var s = settings[q.answer];
                return '<span class="sx-q-answer">' + check + '<span>Answered by your file · <b>' + esc(s ? s.name : '') + '</b>: ' + esc(q.value) + '</span></span>';
            };
            var peDeck = scene.querySelector('.sx-deck.is-pe'), obDeck = scene.querySelector('.sx-deck.is-ob');
            peDeck.innerHTML = pe.map(function (q) {
                return '<div class="sx-q sx-pe"><div class="sx-pe-title">Windows 11 Setup<span class="sx-pe-caps"><span>' + g('Fluent/Subtract') + '</span><span>' +
                    g('Fluent/Maximize') + '</span><span>' + g('Fluent/Dismiss') + '</span></span></div><div class="sx-pe-page"><h4>' + esc(q.title) + '</h4>' + q.body + '</div>' +
                    (q.link ? '<span class="sx-pe-link">' + esc(q.link) + '</span>' : '') +
                    '<div class="sx-pe-foot"><u>Support</u><u>Legal</u><b' + (q.back === false ? ' class="is-off"' : '') + '>' + esc(q.no || 'Back') + '</b><i' +
                    (q.next === false ? ' class="is-off"' : '') + '>' + esc(q.yes || 'Next') + '</i></div>' + stamp(q) + '</div>';
            }).join('');
            obDeck.innerHTML = ob.map(function (q) {
                var s = settings[q.answer];
                return '<div class="sx-q sx-ob">' + (q.back === false ? '' : '<span class="sx-ob-back">' + sprite('ChevronLeft') + '</span>') +
                    '<div class="sx-ob-art"><span>' + (s && s.icon ? g(s.icon) : '') + '</span></div><div class="sx-ob-page"><h4>' + esc(q.title) + '</h4>' + q.body + '</div>' +
                    '<div class="sx-ob-foot">' + (q.no ? '<u>' + esc(q.no) + '</u>' : '') + '<b' + (q.off ? ' class="is-off"' : '') + '>' + esc(q.yes) + '</b></div>' + stamp(q) + '</div>';
            }).join('');

            // Each deck deals its cards over its own stretch of the run; the one behind shows through only once the
            // one in front is halfway off.
            var deal = function (deck, from, to) {
                var cards = Array.prototype.slice.call(deck.children), slot = (to - from) / cards.length;
                var leaves = cards.map(function (card, k) {
                    var at = from + k * slot;
                    card.style.zIndex = cards.length - k;
                    part(card, at, at + slot * .45, '--st');
                    return part(card, at + slot * .5, at + slot, null);
                });
                part(deck, 0, 1, null, function () {
                    var gone = 0;
                    leaves.forEach(function (l, k) {
                        var depth = k - gone, out = l.value;
                        gone += out;
                        l.el.style.opacity = (clamp(5 - out * 5) * clamp(3.2 - depth)).toFixed(3);
                        l.el.style.filter = depth > .05 ? 'brightness(' + (1 - Math.min(depth, 3) * .12).toFixed(3) + ')' : '';
                        l.el.style.transform = 'translateY(' + (-depth * 15).toFixed(1) + 'px) scale(' + (1 - depth * .05).toFixed(3) + ') translateX(' +
                            (-out * 120).toFixed(1) + '%) rotate(' + (-out * 7).toFixed(2) + 'deg)';
                    });
                });
            };
            deal(peDeck, .03, .42);
            deal(obDeck, .48, .86);
            var oobe = scene.querySelector('.sx-oobe');
            part(oobe, .41, .47, '--ph');
            part(oobe, .85, .9, '--end');
            part(scene.querySelector('.sx-done'), .88, .96);
            tally(scene, (pe.length + ob.length) + ' setup screens to click through', 'Your file answers them for you');
        },

        // A stock ISO extracted into a working folder, then the answer file and the drivers added where Setup
        // looks for them; then out as an ISO or onto a USB drive, and on to every PC you set up.
        wimutil: function (scene, part) {
            scene.querySelectorAll('[data-str]').forEach(function (el) { el.textContent = S.WimUtil[el.getAttribute('data-str')]; });
            var svg = scene.querySelector('.sx-wires');
            var wires = Array.prototype.map.call(svg.querySelectorAll('path'), function (path) {
                var lit = path.cloneNode();
                lit.setAttribute('pathLength', '1');
                lit.setAttribute('class', 'is-lit');
                svg.appendChild(lit);
                return lit;
            });
            // [card lights, rows land] for each input, in the app's step order.
            var STEPS = { iso: [.04, .12], xml: [.28, .38], drivers: [.48, .58] };
            ['iso', 'xml', 'drivers'].forEach(function (k, i) {
                var at = STEPS[k];
                part(scene.querySelector('[data-src="' + k + '"]'), at[0], at[0] + .08);
                part(wires[i], at[0] + .04, at[1]);
                var rows = scene.querySelectorAll('.sx-tree [data-from="' + k + '"]');
                Array.prototype.forEach.call(rows, function (row, n) { var a = at[1] + .1 * n / rows.length; part(row, a, a + .06); });
            });
            part(wires[3], .66, .74);
            part(wires[4], .66, .74);
            scene.querySelectorAll('.sx-out').forEach(function (out) { part(out, .7, .84, '--fill'); part(out, .84, .9, '--done'); });
            part(scene.querySelector('.sx-fleet'), .84, .9);
            scene.querySelectorAll('.sx-pcs i').forEach(function (pc, n) { var a = .88 + n * .022; part(pc, a, a + .04); });
            tally(scene, 'A stock Windows ISO', 'Your own media, as ' + S.WimUtil.destIso + ' or ' + S.WimUtil.destUsb + ', for every PC you set up');
        },
    };

    // One per area: its scene, its moving parts, and where it is in the run.
    var still = window.matchMedia('(prefers-reduced-motion: reduce)');
    var wide = window.matchMedia('(min-width: 1081px) and (min-height: 640px)');
    var chapters = Array.prototype.map.call(areas.querySelectorAll('.area'), function (area) {
        var scene = area.querySelector('.scene');
        var ch = { area: area, stage: area.querySelector('.area-stage'), scene: scene, fit: scene.querySelector('.scene-fit'), parts: [], p: -1, held: 1 };
        ch.ends = scene.querySelectorAll('.scene-end');
        var part = function (el, a, b, name, draw) {
            var pt = { el: el, a: a, b: b, name: name === null ? null : name || '--e', draw: draw, value: -1 };
            ch.parts.push(pt);
            return pt;
        };
        demo.paint(scene);
        builders[scene.getAttribute('data-scene')](scene, part);
        ch.ends[0].addEventListener('click', function () { if (still.matches) { ch.held = 0; frame(); } });
        ch.ends[1].addEventListener('click', function () { if (still.matches) { ch.held = 1; frame(); } });
        return ch;
    });

    var draw = function (ch, p) {
        if (p === ch.p) return;
        ch.p = p;
        ch.scene.style.setProperty('--p', p.toFixed(4));
        ch.ends[0].classList.toggle('is-lit', p < .5);
        ch.ends[1].classList.toggle('is-lit', p >= .5);
        ch.parts.forEach(function (pt) {
            var v = Math.round(ease(clamp((p - pt.a) / (pt.b - pt.a))) * 1000) / 1000;
            if (v === pt.value) return;
            pt.value = v;
            if (pt.name) pt.el.style.setProperty(pt.name, v);
        });
        ch.parts.forEach(function (pt) { if (pt.draw) pt.draw(); });
    };

    var ticking = false;
    var frame = function () {
        ticking = false;
        var vh = window.innerHeight, pinned = areas.classList.contains('is-pinned');
        chapters.forEach(function (ch) {
            if (still.matches) { ch.scene.classList.add('is-still'); draw(ch, ch.held); return; }
            ch.scene.classList.remove('is-still');
            var r = ch.area.getBoundingClientRect();
            if (pinned) {
                // From the moment the stage sticks, over most of the chapter's extra height; the rest holds the end.
                var run = ch.area.offsetHeight - ch.stage.offsetHeight;
                draw(ch, clamp((ch.stage.getBoundingClientRect().top - r.top) / (run * .82)));
                ch.area.style.setProperty('--in', clamp((vh - r.top) / (vh * .55)).toFixed(3));
            } else {
                var s = ch.scene.getBoundingClientRect();
                draw(ch, clamp((vh * .85 - s.top) / (vh * .7)));
            }
        });
    };
    var request = function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
    var mode = function () {
        areas.classList.toggle('is-pinned', wide.matches && !still.matches);
        chapters.forEach(function (ch) { ch.area.style.removeProperty('--in'); ch.p = -1; });
        frame();
    };
    var fit = function () {
        chapters.forEach(function (ch) { ch.fit.style.setProperty('--s', (ch.fit.clientWidth / 800).toFixed(4)); });
    };
    [still, wide].forEach(function (q) { if (q.addEventListener) q.addEventListener('change', mode); else q.addListener(mode); });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(areas);
    else window.addEventListener('resize', fit);
    fit();
    mode();
})();
