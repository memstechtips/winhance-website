// Initialize button hover effects and fetch GitHub data
document.addEventListener('DOMContentLoaded', function() {
    // Add hover effects to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
        });

        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // PowerShell command copy-to-clipboard functionality
    const copyBtn = document.getElementById('copy-powershell-btn');
    const codeElement = document.getElementById('powershell-code');

    if (copyBtn && codeElement) {
        copyBtn.addEventListener('click', function() {
            // Get the text content
            const textToCopy = codeElement.textContent;

            // Use the modern Clipboard API
            navigator.clipboard.writeText(textToCopy).then(function() {
                // Success feedback
                const copyIcon = copyBtn.querySelector('.copy-icon');
                const checkmarkIcon = copyBtn.querySelector('.checkmark-icon');

                // Hide copy icon, show checkmark
                copyIcon.style.display = 'none';
                checkmarkIcon.style.display = 'block';
                copyBtn.classList.add('copied');

                // Reset after 2 seconds
                setTimeout(function() {
                    copyIcon.style.display = 'block';
                    checkmarkIcon.style.display = 'none';
                    copyBtn.classList.remove('copied');
                }, 2000);
            }).catch(function(err) {
                // Fallback for older browsers
                console.error('Failed to copy text: ', err);

                // Try the old method
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();

                try {
                    document.execCommand('copy');
                    const copyIcon = copyBtn.querySelector('.copy-icon');
                    const checkmarkIcon = copyBtn.querySelector('.checkmark-icon');

                    copyIcon.style.display = 'none';
                    checkmarkIcon.style.display = 'block';
                    copyBtn.classList.add('copied');

                    setTimeout(function() {
                        copyIcon.style.display = 'block';
                        checkmarkIcon.style.display = 'none';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Fallback copy failed: ', err);
                }

                document.body.removeChild(textArea);
            });
        });
    }

    // Fetch GitHub data (stars, version, downloads)
    fetchGitHubData();
});

// Function to fetch GitHub data (stars, version, downloads)
function fetchGitHubData() {
    const repoOwner = 'memstechtips';
    const repoName = 'Winhance';
    const repoUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;
    const releasesUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;

    // Fetch repository data for stars
    fetch(repoUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const starCount = data.stargazers_count;
            const starsElement = document.querySelector('.github-stars-badge .text');
            if (starsElement && starCount) {
                // Format the number with commas for thousands
                const formattedCount = starCount.toLocaleString();
                starsElement.textContent = `${formattedCount} GitHub Stars`;
            }

            // Update community section star count
            const communityStatElement = document.querySelector('.community-card .stat');
            if (communityStatElement && starCount) {
                const formattedCount = starCount >= 1000
                    ? (starCount / 1000).toFixed(1) + 'k+'
                    : starCount.toLocaleString();
                communityStatElement.textContent = `${formattedCount} Stars`;
            }
        })
        .catch(error => {
            console.error('Error fetching GitHub stars:', error);
            // Keep the hardcoded value as fallback
        });

    // Fetch latest release data for version info
    fetch(releasesUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Update version badge
            const versionElement = document.querySelector('.version-text');
            if (versionElement && data.tag_name) {
                versionElement.textContent = data.tag_name;
            }

            // Update version number in hero info line
            const versionNumberElement = document.querySelector('.version-number');
            if (versionNumberElement && data.tag_name) {
                versionNumberElement.textContent = data.tag_name;
            }

            // Update footer version
            const footerVersionElement = document.querySelector('.footer-version');
            if (footerVersionElement && data.tag_name) {
                footerVersionElement.textContent = `Version ${data.tag_name}`;
            }
        })
        .catch(error => {
            console.error('Error fetching GitHub release data:', error);
            // Keep the hardcoded values as fallback
        });

    // Fetch ALL releases to calculate total downloads across all versions
    const allReleasesUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/releases`;
    fetch(allReleasesUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(releases => {
            // Calculate total downloads from all releases
            let totalDownloads = 0;

            releases.forEach(release => {
                if (release.assets && release.assets.length > 0) {
                    release.assets.forEach(asset => {
                        totalDownloads += asset.download_count;
                    });
                }
            });

            // Update download count in hero info line
            const downloadCountElement = document.querySelector('.download-count');
            if (downloadCountElement && totalDownloads > 0) {
                const formattedDownloads = totalDownloads >= 1000
                    ? (totalDownloads / 1000).toFixed(1) + 'k+'
                    : totalDownloads.toLocaleString();
                downloadCountElement.textContent = formattedDownloads;
            }
        })
        .catch(error => {
            console.error('Error fetching all GitHub releases:', error);
            // Keep the hardcoded value as fallback
        });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// Animation on scroll
const animateElements = document.querySelectorAll('.animate-fadeInUp');

function checkIfInView() {
    const windowHeight = window.innerHeight;
    const windowTopPosition = window.scrollY;
    const windowBottomPosition = windowTopPosition + windowHeight;

    animateElements.forEach((element, index) => {
        const elementHeight = element.offsetHeight;
        const elementTopPosition = element.offsetTop;
        const elementBottomPosition = elementTopPosition + elementHeight;

        // Check if element is in viewport
        if (
            (elementBottomPosition >= windowTopPosition) &&
            (elementTopPosition <= windowBottomPosition)
        ) {
            // Add a slight delay for each element to create a cascade effect
            setTimeout(() => {
                element.classList.add('fadeInUp');
            }, index * 150);
        }
    });
}

// Parallax effect removed - hero image now uses simple hover scale effect

// FAQ accordion functionality
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', () => {
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle current item
            item.classList.toggle('active');
        });
    });
}

// Testimonials slider functionality
function setupTestimonialsSlider() {
    const track = document.querySelector('.testimonials-track');

    if (!track) return;

    // Clone the testimonial cards to create a seamless infinite scroll effect
    const cards = track.querySelectorAll('.testimonial-card');

    // Clone each card and append to the track
    cards.forEach(card => {
        const clone = card.cloneNode(true);
        track.appendChild(clone);
    });

    // Calculate the total width of original cards
    const cardWidth = 300; // Width of each card in pixels
    const gapWidth = 20; // Gap between cards in pixels
    const totalWidth = (cardWidth + gapWidth) * (cards.length);

    // Create a CSS animation directly on the element
    // This avoids the security error when trying to access CSS rules
    const animationDuration = cards.length * 5; // 5 seconds per card

    // Apply the animation directly to the track element
    track.style.animation = `none`; // Reset animation first

    // Force reflow
    void track.offsetWidth;

    // Set new animation
    track.style.animation = `scroll ${animationDuration}s linear infinite`;
    track.style.animationFillMode = 'forwards';

    // Create a style element for the keyframes
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        @keyframes scroll {
            0% {
                transform: translateX(0);
            }
            100% {
                transform: translateX(-${totalWidth}px);
            }
        }
    `;
    document.head.appendChild(styleElement);

    // Add hover event listeners to pause/resume animation
    track.addEventListener('mouseenter', () => {
        track.style.animationPlayState = 'paused';
    });

    track.addEventListener('mouseleave', () => {
        track.style.animationPlayState = 'running';
    });
}

// Run on load and scroll
window.addEventListener('load', () => {
    checkIfInView();
    initFaqAccordion();
    setupTestimonialsSlider();

    // Add a class to body after page is fully loaded for potential page transitions
    document.body.classList.add('page-loaded');
});

window.addEventListener('scroll', () => {
    checkIfInView();
});
