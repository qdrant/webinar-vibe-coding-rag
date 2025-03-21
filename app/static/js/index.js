// Index page functionality
document.addEventListener('DOMContentLoaded', () => {
    const youtubeUrlInput = document.getElementById('youtube-url');
    const processButton = document.getElementById('process-button');
    const processStatus = document.getElementById('process-status');
    const processingIndicator = document.getElementById('processing');
    const recentlyProcessedCard = document.getElementById('recently-processed');
    const videoListContainer = document.getElementById('video-list');
    
    // Example video buttons
    const exampleButtons = document.querySelectorAll('.example-video');
    
    // Process button click handler
    processButton.addEventListener('click', () => processVideo());
    
    // Enter key in input field
    youtubeUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processVideo();
    });
    
    // Example video buttons
    exampleButtons.forEach(button => {
        button.addEventListener('click', () => {
            youtubeUrlInput.value = button.dataset.url;
            processVideo();
        });
    });
    
    // Process video function
    function processVideo() {
        const youtubeUrl = youtubeUrlInput.value.trim();
        if (!youtubeUrl) {
            processStatus.innerHTML = '<div class="alert alert-warning">Please enter a YouTube URL</div>';
            return;
        }
        
        // Extract video ID
        const videoId = extractVideoId(youtubeUrl);
        if (!videoId) {
            processStatus.innerHTML = '<div class="alert alert-error">Invalid YouTube URL</div>';
            return;
        }
        
        // Show loading indicator with spinner and text
        processStatus.innerHTML = `
            <div class="flex items-center justify-center my-4">
                <span class="loading loading-spinner loading-md text-primary"></span>
                <span class="ml-2">Processing video... This may take a few moments</span>
            </div>
        `;
        
        // Set a timeout to handle overly long processing
        const timeoutId = setTimeout(() => {
            processStatus.innerHTML = `
                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Processing is taking longer than expected. Please wait...</span>
                </div>
            `;
        }, 20000); // 20 seconds
        
        // Send request to process the video
        fetch('/api/video/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: youtubeUrl })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to process video');
            }
            return response.json();
        })
        .then(data => {
            // Clear timeout for long-running process
            clearTimeout(timeoutId);
            
            // Extract video ID from response (handles both old and new API formats)
            const videoId = data.video ? data.video.video_id : data.video_id;
            const isNewlyProcessed = data.newly_processed !== undefined ? data.newly_processed : true;
            
            if (!videoId) {
                throw new Error('Invalid response: Missing video ID');
            }
            
            // Get video title (for display)
            const videoTitle = data.video ? data.video.title : (data.title || `Video ${videoId}`);
            
            // Log for debugging
            console.log('Process response:', {videoId, isNewlyProcessed, data});
            
            // Show success message
            processStatus.innerHTML = `
                <div role="alert" class="alert alert-success">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>${isNewlyProcessed ? 'Video processed successfully!' : 'Video was already processed!'}</span>
                    <div>
                        <a href="/video/${videoId}" class="btn btn-sm btn-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Open Video
                        </a>
                    </div>
                </div>
            `;
            
            // Update recent videos lists
            displayRecentVideos();
            loadFooterRecentVideos(); // Update footer videos as well
        })
        .catch(error => {
            // Clear timeout for long-running process
            clearTimeout(timeoutId);
            
            // Show error message
            console.error('Process error:', error);
            processStatus.innerHTML = handleError(error);
        });
    }
    
    // Display recently processed videos
    function displayRecentVideos() {
        // Show loading state
        recentlyProcessedCard.classList.remove('hidden');
        videoListContainer.innerHTML = `
            <div class="flex justify-center items-center p-4">
                <span class="loading loading-spinner loading-md"></span>
                <span class="ml-2">Loading recent videos...</span>
            </div>
        `;
        
        const carouselPrev = document.getElementById('carousel-prev');
        const carouselNext = document.getElementById('carousel-next');
        
        // Fetch recent videos from server
        fetch('/api/video/recent?limit=5')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch recent videos');
                }
                return response.json();
            })
            .then(videos => {
                if (videos && videos.length > 0) {
                    // Limit to 5 videos
                    const limitedVideos = videos.slice(0, 5);
                    
                    // Generate carousel items
                    const carouselItems = limitedVideos.map((video, index) => {
                        // Format date if available
                        let formattedDate = '';
                        if (video.created_at) {
                            const date = new Date(video.created_at * 1000); // Convert Unix timestamp to milliseconds
                            formattedDate = date.toLocaleDateString();
                        }
                        
                        // Use title or default
                        const videoTitle = video.title || `Video ${video.video_id}`;
                        
                        return `
                            <div id="video-${index}" class="carousel-item">
                                <a href="/video/${video.video_id}" class="card bg-base-100 shadow-sm hover:shadow-md transition-all w-64 md:w-72 flex flex-col">
                                    <figure class="w-full h-36 overflow-hidden">
                                        <img src="https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg" alt="Thumbnail" class="w-full h-full object-cover">
                                    </figure>
                                    <div class="card-body p-3">
                                        <h3 class="card-title text-sm line-clamp-2">${videoTitle}</h3>
                                        <div class="text-xs opacity-70">${formattedDate}</div>
                                    </div>
                                </a>
                            </div>
                        `;
                    }).join('');
                    
                    // Add carousel items to container
                    videoListContainer.innerHTML = carouselItems;
                    
                    // Setup navigation arrows
                    if (limitedVideos.length > 1) {
                        // Show arrows for multiple videos
                        let currentIndex = 0;
                        const maxIndex = limitedVideos.length - 1;
                        
                        // Show navigation arrows
                        carouselPrev.classList.remove('hidden');
                        carouselNext.classList.remove('hidden');
                        
                        // Left button is disabled by default (we're at the start)
                        const prevButton = carouselPrev.querySelector('button');
                        const nextButton = carouselNext.querySelector('button');
                        prevButton.classList.add('btn-disabled');
                        
                        // Functions to update button states
                        const updateButtonStates = () => {
                            if (currentIndex === 0) {
                                prevButton.classList.add('btn-disabled');
                            } else {
                                prevButton.classList.remove('btn-disabled');
                            }
                            
                            if (currentIndex === maxIndex) {
                                nextButton.classList.add('btn-disabled');
                            } else {
                                nextButton.classList.remove('btn-disabled');
                            }
                        };
                        
                        // Setup navigation buttons
                        prevButton.addEventListener('click', () => {
                            if (currentIndex > 0) {
                                currentIndex--;
                                document.getElementById(`video-${currentIndex}`).scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'nearest',
                                    inline: 'center'
                                });
                                updateButtonStates();
                            }
                        });
                        
                        nextButton.addEventListener('click', () => {
                            if (currentIndex < maxIndex) {
                                currentIndex++;
                                document.getElementById(`video-${currentIndex}`).scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'nearest',
                                    inline: 'center'
                                });
                                updateButtonStates();
                            }
                        });
                    } else {
                        // Hide arrows for single video
                        carouselPrev.classList.add('hidden');
                        carouselNext.classList.add('hidden');
                    }
                } else {
                    recentlyProcessedCard.classList.add('hidden');
                    carouselPrev.classList.add('hidden');
                    carouselNext.classList.add('hidden');
                }
            })
            .catch(error => {
                console.error('Error fetching recent videos:', error);
                videoListContainer.innerHTML = `
                    <div class="alert alert-error">
                        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Failed to load recent videos</span>
                    </div>
                `;
                carouselPrev.classList.add('hidden');
                carouselNext.classList.add('hidden');
            });
    }
    
    // Display recent videos on page load
    displayRecentVideos();
});
