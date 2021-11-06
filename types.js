/**
 * @typedef {Object} Page
 * @property {string} slug - Slugified name used for the page name in the URL, e.g (my-cool-post)
 * @property {string} path - Filesystem path of where the page should be placed in the output destination
 * @property {string?} collection - Name of the collection
 * @property {string?} layout - Name of the layout to use from `_layouts` directory
 * @property {string?} title - Title of the page
 * @property {string?} date - Date the page was created
 * @property {string?} assets - Path of related page assets to be copied with the page
 * @property {string?} content - HTML content of the page
 */
