// winhance.net docs: the theme switch (shared with the landing page through localStorage 'theme'), the nav
// drawer on small screens, "On this page" following the reader, copy buttons on code, links on headings,
// and / to search. The sidebar's current page is marked when the page is generated, so it needs no script.
(function () {
    var root = document.documentElement;

    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) { /* private mode: theme just won't stick */ }
        });
    }

    // The download button's rocket dives out of it on click, as on the landing page.
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

    // The menu button folds the sidebar away on a wide screen, remembered across pages (theme-load.js applies
    // it before the first paint), and opens it as a drawer below 960px. The nav keeps its scroll position
    // between pages, so the list doesn't jump.
    var menu = document.querySelector('.docs-menu');
    var nav = document.getElementById('docs-nav');
    var narrow = window.matchMedia('(max-width: 960px)');
    var setOpen = function (open) {
        document.body.classList.toggle('docs-nav-open', open);
        if (menu) menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    var syncWide = function () {
        if (menu && !narrow.matches) menu.setAttribute('aria-expanded', root.classList.contains('docs-nav-collapsed') ? 'false' : 'true');
    };
    if (menu) {
        menu.addEventListener('click', function () {
            if (narrow.matches) return setOpen(!document.body.classList.contains('docs-nav-open'));
            var collapsed = root.classList.toggle('docs-nav-collapsed');
            try { localStorage.setItem('docsNav', collapsed ? 'collapsed' : 'open'); } catch (e) { /* not remembered */ }
            syncWide();
        });
        narrow.addEventListener('change', function () { setOpen(false); syncWide(); });
        syncWide();
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && narrow.matches) setOpen(false); });
    document.addEventListener('click', function (e) {
        if (document.body.classList.contains('docs-nav-open') && !nav.contains(e.target) && !menu.contains(e.target)) setOpen(false);
    });
    if (nav) {
        try {
            var saved = sessionStorage.getItem('docsNavScroll');
            if (saved) nav.scrollTop = Number(saved);
            else {
                var here = nav.querySelector('[aria-current="page"]');
                if (here) nav.scrollTop = here.offsetTop - nav.clientHeight / 2;
            }
            window.addEventListener('pagehide', function () { sessionStorage.setItem('docsNavScroll', String(nav.scrollTop)); });
        } catch (e) { /* storage blocked: the nav starts at the top */ }
    }

    var content = document.querySelector('.docs-content');
    if (!content) return;

    // A link on every section heading, for sharing a spot on the page.
    content.querySelectorAll('h2[id], h3[id]').forEach(function (h) {
        var a = document.createElement('a');
        a.className = 'anchor';
        a.href = '#' + h.id;
        a.setAttribute('aria-label', 'Link to this section');
        a.textContent = '#';
        h.appendChild(a);
    });

    // Copy buttons on code blocks (not inside the setting cards, which mirror the app's own panel).
    content.querySelectorAll('pre').forEach(function (pre) {
        if (pre.closest('.setting-card') || !navigator.clipboard) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'copy-code-btn';
        btn.textContent = 'Copy';
        btn.addEventListener('click', function () {
            var code = pre.querySelector('code') || pre;
            navigator.clipboard.writeText(code.innerText.replace(/\n$/, '')).then(function () {
                btn.textContent = 'Copied';
                setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
            });
        });
        pre.appendChild(btn);
    });

    // "On this page" marks the section you are reading: the last heading above the top third of the window.
    var links = Array.prototype.slice.call(document.querySelectorAll('.docs-toc a'));
    if (links.length) {
        var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
        var ticking = false;
        var mark = function () {
            ticking = false;
            var line = window.innerHeight / 3, current = 0;
            heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top < line) current = i; });
            links.forEach(function (a, i) { a.classList.toggle('is-active', i === current); });
        };
        window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(mark); } }, { passive: true });
        mark();
    }

    // "/" jumps to search, as on most docs sites.
    var search = document.getElementById('docs-search');
    document.addEventListener('keydown', function (e) {
        if (e.key !== '/' || !search || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
        e.preventDefault();
        search.focus();
    });
})();
