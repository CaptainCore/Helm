# Changelog

## 0.3.0 - 2025-08-12

### Added

* **Etch Editor Integration:** Helm now ensures the admin bar remains visible and functional within the Etch editor interface.
* **Fallback Admin Color Schemes:** A set of default admin color schemes is now included within the plugin to ensure UI consistency even when WordPress's color scheme data is not available.

### Changed

* **Updater Versioning:** The plugin updater now dynamically uses the `CCHELM_VER` constant for the version number instead of a hardcoded value.
* **Admin Bar Styling:** The admin bar background now uses the user's selected color scheme. Item hover and focus colors in the admin bar also adapt to the user's theme for better integration.

### Fixed

* **Updater Stability:** The updater is now more robust, preventing errors if the remote request for the manifest fails by returning the original transient data. It also adds required properties to the `no_update` transient to prevent warnings in WP-CLI.
* **Admin Color Scheme Loading:** The plugin now proactively registers admin color schemes on the frontend if they haven't been loaded, ensuring custom colors are available outside of the admin area.

## 0.2.0 - 2025-08-11

### Added

* **Admin Color Scheme Integration:** The Quick Menu and other UI elements now adapt to the user's selected WordPress admin color scheme for a more personalized and integrated experience. This is achieved by dynamically generating CSS variables based on the active scheme's colors.

### Changed

* **UI Styling:**
    * The hover-state border color for the keyboard shortcut hint in the admin bar now uses the accent color from the user's admin theme.
    * The selected view toggle button (`Cards` or `Expanded`) in the Quick Menu now uses the theme's accent color for its background.
    * The main popout menu is now properly inset below the admin bar instead of covering the full screen.
* **Code Optimization:**
    * Removed a duplicate action hook for printing critical CSS on the frontend, streamlining asset loading.

## 0.1.0 - 2025-08-10

### Added

* **Initial Release** of CaptainCore Helm
* **Quick Menu:** A new pop-out menu for fast access to all admin areas, accessible via a "Menu" button in the admin bar or with a keyboard shortcut (`Ctrl+Shift+.` or `⌘⇧.`).
* **Compact Admin Bar:** The WordPress admin bar is redesigned to be more compact, keeping essential items visible while hiding others for a cleaner look.
* **Left Menu Hiding:** The default WordPress admin menu on the left side is hidden to provide more content space.
* **User Preference:** Users can enable or disable the Helm admin view via a new option in their user profile.
* **Search and Filter:** The Quick Menu includes a real-time search bar to quickly filter menu items.
* **Two Viewing Modes:** The Quick Menu offers a "Cards" view and an "Expanded" list view for navigating admin items (`⌘ + arrow keys`) and selecting with (`enter` or `return`).
* **Site Editor & Customizer Integration:** Helm ensures the admin bar remains visible and functional within the Site Editor and Customizer interfaces.
* **Editor Fullscreen Disabled:** Fullscreen editing is disabled by default for a more traditional editing experience.
* **Keyboard Navigation:** The Quick Menu supports keyboard navigation for moving between cards and lists.
* **External Link Indicators:** External links within the Quick Menu are automatically detected and marked with an icon.
* **Automatic Updates:** The plugin includes an updater to fetch new releases from its GitHub repository.