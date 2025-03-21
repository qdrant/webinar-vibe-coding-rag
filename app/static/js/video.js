// Video page functionality
document.addEventListener('DOMContentLoaded', () => {
    const playerElement = document.getElementById('youtube-player');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const transcriptContainer = document.getElementById('transcript-container');
    const loadingIndicator = document.getElementById('loading');
    const toggleTranscriptButton = document.getElementById('toggle-transcript');
    
    let transcriptSegments = [];
    let ytPlayer = null;
    let isProcessingUrl = false;
    
    // Check if there's a search query in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    const processingUrl = urlParams.get('processing');
    
    // Format time to display as HH:MM:SS
    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    // Handle error display
    function handleError(error) {
        console.error(error);
        return `<div class="alert alert-error">Error: ${error.message}</div>`;
    }
    
    // Initialize YouTube iframe API
    function initYouTubePlayer() {
        // Get the existing iframe
        const iframeId = playerElement.getAttribute('id');
        
        // Load the YouTube iframe API if it's not already loaded
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = function() {
                createYouTubePlayer(iframeId);
            };
        } else {
            createYouTubePlayer(iframeId);
        }
    }
    
    // Create YouTube player object
    function createYouTubePlayer(iframeId) {
        ytPlayer = new YT.Player(iframeId, {
            events: {
                'onReady': onPlayerReady
            }
        });
    }
    
    // When player is ready
    function onPlayerReady(event) {
        console.log('Player ready');
    }
    
    // Load transcript segments
    function loadTranscript() {
        transcriptContainer.innerHTML = '<div class="flex justify-center my-4"><span class="loading loading-spinner loading-md"></span><span class="ml-2">Loading transcript...</span></div>';
        
        // Check if video ID is valid before making API call
        if (!videoId || videoId === 'undefined' || videoId === 'null') {
            transcriptContainer.innerHTML = `
                <div class="alert alert-error">
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>Invalid video ID. Please return to the home page and select a valid video.</span>
                    </div>
                </div>
            `;
            return;
        }
        
        fetch(`/api/video/segments/${videoId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load transcript: ' + response.status);
                }
                return response.json();
            })
            .then(segments => {
                transcriptSegments = segments;
                
                if (!segments || segments.length === 0) {
                    transcriptContainer.innerHTML = `
                        <div class="alert alert-info">
                            <div>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span>No transcript available for this video. Try processing the video first from the home page.</span>
                            </div>
                        </div>
                    `;
                } else {
                    displayTranscript(segments);
                }
            })
            .catch(error => {
                console.error('Error loading transcript:', error);
                transcriptContainer.innerHTML = `
                    <div class="alert alert-error">
                        <div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>Error loading transcript: ${error.message}</span>
                        </div>
                    </div>
                    <p class="mt-4">This may happen if:</p>
                    <ul class="list-disc ml-8 mt-2">
                        <li>The video hasn't been processed yet</li>
                        <li>The video ID is incorrect</li>
                        <li>The server is experiencing issues</li>
                    </ul>
                    <p class="mt-4">Try processing this video from the home page first.</p>
                `;
            });
    }
    
    // Display transcript segments
    function displayTranscript(segments) {
        const html = segments.map((segment, index) => {
            const formattedTime = formatTime(segment.start);
            
            return `
                <div class="transcript-segment" data-start="${segment.start}" data-end="${segment.end}" data-index="${index}">
                    <span class="timestamp">${formattedTime}</span>
                    <span class="segment-text">${segment.text}</span>
                </div>
            `;
        }).join('');
        
        transcriptContainer.innerHTML = html;
        
        // Add click handlers to segments
        document.querySelectorAll('.transcript-segment').forEach(segment => {
            segment.addEventListener('click', () => {
                const startTime = parseFloat(segment.dataset.start);
                seekToTime(startTime);
            });
        });
    }
    
    // Seek to specific time in the video
    function seekToTime(seconds) {
        console.log('Seeking to time:', seconds);
        
        if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
            try {
                // Ensure seconds is a number
                seconds = parseFloat(seconds);
                
                // Seek to time
                ytPlayer.seekTo(seconds, true);
                
                // Try to play the video (may be blocked by browser autoplay policies)
                try {
                    ytPlayer.playVideo();
                } catch (e) {
                    console.warn('Could not autoplay video:', e);
                }
                
                // Highlight the current segment
                highlightSegment(seconds);
            } catch (error) {
                console.error('Error seeking to time:', error);
            }
        } else {
            console.error('YouTube player is not ready yet or seekTo method is not available');
        }
    }
    
    // Highlight segment containing the current time
    function highlightSegment(time) {
        // Remove highlight from all segments
        document.querySelectorAll('.transcript-segment').forEach(segment => {
            segment.classList.remove('highlight');
        });
        
        // Find the segment containing current time
        // Need to find by approximate match since floating point exact matches may not work
        const segments = document.querySelectorAll('.transcript-segment');
        let currentSegment = null;
        
        for (const segment of segments) {
            const start = parseFloat(segment.dataset.start);
            const end = parseFloat(segment.dataset.end);
            
            if (time >= start && time <= end) {
                currentSegment = segment;
                break;
            }
        }
        
        // If exact time match not found, find the closest segment
        if (!currentSegment) {
            const exactMatch = document.querySelector(`.transcript-segment[data-start="${time}"]`);
            if (exactMatch) {
                currentSegment = exactMatch;
            }
        }
        
        if (currentSegment) {
            currentSegment.classList.add('highlight');
            currentSegment.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    // Search functionality
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') performSearch();
    });
    
    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            transcriptContainer.innerHTML = '<div class="alert alert-warning">Please enter a search query</div>';
            return;
        }
        
        // Validate video ID before searching
        if (!videoId || videoId === 'undefined' || videoId === 'null') {
            transcriptContainer.innerHTML = `
                <div class="alert alert-error">
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>Invalid video ID. Please return to the home page and select a valid video.</span>
                    </div>
                </div>
            `;
            return;
        }
        
        // Show loading indicator
        loadingIndicator.classList.remove('hidden');
        
        // Send search request
        fetch(`/api/video/search?query=${encodeURIComponent(query)}&video_id=${videoId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Search failed');
                }
                return response.json();
            })
            .then(results => {
                // Hide loading indicator
                loadingIndicator.classList.add('hidden');
                
                if (results.length === 0) {
                    // Show "no results" message in transcript container
                    transcriptContainer.innerHTML = `
                        <div role="alert" class="alert alert-info">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span>No results found for "${query}". <a href="#" id="reset-search" class="link link-primary">Show all transcript</a></span>
                        </div>`;
                        
                    // Add click handler to reset search link
                    document.getElementById('reset-search').addEventListener('click', (e) => {
                        e.preventDefault();
                        resetTranscriptFilter();
                        displayTranscript(transcriptSegments);
                    });
                    
                    return;
                }
                
                // Display search results as filtered transcript
                filterTranscript(results);
                
                // Add a header with search info and reset option
                const searchInfoHeader = document.createElement('div');
                searchInfoHeader.className = 'mb-4 flex justify-between items-center';
                searchInfoHeader.innerHTML = `
                    <div class="badge badge-accent">${results.length} results for "${query}"</div>
                    <a href="#" id="reset-search" class="link link-primary text-sm">Show all transcript</a>
                `;
                
                // Insert the header before transcript segments
                transcriptContainer.insertBefore(searchInfoHeader, transcriptContainer.firstChild);
                
                // Add click handler to reset search link
                document.getElementById('reset-search').addEventListener('click', (e) => {
                    e.preventDefault();
                    resetTranscriptFilter();
                    displayTranscript(transcriptSegments);
                });
            })
            .catch(error => {
                // Hide loading indicator
                loadingIndicator.classList.add('hidden');
                
                // Show error
                transcriptContainer.innerHTML = handleError(error);
            });
    }
    
    // Filter transcript to show only matching segments
    function filterTranscript(results) {
        // Create a highlighted version of the transcript with only matching segments
        const html = results.map(result => {
            const segment = result.segment;
            const formattedTime = formatTime(segment.start);
            const score = (result.score * 100).toFixed(0);
            const index = transcriptSegments.findIndex(s => s.segment_id === segment.segment_id);
            
            return `
                <div class="transcript-segment search-result" data-start="${segment.start}" data-end="${segment.end}" data-index="${index}">
                    <div class="flex justify-between items-center">
                        <span class="timestamp">${formattedTime}</span>
                        <div class="badge badge-primary">${score}% match</div>
                    </div>
                    <span class="segment-text mt-1">${segment.text}</span>
                </div>
            `;
        }).join('');
        
        // Replace transcript with filtered results
        transcriptContainer.innerHTML = html;
        
        // Add click handlers to segments
        document.querySelectorAll('.transcript-segment').forEach(segment => {
            segment.addEventListener('click', () => {
                const startTime = parseFloat(segment.dataset.start);
                seekToTime(startTime);
            });
        });
    }
    
    // Transcript is always visible - toggle functionality removed
    
    // Reset transcript filter to show all segments
    function resetTranscriptFilter() {
        searchInput.value = '';
    }
    
    // Show processing indicator if URL was just processed
    function showProcessingIndicator() {
        if (processingUrl === 'true') {
            isProcessingUrl = true;
            transcriptContainer.innerHTML = `
                <div class="flex items-center justify-center my-4">
                    <span class="loading loading-spinner loading-md text-primary"></span>
                    <span class="ml-2">Processing video from URL... This may take a few moments</span>
                </div>
            `;
            
            // Check for segments every second
            const processingInterval = setInterval(() => {
                // Validate video ID before making API call
                if (!videoId || videoId === 'undefined' || videoId === 'null') {
                    clearInterval(processingInterval);
                    transcriptContainer.innerHTML = `
                        <div class="alert alert-error">
                            <div>
                                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>Invalid video ID. Please return to the home page and select a valid video.</span>
                            </div>
                        </div>
                    `;
                    return;
                }
                
                fetch(`/api/video/segments/${videoId}`)
                    .then(response => {
                        if (!response.ok) {
                            return null;
                        }
                        return response.json();
                    })
                    .then(segments => {
                        if (segments && segments.length > 0) {
                            clearInterval(processingInterval);
                            isProcessingUrl = false;
                            loadTranscript();
                        }
                    })
                    .catch(error => {
                        console.error('Error checking segments:', error);
                    });
            }, 2000);
            
            // Set timeout to stop checking after 2 minutes
            setTimeout(() => {
                clearInterval(processingInterval);
                if (isProcessingUrl) {
                    transcriptContainer.innerHTML = `
                        <div class="alert alert-warning">
                            <div>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span>Processing is taking longer than expected. Refresh the page to check progress.</span>
                            </div>
                        </div>
                    `;
                    isProcessingUrl = false;
                }
            }, 120000);
            
            return true;
        }
        return false;
    }

    // Initialize
    initYouTubePlayer();
    
    // Show processing indicator or load transcript
    if (!showProcessingIndicator()) {
        loadTranscript();
    }
    
    // If there's a search query in the URL, apply it after transcript loads
    if (searchQuery) {
        const checkTranscriptInterval = setInterval(() => {
            if (transcriptSegments.length > 0) {
                clearInterval(checkTranscriptInterval);
                // Set the search input value and trigger search
                searchInput.value = searchQuery;
                performSearch();
            }
        }, 500);
        
        // Set timeout to stop checking after 10 seconds
        setTimeout(() => clearInterval(checkTranscriptInterval), 10000);
    }
});
