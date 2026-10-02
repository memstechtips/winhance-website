(function () {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    // The docs sidebar stays folded away if it was folded on the last page.
    try { if (localStorage.getItem('docsNav') === 'collapsed') document.documentElement.classList.add('docs-nav-collapsed'); } catch (e) { /* storage blocked */ }
})();
