// Send a message to confirm the content script is loaded
chrome.runtime.sendMessage({ action: "contentScriptLoaded" });

// Listen for messages from the popup
// In your existing message listener, update the getVisibleCount handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received in content script:", request);
    if (request.action === "applyFilter") {
        filterElements(request.config);
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
    removeWords: [],
    keepWords: [],
    removeSelectors: []
}) {
    console.log("Applying filter with config:", config);
    if (!document.getElementById('amazon-filter-style')) {
        const style = document.createElement('style');
        style.id = 'amazon-filter-style';
        style.textContent = '.amazon-filter-hidden { display: none !important; }';
        document.head.appendChild(style);
    }

    const relatedSearchesContainer = findRelatedSearchesContainer(); //Keep this useful div.

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

        const shouldRemove = config.removeWords.some(word =>
            text.includes(word.toLowerCase())
        );

        const shouldKeep = config.keepWords.length === 0 || config.keepWords.some(word =>
            text.includes(word.toLowerCase())
        );

        if (shouldRemove || !shouldKeep) {
            element.classList.add('amazon-filter-hidden');
        } else {
            element.classList.remove('amazon-filter-hidden');
        }
    });

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

