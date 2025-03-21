// Common functionality

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Display recent videos in the footer on page load
    loadFooterRecentVideos();
    
    // Handle theme switching
    const themeItems = document.querySelectorAll('.theme-item');
    themeItems.forEach(item => {
        item.addEventListener('click', () => {
            const theme = item.dataset.theme;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    });
    
    // Apply saved theme from localStorage if available
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
});

// Format seconds to MM:SS format
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Error handling function
function handleError(error) {
    console.error('Error:', error);
    return `<div role="alert" class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Error: ${error.message || 'Something went wrong'}</span>
        <div>
            <button class="btn btn-sm btn-ghost" onclick="window.location.reload()">Retry</button>
        </div>
    </div>`;
}

// Toast notification function
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} fixed bottom-4 right-4 max-w-xs z-50 shadow-lg`;
    
    // Different icon based on type
    let icon = '';
    switch(type) {
        case 'success':
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>`;
            break;
        case 'warning':
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>`;
            break;
        case 'error':
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>`;
            break;
        default: // info
            icon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>`;
    }
    
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
        <div>
            <button class="btn btn-sm btn-ghost" onclick="this.parentElement.parentElement.remove()">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    `;
    document.body.appendChild(toast);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Extract video ID from YouTube URL
function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

// Load recent videos into the footer from the API
function loadFooterRecentVideos() {
    const footerRecentVideos = document.getElementById('footer-recent-videos');
    if (!footerRecentVideos) return;
    
    // Show loading state
    footerRecentVideos.innerHTML = '<p class="text-sm opacity-70">Loading recent videos...</p>';
    
    // Fetch recent videos from server API
    fetch('/api/video/recent?limit=3')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch recent videos');
            }
            return response.json();
        })
        .then(videos => {
            if (videos && videos.length > 0) {
                // Generate HTML for recent videos
                const videoLinks = videos.map(video => {
                    return `
                        <a href="/video/${video.video_id}" class="link link-hover block py-1 truncate">
                            <span class="text-xs text-primary">▶</span> ${video.title || `Video ${video.video_id}`}
                        </a>
                    `;
                }).join('');
                
                // Add videos to the footer
                footerRecentVideos.innerHTML = videoLinks;
            } else {
                footerRecentVideos.innerHTML = '<p class="text-sm opacity-70">No recent videos</p>';
            }
        })
        .catch(error => {
            console.error('Error loading footer videos:', error);
            footerRecentVideos.innerHTML = '<p class="text-sm opacity-70">Failed to load recent videos</p>';
        });
}
