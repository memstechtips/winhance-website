document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('docs-search');
    const searchContainer = document.querySelector('.search-container');
    if (!searchInput || !searchContainer) return;

    // Create search results dropdown
    const resultsDropdown = document.createElement('div');
    resultsDropdown.className = 'search-results-dropdown';
    searchContainer.appendChild(resultsDropdown);

    // Determine path prefix based on current location depth
    const pathname = window.location.pathname;
    const docsIndex = pathname.indexOf('/docs/');
    let pathPrefix = './';

    if (docsIndex !== -1) {
        const afterDocs = pathname.substring(docsIndex + 6);
        const depth = (afterDocs.match(/\//g) || []).length;
        if (depth === 0) {
            pathPrefix = './';
        } else if (depth === 1) {
            pathPrefix = '../';
        } else if (depth >= 2) {
            pathPrefix = '../../';
        }
    }

    // Comprehensive search index with page content, sections, and keywords
    const searchIndex = [
        // Overview
        {
            title: 'Overview',
            url: 'index.html',
            category: 'General',
            sections: ['Welcome', 'Getting Started', 'Features Overview'],
            keywords: ['home', 'introduction', 'documentation', 'winhance', 'windows', 'optimization', 'customization', 'debloat'],
            content: 'Winhance documentation home page. Learn about Windows optimization, customization, debloating, and system tweaks.'
        },
        // Getting Started
        {
            title: 'Installation',
            url: 'getting-started/installation.html',
            category: 'Getting Started',
            sections: ['Download', 'Install', 'First Run', 'Updates'],
            keywords: ['install', 'download', 'setup', 'run', 'powershell', 'irm', 'iex', 'github', 'releases', 'update', 'portable'],
            content: 'How to install Winhance. Download from GitHub releases or use PowerShell one-liner. Portable installation options.'
        },
        {
            title: 'Quick Start',
            url: 'getting-started/quick-start.html',
            category: 'Getting Started',
            sections: ['Launch', 'Navigation', 'Basic Usage', 'Apply Changes'],
            keywords: ['start', 'begin', 'tutorial', 'guide', 'first', 'basic', 'navigation', 'interface', 'ui'],
            content: 'Quick start guide for Winhance. Learn the basic interface navigation and how to apply your first optimizations.'
        },
        // Features - Main
        {
            title: 'Software & Apps',
            url: 'features/software-apps.html',
            category: 'Features',
            sections: ['Windows Apps', 'External Apps', 'App Management'],
            keywords: ['apps', 'software', 'programs', 'applications', 'install', 'remove', 'manage', 'bloatware', 'debloat'],
            content: 'Manage Windows apps and install external software. Remove bloatware and unwanted applications.'
        },
        {
            title: 'Optimize',
            url: 'features/optimize.html',
            category: 'Features',
            sections: ['Privacy', 'Security', 'Performance', 'Power', 'Updates', 'Notifications'],
            keywords: ['optimize', 'performance', 'speed', 'fast', 'privacy', 'security', 'power', 'battery', 'updates', 'tweaks'],
            content: 'System optimization features. Privacy settings, security hardening, performance tweaks, power management.'
        },
        {
            title: 'Customize',
            url: 'features/customize.html',
            category: 'Features',
            sections: ['Theme', 'Taskbar', 'Start Menu', 'Explorer'],
            keywords: ['customize', 'theme', 'appearance', 'look', 'feel', 'visual', 'ui', 'interface', 'personalize'],
            content: 'Windows customization features. Theme settings, taskbar modifications, Start Menu tweaks, Explorer options.'
        },
        {
            title: 'Advanced Tools',
            url: 'features/advanced-tools.html',
            category: 'Features',
            sections: ['System Tools', 'Registry Editor', 'Services', 'Scheduled Tasks', 'God Mode', 'System Information'],
            keywords: ['advanced', 'tools', 'registry', 'services', 'tasks', 'system', 'god mode', 'msconfig', 'device manager', 'disk management', 'event viewer', 'resource monitor', 'system info'],
            content: 'Advanced system tools. Quick access to Registry Editor, Services, Task Scheduler, God Mode folder, and system utilities.'
        },
        // Features - Software & Apps Sub-pages
        {
            title: 'Windows Apps & Features',
            url: 'features/software-apps/windows-apps.html',
            category: 'Software & Apps',
            sections: ['Removing Built-in Apps', 'Edge & OneDrive Removal', 'Removal Scripts', 'Status Indicators', 'Windows Capabilities', 'Optional Features', 'Continuous Removal'],
            keywords: ['windows apps', 'built-in', 'bloatware', 'remove', 'uninstall', 'edge', 'onedrive', 'cortana', 'xbox', 'mail', 'calendar', 'photos', 'camera', 'maps', 'weather', 'news', 'groove', 'movies', 'skype', 'teams', 'widgets', 'copilot', 'recall', 'clipchamp', 'feedback hub', 'get help', 'microsoft store', 'paint', 'notepad', 'wordpad', 'media player', 'snipping tool', 'sticky notes', 'voice recorder', 'calculator', 'clock', 'tips', 'to do', 'whiteboard', 'your phone', 'phone link', 'powershell', 'terminal', 'webview', 'capabilities', 'optional features', 'internet explorer', 'ie mode', 'hyper-v', 'sandbox', 'wsl', 'openssh', 'powershell ise', 'scheduled tasks', 'bloatremoval', 'edgeremoval', 'onedriveremoval', 'continuous removal'],
            content: 'Remove Windows built-in apps, Edge browser, OneDrive, Cortana, Xbox apps, and more. Manage Windows Capabilities and Optional Features. Continuous removal ensures apps stay uninstalled.'
        },
        {
            title: 'External Apps',
            url: 'features/software-apps/external-apps.html',
            category: 'Software & Apps',
            sections: ['Installing Apps', 'App Categories', 'Winget Integration', 'Chocolatey'],
            keywords: ['external apps', 'install', 'winget', 'chocolatey', 'third party', 'browsers', 'chrome', 'firefox', 'brave', 'vivaldi', 'opera', '7zip', 'vlc', 'notepad++', 'vscode', 'visual studio code', 'git', 'python', 'nodejs', 'java', 'dotnet', 'steam', 'discord', 'spotify', 'zoom', 'slack', 'obs', 'gimp', 'inkscape', 'blender', 'audacity', 'handbrake', 'qbittorrent', 'putty', 'winscp', 'filezilla', 'everything', 'powertoys', 'autohotkey', 'wireshark', 'sysinternals', 'cpu-z', 'gpu-z', 'hwinfo', 'crystaldiskinfo', 'furmark', 'prime95', 'memtest'],
            content: 'Install external applications using Winget or Chocolatey. Browsers, development tools, media players, utilities, and more.'
        },
        // Features - Optimizations Sub-pages
        {
            title: 'Privacy & Security',
            url: 'features/optimizations/privacy-security.html',
            category: 'Optimizations',
            sections: ['Security Settings', 'User Account Control', 'Windows Defender', 'SmartScreen', 'Firewall', 'BitLocker', 'Content Delivery', 'Lock Screen', 'General Privacy', 'Advertising ID', 'Speech Recognition', 'Inking & Typing', 'Diagnostics & Telemetry', 'Activity History', 'Timeline', 'Search Permissions', 'Cloud Search', 'Bing', 'App Permissions', 'Location', 'Camera', 'Microphone', 'Contacts', 'Calendar', 'Call History', 'Email', 'Tasks', 'Messaging', 'Documents', 'Pictures', 'Videos', 'File System', 'Background Apps'],
            keywords: ['privacy', 'security', 'telemetry', 'tracking', 'data collection', 'advertising', 'ads', 'advertising id', 'uac', 'user account control', 'defender', 'smartscreen', 'firewall', 'bitlocker', 'encryption', 'speech', 'voice', 'cortana', 'typing', 'inking', 'handwriting', 'diagnostics', 'feedback', 'activity history', 'timeline', 'clipboard history', 'search', 'bing', 'cloud', 'safesearch', 'location', 'gps', 'camera', 'webcam', 'microphone', 'mic', 'contacts', 'calendar', 'email', 'messaging', 'sms', 'documents', 'pictures', 'photos', 'videos', 'file system', 'background apps', 'app permissions', 'ceip', 'customer experience', 'error reporting', 'watson', 'sqm'],
            content: 'Privacy and security settings. Disable telemetry, advertising ID, Cortana, diagnostics. Control app permissions for camera, microphone, location. Configure UAC, Defender, SmartScreen, BitLocker.'
        },
        {
            title: 'Power Settings',
            url: 'features/optimizations/power.html',
            category: 'Optimizations',
            sections: ['Power Plans', 'Sleep Settings', 'Hibernation', 'USB Power', 'Display Power', 'Battery Saver', 'Fast Startup', 'Lid Close Action', 'Power Button Action'],
            keywords: ['power', 'battery', 'sleep', 'hibernate', 'hibernation', 'standby', 'suspend', 'wake', 'fast startup', 'quick boot', 'power plan', 'balanced', 'high performance', 'power saver', 'ultimate performance', 'usb', 'selective suspend', 'display', 'screen', 'timeout', 'turn off', 'lid', 'close', 'power button', 'energy', 'consumption', 'laptop', 'battery saver'],
            content: 'Power management settings. Configure power plans, sleep, hibernation, fast startup. USB selective suspend, display timeout, battery saver options.'
        },
        {
            title: 'Gaming & Performance',
            url: 'features/optimizations/gaming-performance.html',
            category: 'Optimizations',
            sections: ['Game Mode', 'Game Bar', 'Game DVR', 'Hardware Acceleration', 'GPU Scheduling', 'Variable Refresh Rate', 'Auto HDR', 'DirectX', 'Fullscreen Optimizations', 'Mouse Settings', 'Visual Effects', 'Animations', 'Transparency', 'Superfetch', 'Prefetch', 'HPET', 'Timer Resolution', 'Process Priority', 'CPU Affinity', 'Memory Management', 'Virtual Memory', 'Pagefile'],
            keywords: ['gaming', 'performance', 'fps', 'frames', 'frame rate', 'latency', 'input lag', 'game mode', 'game bar', 'game dvr', 'recording', 'capture', 'screenshot', 'nvidia', 'amd', 'radeon', 'geforce', 'gpu', 'graphics', 'hardware acceleration', 'gpu scheduling', 'hags', 'vrr', 'variable refresh rate', 'freesync', 'gsync', 'adaptive sync', 'hdr', 'auto hdr', 'directx', 'dx11', 'dx12', 'vulkan', 'opengl', 'fullscreen', 'optimizations', 'disable fullscreen optimizations', 'mouse', 'pointer', 'acceleration', 'enhance pointer precision', 'raw input', 'polling rate', 'dpi', 'sensitivity', 'visual effects', 'animations', 'transparency', 'blur', 'acrylic', 'mica', 'superfetch', 'sysmain', 'prefetch', 'hpet', 'timer', 'resolution', 'priority', 'affinity', 'cores', 'threads', 'memory', 'ram', 'virtual memory', 'pagefile', 'swap', 'stuttering', 'stutters', 'lag', 'smooth', 'optimization', 'tweaks', 'csgo', 'valorant', 'fortnite', 'apex', 'call of duty', 'warzone', 'pubg', 'overwatch', 'league of legends', 'dota', 'minecraft', 'roblox', 'gta', 'elden ring', 'cyberpunk'],
            content: 'Gaming and performance optimizations. Game Mode, Game Bar, Game DVR settings. GPU scheduling, fullscreen optimizations, mouse acceleration, visual effects, animations. Memory and CPU tweaks for better FPS and lower latency.'
        },
        {
            title: 'Windows Update',
            url: 'features/optimizations/update.html',
            category: 'Optimizations',
            sections: ['Update Settings', 'Automatic Updates', 'Delivery Optimization', 'P2P Updates', 'Update Notifications', 'Driver Updates', 'Feature Updates', 'Quality Updates', 'Pause Updates', 'Active Hours', 'Restart Options', 'Windows Insider'],
            keywords: ['update', 'windows update', 'automatic', 'download', 'install', 'patch', 'security update', 'cumulative', 'feature update', 'quality update', 'driver', 'driver update', 'delivery optimization', 'p2p', 'peer to peer', 'bandwidth', 'metered connection', 'pause', 'defer', 'delay', 'active hours', 'restart', 'reboot', 'schedule', 'notification', 'insider', 'preview', 'beta', 'dev channel', 'wufb', 'wsus'],
            content: 'Windows Update settings. Control automatic updates, delivery optimization, driver updates. Pause updates, set active hours, manage restart behavior.'
        },
        {
            title: 'Notifications',
            url: 'features/optimizations/notifications.html',
            category: 'Optimizations',
            sections: ['Notification Settings', 'Action Center', 'Toast Notifications', 'Lock Screen Notifications', 'App Notifications', 'Focus Assist', 'Do Not Disturb', 'Priority Notifications', 'Quiet Hours', 'Sounds'],
            keywords: ['notifications', 'notify', 'alert', 'toast', 'popup', 'action center', 'notification center', 'focus assist', 'do not disturb', 'dnd', 'quiet hours', 'priority', 'sounds', 'lock screen', 'banner', 'badge', 'app notifications', 'disable notifications', 'mute', 'silent'],
            content: 'Notification settings. Disable toast notifications, action center, lock screen notifications. Configure Focus Assist, Do Not Disturb, quiet hours.'
        },
        {
            title: 'Sound Settings',
            url: 'features/optimizations/sound.html',
            category: 'Optimizations',
            sections: ['System Sounds', 'Startup Sound', 'Notification Sounds', 'Sound Scheme', 'Audio Enhancements', 'Spatial Sound', 'Volume Mixer', 'Default Devices'],
            keywords: ['sound', 'audio', 'volume', 'speaker', 'headphones', 'microphone', 'startup sound', 'notification sound', 'system sounds', 'sound scheme', 'no sounds', 'mute', 'enhancements', 'spatial sound', 'dolby', 'dts', 'windows sonic', 'atmos', 'mixer', 'device', 'output', 'input', 'playback', 'recording', 'realtek', 'high definition audio'],
            content: 'Sound and audio settings. Disable startup sound, notification sounds, system sounds. Configure audio enhancements, spatial sound, volume mixer.'
        },
        // Features - Customizations Sub-pages
        {
            title: 'Windows Theme',
            url: 'features/customizations/theme.html',
            category: 'Customizations',
            sections: ['Dark Mode', 'Light Mode', 'Accent Color', 'Transparency', 'Colors', 'Contrast', 'Cursor', 'Fonts', 'Wallpaper', 'Lock Screen'],
            keywords: ['theme', 'dark mode', 'light mode', 'dark theme', 'light theme', 'accent', 'color', 'colours', 'transparency', 'blur', 'acrylic', 'mica', 'contrast', 'high contrast', 'cursor', 'pointer', 'mouse cursor', 'font', 'fonts', 'wallpaper', 'background', 'desktop background', 'lock screen', 'personalization', 'appearance', 'visual', 'style'],
            content: 'Windows theme customization. Dark mode, light mode, accent colors, transparency effects. Cursor, fonts, wallpaper, lock screen settings.'
        },
        {
            title: 'Taskbar',
            url: 'features/customizations/taskbar.html',
            category: 'Customizations',
            sections: ['Taskbar Position', 'Taskbar Size', 'Taskbar Icons', 'System Tray', 'Search Box', 'Task View', 'Widgets', 'Chat', 'Copilot', 'Hidden Icons', 'Taskbar Behavior', 'Auto-hide', 'Combine Buttons', 'Badges', 'News and Interests'],
            keywords: ['taskbar', 'position', 'bottom', 'top', 'left', 'right', 'size', 'small', 'large', 'icons', 'system tray', 'notification area', 'search', 'search box', 'search icon', 'task view', 'virtual desktops', 'widgets', 'news', 'weather', 'chat', 'teams', 'copilot', 'ai', 'hidden icons', 'overflow', 'auto hide', 'autohide', 'combine', 'never combine', 'always combine', 'badges', 'unread', 'news and interests', 'cortana button', 'people', 'ink workspace', 'touch keyboard', 'show desktop'],
            content: 'Taskbar customization. Position, size, icons. Hide search box, Task View, Widgets, Chat, Copilot. System tray settings, auto-hide, button combining.'
        },
        {
            title: 'Start Menu',
            url: 'features/customizations/start-menu.html',
            category: 'Customizations',
            sections: ['Start Menu Layout', 'Pinned Apps', 'Recommended', 'Recent Items', 'Folders', 'Start Menu Size', 'All Apps', 'Power Button', 'Account Picture', 'Live Tiles', 'Start Menu Style', 'Classic Start'],
            keywords: ['start menu', 'start', 'pinned', 'pins', 'recommended', 'suggestions', 'recent', 'recent items', 'recent files', 'recent apps', 'folders', 'documents', 'downloads', 'music', 'pictures', 'videos', 'settings', 'size', 'resize', 'all apps', 'app list', 'power', 'shutdown', 'restart', 'sleep', 'sign out', 'lock', 'account', 'picture', 'avatar', 'live tiles', 'tiles', 'classic', 'windows 10 style', 'windows 11 style', 'full screen', 'show more pins', 'show more recommendations'],
            content: 'Start Menu customization. Layout, pinned apps, recommended section, recent items. Folders, size, All Apps list. Power button options, account picture.'
        },
        {
            title: 'Explorer',
            url: 'features/customizations/explorer.html',
            category: 'Customizations',
            sections: ['File Extensions', 'Hidden Files', 'Navigation Pane', 'Quick Access', 'Recent Files', 'Frequent Folders', 'This PC', 'Libraries', 'OneDrive', 'Network', 'Ribbon', 'Command Bar', 'Details Pane', 'Preview Pane', 'Status Bar', 'Compact View', 'Item Checkboxes', 'Full Path', 'Context Menu', 'Right Click', 'New Context Menu', 'Classic Context Menu'],
            keywords: ['explorer', 'file explorer', 'windows explorer', 'file', 'files', 'folders', 'extensions', 'file extensions', 'show extensions', 'hidden files', 'hidden folders', 'show hidden', 'navigation pane', 'nav pane', 'quick access', 'favorites', 'recent files', 'recent folders', 'frequent folders', 'this pc', 'my computer', 'libraries', 'onedrive', 'network', 'ribbon', 'command bar', 'toolbar', 'details pane', 'preview pane', 'status bar', 'compact view', 'compact mode', 'checkboxes', 'item check boxes', 'full path', 'address bar', 'breadcrumbs', 'context menu', 'right click', 'right-click', 'new context menu', 'windows 11 context menu', 'classic context menu', 'show more options', 'full context menu', 'legacy context menu', 'gallery', 'home', 'folder options'],
            content: 'File Explorer customization. Show file extensions, hidden files. Navigation pane, Quick Access, recent files. Context menu (right-click) options, classic vs new menu. Ribbon, command bar, preview pane.'
        },
        // User Guides
        {
            title: 'Configuration Files',
            url: 'guides/configuration-files.html',
            category: 'User Guides',
            sections: ['Config File Format', 'Export Settings', 'Import Settings', 'Backup', 'Restore', 'JSON Format', 'Preset Files'],
            keywords: ['config', 'configuration', 'settings', 'export', 'import', 'backup', 'restore', 'save', 'load', 'json', 'preset', 'profile', 'file', 'share', 'transfer'],
            content: 'Configuration file management. Export and import settings. Backup and restore configurations. JSON format presets.'
        },
        {
            title: 'WIMUtil Guide',
            url: 'guides/wimutil.html',
            category: 'User Guides',
            sections: ['What is WIMUtil', 'Creating Custom ISO', 'WIM Files', 'Image Modification', 'Driver Integration', 'Update Integration', 'Unattended Installation'],
            keywords: ['wimutil', 'wim', 'iso', 'image', 'windows image', 'custom iso', 'custom image', 'install.wim', 'boot.wim', 'driver', 'drivers', 'integration', 'updates', 'slipstream', 'unattended', 'deployment', 'oem', 'dism', 'imagex', 'oscdimg'],
            content: 'WIMUtil guide for creating custom Windows images. Modify WIM files, integrate drivers and updates, create unattended installation media.'
        },
        {
            title: 'Autounattend Guide',
            url: 'guides/autounattend.html',
            category: 'User Guides',
            sections: ['What is Autounattend', 'Creating Answer File', 'Unattended Installation', 'OOBE Settings', 'User Account', 'Regional Settings', 'Disk Partitioning', 'Product Key'],
            keywords: ['autounattend', 'unattend', 'answer file', 'unattended', 'automatic installation', 'oobe', 'out of box experience', 'setup', 'user account', 'admin', 'administrator', 'regional', 'language', 'locale', 'timezone', 'time zone', 'partition', 'disk', 'format', 'product key', 'license', 'activation', 'xml', 'sysprep'],
            content: 'Autounattend.xml guide for automated Windows installation. Configure OOBE, user accounts, regional settings, disk partitioning.'
        },
        // Reference
        {
            title: 'CLI Commands',
            url: 'reference/cli-commands.html',
            category: 'Reference',
            sections: ['Command Line Interface', 'Arguments', 'Parameters', 'Switches', 'Silent Mode', 'Automation', 'Scripting'],
            keywords: ['cli', 'command line', 'cmd', 'powershell', 'terminal', 'arguments', 'parameters', 'switches', 'flags', 'options', 'silent', 'quiet', 'unattended', 'automation', 'script', 'scripting', 'batch'],
            content: 'CLI commands reference. Command line arguments, parameters, and switches for automation and scripting.'
        },
        {
            title: 'Changelog',
            url: 'reference/changelog.html',
            category: 'Reference',
            sections: ['Version History', 'Release Notes', 'New Features', 'Bug Fixes', 'Breaking Changes'],
            keywords: ['changelog', 'changes', 'history', 'version', 'release', 'notes', 'new', 'features', 'bug', 'fix', 'fixed', 'update', 'updated', 'added', 'removed', 'changed', 'breaking', 'v25', 'v24', 'v23'],
            content: 'Changelog and version history. Release notes, new features, bug fixes, and breaking changes.'
        },
        {
            title: 'Troubleshooting',
            url: 'reference/troubleshooting.html',
            category: 'Reference',
            sections: ['Common Issues', 'Error Messages', 'App Not Starting', 'Settings Not Applying', 'Restore Settings', 'Reset to Default', 'Contact Support'],
            keywords: ['troubleshooting', 'trouble', 'problem', 'issue', 'error', 'bug', 'fix', 'solution', 'help', 'support', 'not working', 'broken', 'crash', 'freeze', 'hang', 'stuck', 'restore', 'reset', 'default', 'undo', 'revert'],
            content: 'Troubleshooting guide. Common issues, error messages, and solutions. How to restore settings and contact support.'
        },
        {
            title: 'How to Contribute',
            url: 'reference/contributing.html',
            category: 'Reference',
            sections: ['Contributing Guide', 'Bug Reports', 'Feature Requests', 'Pull Requests', 'Code Style', 'Development Setup'],
            keywords: ['contribute', 'contributing', 'contribution', 'github', 'bug report', 'issue', 'feature request', 'pull request', 'pr', 'code', 'development', 'developer', 'open source', 'community', 'help'],
            content: 'How to contribute to Winhance. Bug reports, feature requests, pull requests. Development setup and code style guidelines.'
        }
    ];

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        // Clear previous timer
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            resultsDropdown.classList.remove('active');
            resultsDropdown.innerHTML = '';
            return;
        }

        // Debounce search for better performance
        debounceTimer = setTimeout(() => {
            performSearch(query);
        }, 150);
    });

    function performSearch(query) {
        const results = [];
        const queryWords = query.split(/\s+/).filter(w => w.length >= 2);

        searchIndex.forEach(page => {
            const matches = [];
            let score = 0;

            // Check title match (highest priority)
            if (page.title.toLowerCase().includes(query)) {
                score += 100;
                matches.push({ type: 'title', text: page.title });
            }

            // Check category match
            if (page.category.toLowerCase().includes(query)) {
                score += 30;
            }

            // Check section matches
            page.sections.forEach(section => {
                if (section.toLowerCase().includes(query)) {
                    score += 50;
                    matches.push({ type: 'section', text: section });
                }
            });

            // Check keyword matches (important for specific terms)
            page.keywords.forEach(keyword => {
                if (keyword.includes(query) || query.includes(keyword)) {
                    score += 40;
                    if (!matches.some(m => m.text.toLowerCase() === keyword)) {
                        matches.push({ type: 'keyword', text: keyword });
                    }
                }
            });

            // Check content match
            if (page.content.toLowerCase().includes(query)) {
                score += 20;
                // Extract relevant snippet
                const contentLower = page.content.toLowerCase();
                const idx = contentLower.indexOf(query);
                if (idx !== -1) {
                    const start = Math.max(0, idx - 30);
                    const end = Math.min(page.content.length, idx + query.length + 50);
                    let snippet = page.content.substring(start, end);
                    if (start > 0) snippet = '...' + snippet;
                    if (end < page.content.length) snippet = snippet + '...';
                    matches.push({ type: 'content', text: snippet });
                }
            }

            // Multi-word query: check if all words match somewhere
            if (queryWords.length > 1) {
                const pageText = [
                    page.title,
                    page.category,
                    ...page.sections,
                    ...page.keywords,
                    page.content
                ].join(' ').toLowerCase();

                const allWordsMatch = queryWords.every(word => pageText.includes(word));
                if (allWordsMatch) {
                    score += 25;
                }
            }

            if (score > 0) {
                results.push({
                    ...page,
                    score,
                    matches: matches.slice(0, 3) // Limit matches shown
                });
            }
        });

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        // Take top results
        const topResults = results.slice(0, 10);

        if (topResults.length > 0) {
            renderResults(topResults, query);
            resultsDropdown.classList.add('active');
        } else {
            resultsDropdown.innerHTML = '<div class="search-no-results">No results found</div>';
            resultsDropdown.classList.add('active');
        }
    }

    function highlightMatch(text, query) {
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function renderResults(results, query) {
        resultsDropdown.innerHTML = results.map(result => {
            // Build match context string
            let context = '';
            if (result.matches && result.matches.length > 0) {
                const relevantMatch = result.matches.find(m => m.type === 'section' || m.type === 'keyword') || result.matches[0];
                if (relevantMatch) {
                    if (relevantMatch.type === 'section') {
                        context = `<span class="result-context">Section: ${highlightMatch(relevantMatch.text, query)}</span>`;
                    } else if (relevantMatch.type === 'keyword') {
                        context = `<span class="result-context">Found: ${highlightMatch(relevantMatch.text, query)}</span>`;
                    } else if (relevantMatch.type === 'content') {
                        context = `<span class="result-context">${highlightMatch(relevantMatch.text, query)}</span>`;
                    }
                }
            }

            return `
                <a href="${pathPrefix}${result.url}" class="search-result-item">
                    <div class="result-title">${highlightMatch(result.title, query)}</div>
                    <div class="result-category">${result.category}</div>
                    ${context}
                </a>
            `;
        }).join('');
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            resultsDropdown.classList.remove('active');
        }
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const items = resultsDropdown.querySelectorAll('.search-result-item');
        const activeItem = resultsDropdown.querySelector('.search-result-item.active');
        let currentIndex = Array.from(items).indexOf(activeItem);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activeItem) activeItem.classList.remove('active');
            currentIndex = (currentIndex + 1) % items.length;
            items[currentIndex]?.classList.add('active');
            items[currentIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activeItem) activeItem.classList.remove('active');
            currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
            items[currentIndex]?.classList.add('active');
            items[currentIndex]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const targetItem = activeItem || items[0];
            if (targetItem) {
                window.location.href = targetItem.href;
            }
        } else if (e.key === 'Escape') {
            resultsDropdown.classList.remove('active');
            searchInput.blur();
        }
    });
});
