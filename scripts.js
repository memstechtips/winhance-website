// winhance.net landing page: theme switch, the PowerShell copy button, live GitHub numbers, the
// readout under the demo window, and the sponsor cards.

(function () {
    var root = document.documentElement;
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) { /* private mode: theme just won't stick */ }
    });
})();

(function () {
    var button = document.getElementById('copy-powershell-btn');
    var code = document.getElementById('powershell-code');
    if (!button || !code) return;

    function copied() {
        button.classList.add('is-done');
        button.setAttribute('aria-label', 'Copied');
        setTimeout(function () {
            button.classList.remove('is-done');
            button.setAttribute('aria-label', 'Copy the command');
        }, 2000);
    }

    function fallback(text) {
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { if (document.execCommand('copy')) copied(); } catch (e) { /* nothing left to try */ }
        document.body.removeChild(area);
    }

    button.addEventListener('click', function () {
        var text = code.textContent;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(copied, function () { fallback(text); });
        } else {
            fallback(text);
        }
    });
})();

// The stats workflow rewrites these numbers into the HTML every six hours; this refreshes them live
// when the GitHub API allows it, and leaves the baked-in values alone when it doesn't.
(function () {
    var api = 'https://api.github.com/repos/memstechtips/Winhance';

    function short(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M+';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k+';
        return String(n);
    }

    function get(url) {
        return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }

    get(api).then(function (repo) {
        var el = document.querySelector('.github-stars-badge .text');
        if (el && repo.stargazers_count) el.textContent = short(repo.stargazers_count) + ' GitHub Stars';
    }).catch(function () {});

    get(api + '/releases/latest').then(function (release) {
        if (!release.tag_name) return;
        document.querySelectorAll('.version-number').forEach(function (el) { el.textContent = release.tag_name; });
        document.querySelectorAll('.footer-version').forEach(function (el) { el.textContent = 'Version ' + release.tag_name; });
    }).catch(function () {});

    get(api + '/releases?per_page=100').then(function (releases) {
        var total = 0;
        releases.forEach(function (r) { (r.assets || []).forEach(function (a) { total += a.download_count; }); });
        var el = document.querySelector('.download-count');
        // One page of releases undercounts once there are more than 100; only ever move the number up.
        if (el && total && parseFloat(el.textContent) <= parseFloat(short(total))) el.textContent = short(total);
    }).catch(function () {});
})();

// The "Open it" buttons in each chapter open that page in the window above.
(function () {
    var stage = document.getElementById('winhance-demo');
    if (!stage) return;

    document.querySelectorAll('[data-open]').forEach(function (button) {
        button.addEventListener('click', function () {
            if (!window.WinhanceDemo) return;
            window.WinhanceDemo.open(button.getAttribute('data-open'));
            stage.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        });
    });
})();

// A download click sends the button's rocket diving out of it; the browser handles the download itself.
document.querySelectorAll('.dl-rocket').forEach(function (rocket) {
    var done = 0;
    rocket.closest('a').addEventListener('click', function () {
        rocket.classList.remove('is-launching');
        void rocket.offsetWidth;
        rocket.classList.add('is-launching');
        clearTimeout(done);
        done = setTimeout(function () { rocket.classList.remove('is-launching'); }, 950);
    });
});

/* ===== Flight path =====
   Down the left edge, the rocket rides a line from the sponsors to the finale: nose down while you scroll
   down, nose up when you scroll back. */
