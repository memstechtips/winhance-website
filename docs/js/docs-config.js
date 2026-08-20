/**
 * Winhance Documentation Configuration
 * Central place to define documentation settings
 */
// @generated:start docs-gen
const DocsConfig = {
    version: 'Docs v26.08.20',
    lastUpdated: 'Aug 20, 2026',
    winhanceVersion: 'v26.08.20',
    githubReleasesUrl: 'https://github.com/memstechtips/Winhance/releases'
};
// @generated:end docs-gen

// Apply version to footer on page load
document.addEventListener('DOMContentLoaded', () => {
    // Update version display
    const versionElements = document.querySelectorAll('.docs-version');
    versionElements.forEach(el => {
        el.textContent = DocsConfig.version;
    });

    // Update last updated display
    const lastUpdatedElements = document.querySelectorAll('.docs-last-updated');
    lastUpdatedElements.forEach(el => {
        el.textContent = `Last Updated: ${DocsConfig.lastUpdated}`;
    });
});
