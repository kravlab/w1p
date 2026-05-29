# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-05-29

### Bug Fixes

- _(pwa)_ Normalize shared search text to remove redundant URLs
- _(pwa)_ Improve shared search parameter handling
- _(pwa)_ Prevent scroll chaining when side drawer is open

### Features

- _(pwa)_ Add ability to dismiss update banner
- _(pwa)_ Implement manual update checking
- _(pwa)_ Add text selection search capability
- _(ui)_ Add clear search button and improve toolbar layout
- _(release)_ Implement automated version bumping via conventional commits

### Miscellaneous Tasks

- Sync develop with main release v0.2.0
- Update test coverage reporters and gitignore

### Refactor

- _(pwa)_ Deduplicate word headings in search results
- _(shared)_ Extend SharedComponent to support subtitles

### Styling

- _(ui)_ Improve responsive layout and viewport handling in pwa

### Build

- _(deps)_ Integrate sonarcloud and streamline pre-commit workflow

## [0.2.0] - 2026-05-18

### Miscellaneous Tasks

- Release v0.2.0

## [0.1.1] - 2026-05-18

### Bug Fixes

- _(shared)_ Implement custom error handling for dictionary API
- _(pwa)_ Improve URL parsing and translation key uniqueness
- _(pwa)_ Use relative paths for assets and scripts in index.html
- _(pwa)_ Dismiss save menu on outside click
- _(pwa)_ Add confirmation dialog before deleting custom translations

### Dependencies

- _(deps)_ Bump version to 0.1.0 across workspace
- _(deps)_ Add git-cliff and initialize cliff.toml

### Documentation

- Add project documentation and license
- Rename project from "PWA + Extension Monorepo" to "w1p"
- Initialize changelog file

### Features

- _(pwa)_ Add system status indicator to App component
- _(shared)_ Implement dictionary API client and search UI
- _(shared)_ Add caching layer to dictionary API client
- _(ui)_ Implement navigation drawer and update i18n keys
- _(shared)_ Add logging utility for dictionary operations
- _(pwa)_ Implement log history view
- _(pwa)_ Add log grouping and JSON export functionality
- _(shared)_ Add source tracking to dictionary search results
- _(pwa)_ Implement cache management interface
- _(pwa)_ Add interaction controls to cache management
- _(pwa)_ Display source URLs in cache management
- _(pwa)_ Add search functionality to cache management
- _(pwa)_ Improve log entry visualization with semantic badges
- _(pwa)_ Add confirmation dialog for clearing log history
- _(dictionary)_ Support and display word translations
- _(dictionary)_ Implement optional translation fetching
- _(dictionary)_ Add support for specific translation languages
- _(pwa)_ Implement client-side translation filtering
- _(pwa)_ Implement persistent storage management
- _(shared)_ Move logging logic to shared package
- _(pwa)_ Implement runtime error and unhandled rejection logging
- _(pwa)_ Hide language names when a single language is selected
- _(shared)_ Implement saved senses functionality
- _(pwa)_ Integrate saved senses UI and management
- _(pwa)_ Add search functionality to saved senses
- _(pwa)_ Add sorting options to saved senses
- _(pwa)_ Implement build metadata injection and display
- _(pwa)_ Implement update prompt for new service worker versions
- _(ui)_ Implement data management for saved senses
- _(pwa)_ Allow saving definitions with custom translations
- _(pwa)_ Replace 'custom' translation code with selected language code
- _(pwa)_ Add edit and delete functionality for custom translations
- _(pwa)_ Persist search state via localStorage
- _(pwa)_ Implement dynamic styling for search result save buttons
- _(pwa)_ Implement sticky search controls for improved usability
- _(pwa)_ Add ability to reopen saved senses
- _(shared)_ Implement search history tracking
- _(pwa)_ Add log source filtering to dictionary logs
- _(pwa)_ Implement dynamic visibility for search controls on scroll
- _(pwa)_ Add back-to-top button functionality

### Miscellaneous Tasks

- _(docs)_ Update changelog and bump version to 0.1.1
- Add release versioning script
- Release v0.1.1

### Refactor

- _(ui)_ Clean up App component and restrict debug footer
- _(shared)_ Update dictionary API client and i18n logic
- _(pwa)_ Add filtering and search capabilities to log history
- _(shared)_ Update dictionary response structure and add attribution
- _(pwa)_ Enhance cache management UX and safety
- _(dictionary)_ Simplify dictionary URL construction
- _(pwa)_ Categorize log entries into distinct sections
- _(pwa)_ Implement toggle functionality for saved senses
- _(pwa)_ Simplify build SHA formatting logic
- _(pwa)_ Improve installation UI and drawer behavior
- _(pwa)_ Implement retrieval and display of user-saved custom translations
- _(shared)_ Implement upsert logic for saved senses
- _(pwa)_ Standardize search result action button dimensions
- _(pwa)_ Reorganize side menu with development section
- _(pwa)_ Simplify shared data handling and focus on search prefill

### Styling

- _(ui)_ Remove responsive visibility classes from drawer components
- _(ui)_ Update styling for delete button in saved senses
- _(pwa)_ Refine sticky search container layout and spacing

### Testing

- _(shared)_ Add vitest testing infrastructure and initial tests
- _(pwa, extension)_ Implement vitest testing suite
- _(pwa)_ Add integration tests for dictionary and cache workflows
- _(shared)_ Expand test coverage for core utilities
- Improve test coverage and enforce coverage thresholds

### Build

- Setup development environment and tooling
- _(pwa)_ Update manifest icons and screenshots
- _(release)_ Update changelog script to include version tag
- Setup vitest coverage and upgrade vitest dependencies

### Ci

- _(pwa)_ Add github actions workflow for automated deployment
- _(pwa)_ Enhance deployment pipeline and manifest path handling
- _(pwa)_ Configure VITE_APP_PATH for manifest identity

### Config

- _(cliff)_ Customize for conventional commits and monorepo scopes

### Init

- Initial commit

<!-- generated by git-cliff -->
