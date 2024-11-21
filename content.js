//Amazon Power Filter
//by Normand Defayette
//Cortex R&D Inc

// Send a message to confirm the content script is loaded
chrome.runtime.sendMessage({ action: "contentScriptLoaded" });

// Listen for messages from the popup
// In your existing message listener, update the getVisibleCount handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);
    if (request.action === "applyFilter") {
        filterElements(request.config);  // config will now contain 'words' instead of keepWords/removeWords
        sendResponse({ success: true });
    } else if (request.action === "clearFilter") {
        clearFilter();
        sendResponse({ success: true });
    } else if (request.action === "getVisibleCount") {
        // Count only product items that are visible
        const allItems = document.querySelectorAll('div[data-asin]');
        const relatedSearchesContainer = findRelatedSearchesContainer();

        const visibleCount = Array.from(allItems).filter(element => {
            // Exclude related searches and pagination
            if ((relatedSearchesContainer && element === relatedSearchesContainer) ||
                element.querySelector('[cel_widget_id*="MAIN-PAGINATION"]') ||
                element.closest('[cel_widget_id*="MAIN-PAGINATION"]')) {
                return false;
            }

            // Only count elements that aren't hidden
            return !element.classList.contains('amazon-filter-hidden');
        }).length;

        console.log("Visible product items count:", visibleCount);
        sendResponse(visibleCount);
    }
    return true;
});

function findRelatedSearchesContainer() {
    const relatedSearchesHeading = Array.from(document.querySelectorAll('h2')).find(h2 =>
        h2.textContent.toLowerCase().includes('related searches')
    );

    if (relatedSearchesHeading) {
        return relatedSearchesHeading.closest('div[data-asin]');
    }
    return null;
}

function filterElements(config = {
    selector: 'div[data-asin]',
    words: [],  // Now we'll receive a single array of words with +/- prefixes
    removeSelectors: []
}) {
    console.log("Applying filter with config:", config);
    if (!document.getElementById('amazon-filter-style')) {
        const style = document.createElement('style');
        style.id = 'amazon-filter-style';
        style.textContent = '.amazon-filter-hidden { display: none !important; }';
        document.head.appendChild(style);
    }

    const relatedSearchesContainer = findRelatedSearchesContainer();
    const elements = document.querySelectorAll(config.selector);
    console.log("Found elements:", elements.length);

    elements.forEach(element => {
        if ((relatedSearchesContainer && element === relatedSearchesContainer) ||
            element.querySelector('[cel_widget_id*="MAIN-PAGINATION"]') ||
            element.closest('[cel_widget_id*="MAIN-PAGINATION"]')) {
            console.log("Preserving special section:", element);
            return;
        }

        const text = element.textContent.toLowerCase();

        // Split words into required, excluded, and optional
        const requiredWords = config.words
            .filter(word => word.startsWith('+'))
            .map(word => word.slice(1).toLowerCase());

        const excludedWords = config.words
            .filter(word => word.startsWith('-'))
            .map(word => word.slice(1).toLowerCase());

        const optionalWords = config.words
            .filter(word => !word.startsWith('+') && !word.startsWith('-'))
            .map(word => word.toLowerCase());

        // Element must contain ALL required words
        const hasAllRequired = requiredWords.length === 0 ||
            requiredWords.every(word => text.includes(word));

        // Element must not contain ANY excluded words
        const hasNoExcluded = excludedWords.length === 0 ||
            !excludedWords.some(word => text.includes(word));

        // If there are optional words, element must contain at least one
        const hasOptional = optionalWords.length === 0 ||
            optionalWords.some(word => text.includes(word));

        // Show element only if it meets all conditions
        if (hasAllRequired && hasNoExcluded && hasOptional) {
            element.classList.remove('amazon-filter-hidden');
        } else {
            element.classList.add('amazon-filter-hidden');
        }
    });

    // Rest of your removeSelectors code remains the same
    if (config.removeSelectors && config.removeSelectors.length > 0) {
        config.removeSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (!(relatedSearchesContainer && element === relatedSearchesContainer) &&
                    !element.querySelector('[cel_widget_id*="MAIN-PAGINATION"]') &&
                    !element.closest('[cel_widget_id*="MAIN-PAGINATION"]')) {
                    element.classList.add('amazon-filter-hidden');
                }
            });
        });
    }
}

function clearFilter() {
    console.log("Clearing filter");
    // Remove the custom style
    const styleElement = document.getElementById('amazon-filter-style');
    if (styleElement) {
        styleElement.remove();
    }

    // Show all previously hidden elements
    document.querySelectorAll('.amazon-filter-hidden').forEach(element => {
        element.classList.remove('amazon-filter-hidden');
    });
}