(function () {
    var flight = document.querySelector('.flight');
    var from = document.querySelector('#sponsors h2');
    var to = document.querySelector('.finale');
    if (!flight || !from || !to) return;
    var main = flight.parentElement;
    var svg = flight.querySelector('.flight-path');
    var track = flight.querySelector('.flight-track');
    var fill = flight.querySelector('.flight-fill');
    var heads = Array.prototype.filter.call(main.querySelectorAll('section h2'), function (h) { return !to.contains(h); });
    var nodes = heads.map(function () {
        var node = document.createElement('span');
        node.className = 'flight-node';
        flight.appendChild(node);
        return node;
    });
    var top = 0, total = 0, samples = [], stops = [], blocks = [];
    var lastY = window.scrollY, turn = 135, still = 0, ticking = false;
    // The solid things the line passes under; the rocket fades over them. A pinned area's copy and scene
    // move as they stick, so they are checked where they are now instead.
    var PANELS = '.mode, .sponsors-panel, .press-list a, .newpc, .open-points, .voice-list li, .faq-list';
    var stuck = main.querySelectorAll('.area-copy, .scene');
    var inBlock = function (x, y, pad) {
        return blocks.some(function (b) { return x > b[0] - pad && x < b[0] + b[2] + pad && y > b[1] - pad && y < b[1] + b[3] + pad; });
    };
    flight.classList.add('is-on');

    // The line swings between the side margins, turning beside each section heading. Each bend leaves and
    // meets its turn vertically, so the curve is smooth all the way: no corners.
    var measure = function () {
        var base = main.getBoundingClientRect().top + window.scrollY;
        var mainBox = main.getBoundingClientRect();
        var width = main.clientWidth;
        var wrap = Math.min(width, 1200);
        var left = Math.max(24, (width - wrap) / 2 + 4), right = width - left;
        top = from.getBoundingClientRect().top + window.scrollY - base;
        var height = to.getBoundingClientRect().top + window.scrollY - base + 56 - top;

        var add = function (r) {
            if (r.width && r.height) blocks.push([r.left - mainBox.left - 8, r.top + window.scrollY - base - top - 8, r.width + 16, r.height + 16]);
        };
        blocks = [];
        main.querySelectorAll(PANELS).forEach(function (el) { add(el.getBoundingClientRect()); });

        // From the first heading (on the left) to the finale's top edge, landing on the left.
        var points = heads.map(function (h, i) {
            return [i % 2 ? right : left, h.getBoundingClientRect().top + window.scrollY - base - top + 18];
        });
        points.push([left, height]);
        // Walked from the curve's own formula (getPointAtLength is far too slow to call thousands of times):
        // samples: [length so far, x, y, direction]. Height only grows along the curve, so a height finds
        // its sample. The path is drawn through the same samples, so its length is the walked total.
        var d = 'M' + points[0][0].toFixed(1) + ' ' + points[0][1].toFixed(1);
        samples = [[0, points[0][0], points[0][1], 90]];
        total = 0;
        for (var i = 1; i < points.length; i++) {
            var a = points[i - 1], b = points[i], bend = (b[1] - a[1]) / 2;
            var c1 = [a[0], a[1] + bend], c2 = [b[0], b[1] - bend];
            for (var k = 1; k <= 96; k++) {
                var t = k / 96, u = 1 - t;
                var x = u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0];
                var y = u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1];
                var dx = 3 * u * u * (c1[0] - a[0]) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (b[0] - c2[0]);
                var dy = 3 * u * u * (c1[1] - a[1]) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (b[1] - c2[1]);
                var prev = samples[samples.length - 1];
                var step = Math.hypot(x - prev[1], y - prev[2]);
                d += 'L' + x.toFixed(1) + ' ' + y.toFixed(1);
                total += step;
                samples.push([total, x, y, Math.atan2(dy, dx) * 180 / Math.PI]);
            }
        }
        flight.style.top = top + 'px';
        flight.style.height = height + 'px';
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        track.setAttribute('d', d);
        fill.setAttribute('d', d);
        fill.style.strokeDasharray = total + ' ' + total;
        stops = points.slice(0, -1).map(function (p, i) {
            nodes[i].style.left = p[0] + 'px';
            nodes[i].style.top = p[1] + 'px';
            nodes[i].classList.toggle('is-under', inBlock(p[0], p[1], 0));
            return p[1];
        });
        update();
    };
    var sampleAt = function (y) {
        var lo = 0, hi = samples.length - 1;
        while (lo < hi) {
            var mid = (lo + hi) >> 1;
            if (samples[mid][2] < y) lo = mid + 1; else hi = mid;
        }
        return lo;
    };
    var update = function () {
        ticking = false;
        if (!total) return;
        var base = main.getBoundingClientRect().top + window.scrollY;
        var y = window.scrollY + window.innerHeight * .5 - base - top;
        var index = sampleAt(y), at = samples[index], l = at[0];
        fill.style.strokeDashoffset = total - l;
        flight.style.setProperty('--flight-x', at[1] + 'px');
        flight.style.setProperty('--flight-y', at[2] + 'px');
        stops.forEach(function (sy, i) { nodes[i].classList.toggle('is-passed', sy <= at[2] + 1); });
        flight.classList.toggle('is-landed', l >= total);
        var over = inBlock(at[1], at[2], 16);
        var mb = main.getBoundingClientRect(), rx = at[1] + mb.left, ry = at[2] + top + mb.top;
        // Over a scene it hides outright: a faint rocket reads as part of the picture.
        var hidden = false;
        for (var i = 0; i < stuck.length; i++) {
            var sr = stuck[i].getBoundingClientRect();
            if (rx > sr.left - 16 && rx < sr.right + 16 && ry > sr.top - 16 && ry < sr.bottom + 16) {
                if (stuck[i].classList.contains('scene')) hidden = true; else over = true;
            }
        }
        flight.classList.toggle('is-over', over);
        flight.classList.toggle('is-hidden', hidden);
        // Nose along the curve, reversed while scrolling back up. The artwork points up and right (-45deg).
        var dy = window.scrollY - lastY;
        lastY = window.scrollY;
        var heading = at[3] + 45 + (dy < 0 ? 180 : 0);
        if (dy || !flight.style.getPropertyValue('--flight-turn')) {
            // Unwrapped against the last angle, so the turn takes the short way round.
            turn += ((heading - turn) % 360 + 540) % 360 - 180;
            flight.style.setProperty('--flight-turn', turn + 'deg');
        }
    };
    window.addEventListener('scroll', function () {
        flight.classList.add('is-moving');
        clearTimeout(still);
        still = setTimeout(function () { flight.classList.remove('is-moving'); }, 160);
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    // Fonts, sponsor cards and the demo change the page's height after load; one rebuild per frame.
    var queued = false;
    var remeasure = function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; measure(); });
    };
    window.addEventListener('resize', remeasure);
    if (window.ResizeObserver) new ResizeObserver(remeasure).observe(main);
    measure();
})();

