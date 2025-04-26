// Initialize button hover effects and fetch GitHub stars
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
    
    // Fetch GitHub stars count
    fetchGitHubStars();
});

// Function to fetch GitHub stars count
function fetchGitHubStars() {
    const repoOwner = 'memstechtips';
    const repoName = 'Winhance';
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;
    const starsElement = document.querySelector('.github-stars-badge .text');
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const starCount = data.stargazers_count;
            if (starsElement && starCount) {
                // Format the number with commas for thousands
                const formattedCount = starCount.toLocaleString();
                starsElement.textContent = `${formattedCount} GitHub Stars`;
            }
        })
        .catch(error => {
            console.error('Error fetching GitHub stars:', error);
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

// Add parallax effect to hero image and heading
function parallaxEffect() {
    const heroImage = document.querySelector('.hero-image img');
    const heroHeading = document.querySelector('.hero-heading h1');

    if (heroImage && heroHeading) {
        const scrollPosition = window.scrollY;
        if (scrollPosition < 600) { // Only apply effect near the top of the page
            // Parallax for image - now with horizontal movement
            heroImage.style.transform = `perspective(1000px) rotateY(-5deg) translateX(${-scrollPosition * 0.03}px)`;

            // Subtle parallax for heading
            heroHeading.style.transform = `translateY(${scrollPosition * 0.02}px)`;
            heroHeading.style.opacity = 1 - (scrollPosition * 0.002);
        }
    }
}

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
    parallaxEffect();
});
