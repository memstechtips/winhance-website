document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'dark';
    htmlElement.setAttribute('data-theme', savedTheme);
    updateToggleIcon(savedTheme);
    updateLogo(savedTheme);
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateToggleIcon(newTheme);
            updateLogo(newTheme);
        });
    }
});

function updateLogo(theme) {
    const logoImg = document.querySelector('.logo img');
    if (!logoImg) return;
    
    const currentSrc = logoImg.getAttribute('src');
    if (!currentSrc) return;

    if (theme === 'light') {
        if (currentSrc.includes('winhance-rocket.png')) {
            logoImg.setAttribute('src', currentSrc.replace('winhance-rocket.png', 'winhance-rocket-black.png'));
        }
    } else {
        if (currentSrc.includes('winhance-rocket-black.png')) {
            logoImg.setAttribute('src', currentSrc.replace('winhance-rocket-black.png', 'winhance-rocket.png'));
        }
    }
}

function updateToggleIcon(theme) {
    const toggleIcon = document.querySelector('#theme-toggle svg');
    if (!toggleIcon) return;
    
    if (theme === 'dark') {
        // Sun icon for dark mode (to switch to light)
        toggleIcon.innerHTML = `
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        `;
    } else {
        // Moon icon for light mode (to switch to dark)
        toggleIcon.innerHTML = `
            <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        `;
    }
}