/* ===== Sponsors showcase =====
   Renders the silver-and-up business sponsors (top 5, emerald first) on the
   download page, using the SAME card markup as the store wall (app.js on
   store.memstechtips.com is the reference). Data comes from the Winhance
   repo's `sponsors` branch; names/cities render as TEXT, never HTML. */
(function () {
    var wall = document.getElementById('sponsorsGrid');
    if (!wall || !window.fetch) return;

    var RAW_BASE = 'https://raw.githubusercontent.com/memstechtips/Winhance/sponsors/sponsors/';
    var TIER_RANK = { emerald: 0, gold: 1, silver: 2 }; // bronze is store-wall-only

    fetch(RAW_BASE + 'sponsors.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
            var sponsors = (data && Array.isArray(data.sponsors) ? data.sponsors : [])
                .filter(function (s) {
                    return s && TIER_RANK[s.tier] !== undefined && !s.until;
                })
                .sort(function (a, b) { return TIER_RANK[a.tier] - TIER_RANK[b.tier]; })
                .slice(0, 5);
            if (!sponsors.length) return;

            sponsors.forEach(function (s) {
                var el = document.createElement('div');
                el.className = 'scard scard-' + s.tier;

                var t = document.createElement('div');
                t.className = 'scard-tier';
                t.textContent = s.tier;
                el.appendChild(t);

                if (s.logo) {
                    var img = document.createElement('img');
                    img.className = 'scard-img';
                    img.src = RAW_BASE + s.logo;
                    img.alt = '';
                    img.loading = 'lazy';
                    el.appendChild(img);
                } else {
                    var lg = document.createElement('div');
                    lg.className = 'scard-logo';
                    lg.textContent = String(s.name || '?').charAt(0).toUpperCase();
                    el.appendChild(lg);
                }

                var nm = document.createElement('div');
                nm.className = 'scard-name';
                nm.textContent = String(s.name || '').slice(0, 60);
                el.appendChild(nm);

                // Slogan is a gold-and-up perk.
                if (s.slogan && (s.tier === 'gold' || s.tier === 'emerald')) {
                    var sg = document.createElement('div');
                    sg.className = 'scard-slogan';
                    sg.textContent = String(s.slogan).slice(0, 80);
                    el.appendChild(sg);
                }

                if (s.city) {
                    var c = document.createElement('div');
                    c.className = 'scard-meta';
                    c.textContent = String(s.city).slice(0, 60);
                    el.appendChild(c);
                }

                // Clickable website link is a gold-and-up perk.
                if (s.url && (s.tier === 'gold' || s.tier === 'emerald')) {
                    try {
                        var u = new URL(s.url);
                        if (u.protocol === 'https:' || u.protocol === 'http:') {
                            var a = document.createElement('a');
                            a.className = 'scard-url';
                            a.href = u.href;
                            a.target = '_blank';
                            a.rel = 'noopener nofollow';
                            a.textContent = u.hostname.replace(/^www\./, '');
                            el.appendChild(a);
                        }
                    } catch (e) { /* bad URL in data — skip the link */ }
                }

                wall.appendChild(el);
            });
            wall.hidden = false;
        })
        .catch(function () { /* heading + CTAs stay, no cards */ });
})();
