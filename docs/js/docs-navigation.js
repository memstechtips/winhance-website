document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.docs-sidebar');

    // Restore sidebar scroll position from sessionStorage
    const savedScrollPos = sessionStorage.getItem('sidebarScrollPos');
    if (savedScrollPos && sidebar) {
        sidebar.scrollTop = parseInt(savedScrollPos, 10);
    }

    // Save scroll position before page unload
    window.addEventListener('beforeunload', () => {
        if (sidebar) {
            sessionStorage.setItem('sidebarScrollPos', sidebar.scrollTop.toString());
        }
    });

    // Also save on link click for more reliable saving
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            if (e.target.closest('.sidebar-nav-item')) {
                sessionStorage.setItem('sidebarScrollPos', sidebar.scrollTop.toString());
            }
        });
    }

    // Sidebar toggle for mobile
    const sidebarToggle = document.querySelector('.sidebar-toggle');

    if (sidebarToggle && sidebar) {
        // Move toggle to header on load if it exists elsewhere
        const headerContainer = document.querySelector('.header-container');
        if (headerContainer && !headerContainer.contains(sidebarToggle)) {
            headerContainer.prepend(sidebarToggle);
        }

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        // Close sidebar when clicking a link on mobile
        const sidebarLinks = sidebar.querySelectorAll('.sidebar-nav-item');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('active');
                }
            });
        });
    }

    // Set active class based on current path
    const currentPath = window.location.pathname;
    const sidebarLinks = document.querySelectorAll('.sidebar-nav-item');

    // Normalize a path by extracting the meaningful part (everything after /docs/)
    function normalizePath(path) {
        // Remove query strings and hashes
        let cleaned = path.split('?')[0].split('#')[0];

        // Find the /docs/ part and get everything after it
        const docsIndex = cleaned.indexOf('/docs/');
        if (docsIndex !== -1) {
            cleaned = cleaned.substring(docsIndex + 6); // +6 for '/docs/'
        }

        // Remove leading ../ and ./ from relative paths
        cleaned = cleaned.replace(/^(\.\.\/)+/g, '').replace(/^\.\//g, '');

        // Remove leading slash if present
        cleaned = cleaned.replace(/^\//, '');

        return cleaned.toLowerCase();
    }

    const normalizedCurrentPath = normalizePath(currentPath);

    sidebarLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (!linkHref || linkHref === '#') return;

        const normalizedLinkPath = normalizePath(linkHref);

        // Check if paths match
        if (normalizedCurrentPath === normalizedLinkPath ||
            normalizedCurrentPath.endsWith(normalizedLinkPath) ||
            normalizedLinkPath.endsWith(normalizedCurrentPath)) {
            link.classList.add('active');

            // Scroll the active item into view within the sidebar
            // Only do this if there's no saved scroll position
            if (!savedScrollPos && sidebar) {
                setTimeout(() => {
                    const linkRect = link.getBoundingClientRect();
                    const sidebarRect = sidebar.getBoundingClientRect();
                    const linkTop = linkRect.top - sidebarRect.top + sidebar.scrollTop;
                    const targetScroll = linkTop - (sidebarRect.height / 2) + (linkRect.height / 2);
                    sidebar.scrollTop = Math.max(0, targetScroll);
                }, 50);
            }
        } else {
            link.classList.remove('active');
        }
    });

    // Special case for docs index
    if (currentPath.endsWith('docs/') || currentPath.endsWith('docs/index.html')) {
        // The overview link would be handled by the matching above if it exists
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Copy code functionality
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach(block => {
        // Don't add copy button if one already exists
        if (block.querySelector('.copy-code-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'copy-code-btn';
        btn.innerHTML = 'Copy';
        block.appendChild(btn);

        btn.addEventListener('click', () => {
            const code = block.querySelector('code')?.innerText || block.innerText;
            navigator.clipboard.writeText(code).then(() => {
                btn.innerText = 'Copied!';
                setTimeout(() => {
                    btn.innerText = 'Copy';
                }, 2000);
            });
        });
    });
});
