/**
 * Winhance Documentation Configuration
 * Central place to define documentation settings
 */
const DocsConfig = {
    version: 'Docs v1.0.0',
    lastUpdated: 'Jan 27, 2026',
    winhanceVersion: 'v26.01.26', // Current Winhance app version from csproj
    githubReleasesUrl: 'https://github.com/memstechtips/Winhance/releases'
};

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
