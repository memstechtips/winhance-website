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
    var tally = function (scene, before, after) {
        scene.querySelector('[data-tally="before"]').textContent = before;
        scene.querySelector('[data-tally="after"]').textContent = after;
    };

    var builders = {
        // A Start menu holding what a fresh install has, emptied of what the recommended set removes, then
        // closed up and filled with the programs it installs.
        apps: function (scene, part) {
            var COLS = 8, SLOTS = 32;
            var removes = {};
            review.apps.forEach(function (k) { removes[k] = true; });
            var shipped = app.apps.windows.filter(onStart).slice(0, SLOTS);
            var kept = shipped.filter(function (a) { return !removes['windows:' + a.name]; });
            var gone = shipped.filter(function (a) { return removes['windows:' + a.name]; });
            var added = review.apps.filter(function (k) { return k.indexOf('external:') === 0; }).map(function (k) {
                return app.apps.external.filter(function (a) { return a.name === k.slice(9); })[0];
            }).filter(Boolean).slice(0, SLOTS - kept.length);

            var grid = scene.querySelector('.sx-grid');
            var tile = function (a, cls, from, to) {
                return '<div class="sx-tile ' + cls + '" style="--x0:' + from % COLS + ';--y0:' + Math.floor(from / COLS) +
                    ';--x1:' + to % COLS + ';--y1:' + Math.floor(to / COLS) + '"><span class="sx-tile-icon">' + demo.appIcon(a, '') +
                    '</span><span>' + esc(a.name) + '</span></div>';
            };
            var html = shipped.map(function (a, i) {
                var k = kept.indexOf(a);
                return tile(a, k < 0 ? 'is-gone' : 'is-kept', i, k < 0 ? i : k);
            }).join('') + added.map(function (a, i) { return tile(a, 'is-new', kept.length + i, kept.length + i); }).join('');
            grid.innerHTML = html;
            var tiles = grid.children, g = 0, n = 0;
            for (var i = 0; i < shipped.length; i++) {
                if (tiles[i].classList.contains('is-gone')) { var a0 = .06 + .34 * g++ / gone.length; part(tiles[i], a0, a0 + .1); }
                else part(tiles[i], .46, .6);
            }
            for (; i < tiles.length; i++) { var a1 = .6 + .28 * n++ / added.length; part(tiles[i], a1, a1 + .1); }
            tally(scene, shipped.length + ' apps preinstalled', gone.length + ' removed, ' + added.length + ' programs installed');
        },

        // Settings > Privacy & security, its switches turned off one after another.
        optimize: function (scene, part) {
            var IDS = ['privacy-language-list', 'privacy-app-launch-tracking', 'privacy-settings-content', 'privacy-tailored-experiences',
                'privacy-activity-history', 'privacy-search-highlights', 'privacy-feedback-frequency', 'privacy-disable-copilot-nudges'];
            var rows = IDS.map(change).filter(function (c) { return c && c.from === S.common.on && c.to === S.common.off; }).slice(0, 6);
            var box = scene.querySelector('.sx-rows');
            box.innerHTML = rows.map(function (c) {
                var s = c.setting;
                return '<div class="sx-row">' + (s.icon ? demo.glyph(s.icon) : '<span></span>') +
                    '<span class="sx-row-text"><b>' + esc(s.name) + '</b><span>' + esc(s.description) + '</span></span>' +
                    '<span class="sx-switch"><span class="sx-state"><span>' + esc(c.from) + '</span><span>' + esc(c.to) + '</span></span><span class="sx-toggle"></span></span></div>';
            }).join('');
            Array.prototype.forEach.call(box.children, function (row, i) { var a = .1 + .62 * i / rows.length; part(row, a, a + .1); });
            tally(scene, 'Ads, tracking and suggestions on', changedIn('Optimize') + ' settings changed');
        },

        // A light desktop that turns dark while the taskbar sheds what the recommended set hides and moves left.
        customize: function (scene, part) {
            var desk = scene.querySelector('.sx-desk');
            var byName = function (list, name) { return list.filter(function (a) { return a.name === name; })[0]; };
            var removes = {};
            review.apps.forEach(function (k) { removes[k] = true; });
            var kept = app.apps.windows.filter(function (a) { return onStart(a) && !removes['windows:' + a.name] && a.icon !== undefined; }).slice(0, 6);
            scene.querySelector('.sx-pins').innerHTML = kept.map(function (a) {
                return '<span><span class="sx-tile-icon">' + demo.appIcon(a, '') + '</span><span>' + esc(a.name) + '</span></span>';
            }).join('');
            // The taskbar a fresh install pins; an app the recommended set removes takes its pin with it.
            var pins = ['Microsoft Edge', 'Microsoft Store', 'Outlook for Windows'].map(function (n) { return byName(app.apps.windows, n); }).filter(Boolean);
            var pinBox = scene.querySelector('.sx-tb-pins');
            pinBox.innerHTML = pins.map(function (a) {
                return '<span class="sx-tb-btn' + (removes['windows:' + a.name] ? ' is-gone' : '') + '"><span class="sx-tile-icon">' + demo.appIcon(a, '') + '</span></span>';
            }).join('');

            var steps = [];
            var step = function (id, el, a, b, name) {
                var c = change(id);
                if (!c) return;
                part(el, a, b, name);
                steps.push([c, a]);
            };
            step('theme-mode-windows', desk, .06, .3, '--dk');
            step('taskbar-search-box-11', scene.querySelector('[data-off="taskbar-search-box-11"]'), .26, .38);
            step('taskbar-task-view', scene.querySelector('[data-off="taskbar-task-view"]'), .32, .44);
            step('taskbar-copilot', scene.querySelector('[data-off="taskbar-copilot"]'), .38, .5);
            step('taskbar-widgets', scene.querySelector('[data-off="taskbar-widgets"]'), .44, .56);
            step('start-recommended-section', scene.querySelector('[data-off="start-recommended-section"]'), .5, .64);
            step('taskbar-alignment', desk, .62, .8, '--al');
            pinBox.querySelectorAll('.is-gone').forEach(function (el, i) { part(el, .72 + i * .04, .82 + i * .04); });

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

        // The setup questions, each stamped with the answer-file setting that answers it and dealt away.
        unattend: function (scene, part) {
            var cards = Array.prototype.slice.call(scene.querySelectorAll('.sx-q')).reverse();
            var slot = .8 / cards.length;
            var leaves = cards.map(function (card, k) {
                var s = settings[card.getAttribute('data-answer')];
                var value = s && s.windowsDefault.length ? ': ' + s.options[s.windowsDefault[0]] : '';
                card.querySelector('.sx-q-body').insertAdjacentHTML('beforeend',
                    '<span class="sx-q-answer">' + check + '<span>Answered by your file · <b>' + esc(s ? s.name : '') + '</b>' + esc(value) + '</span></span>');
                var at = .04 + k * slot;
                part(card, at, at + slot * .45, '--st');
                return part(card, at + slot * .5, at + slot, null);
            });
            part(scene.querySelector('.sx-done'), .84, .96);
            part(scene.querySelector('.sx-deck'), 0, 1, null, function () {
                var gone = 0;
                leaves.forEach(function (l, k) {
                    var depth = k - gone, out = l.value;
                    gone += out;
                    // Solid until it is halfway off, so the card behind never shows through.
                    l.el.style.opacity = (clamp(2 - out * 2) * clamp(3.2 - depth)).toFixed(3);
                    l.el.style.filter = depth > .05 ? 'brightness(' + (1 - Math.min(depth, 3) * .18).toFixed(3) + ')' : '';
                    l.el.style.transform = 'translateY(' + (-depth * 15).toFixed(1) + 'px) scale(' + (1 - depth * .05).toFixed(3) + ') translateX(' +
                        (-out * 115).toFixed(1) + '%) rotate(' + (-out * 7).toFixed(2) + 'deg)';
                });
            });
            tally(scene, cards.length + ' setup screens to click through', 'Setup answers them for you');
        },

        // The ISO, the answer file and this PC's drivers, written to one drive.
        wimutil: function (scene, part) {
            scene.querySelectorAll('[data-str]').forEach(function (el) {
                var t = S.WimUtil[el.getAttribute('data-str')];
                (el.querySelector('span') || el).textContent = t;
            });
            var svg = scene.querySelector('.sx-wires');
            var srcs = scene.querySelectorAll('.sx-src');
            Array.prototype.forEach.call(svg.querySelectorAll('path'), function (path, k) {
                var lit = path.cloneNode();
                lit.setAttribute('pathLength', '1');
                lit.setAttribute('class', 'is-lit');
                svg.appendChild(lit);
                var a = .06 + k * .22;
                part(srcs[k], a, a + .12);
                part(lit, a + .04, a + .22);
            });
            var usb = scene.querySelector('.sx-usb');
            part(usb, .1, .84, '--fill');
            part(usb, .84, .94, '--done');
            tally(scene, 'A stock Windows ISO', 'Your file and drivers on ' + S.WimUtil.destIso + ' or ' + S.WimUtil.destUsb);
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
