<?php

namespace CaptainCoreHelm;

class Plugin
{
  public static function boot(): void
  {
    (new self())->register();
  }

  /* ============================ Registration ============================ */

  public function register(): void
  {
    // Activation: enable Helm only for the activating user.
    register_activation_hook(CCHELM_FILE, [$this, 'onActivate']);

    // User profile opt-in/out.
    add_action('personal_options', [$this, 'renderProfileField']);
    add_action('edit_user_profile', [$this, 'renderProfileField']);
    add_action('personal_options_update', [$this, 'saveProfileField']);
    add_action('edit_user_profile_update', [$this, 'saveProfileField']);

    // Body classes.
    add_filter('admin_body_class', [$this, 'adminBodyClass'], 10, 1);
    add_filter('body_class', [$this, 'bodyClass'], 10, 1);

    // Admin bar: toggle + howdy replacement.
    add_action('admin_bar_menu', [$this, 'addAdminbarToggle'], 0);
    add_action('admin_bar_menu', [$this, 'replaceHowdy'], 9999);
    add_action('admin_bar_menu', [$this, 'changeSiteNameToDashboard'], 100);

    // Toolbar keep IDs (frontend convenience).
    add_filter('cch_toolbar_keep_ids', [$this, 'frontendKeepIds'], 9, 1);

    // Critical CSS at first paint.
    add_action('admin_head', [$this, 'printCriticalCss'], 0);
    add_action('wp_head', [$this, 'printCriticalCssFront'], 0);

    // Assets (admin + frontend for logged-in users).
    add_action('admin_enqueue_scripts', [$this, 'enqueueAdmin']);
    add_action('wp_enqueue_scripts', [$this, 'enqueueFront']);

    // Menu snapshot.
    add_action('admin_menu', [$this, 'captureMenuSnapshot'], 9999);
    add_filter('cch_menu_snapshot', [$this, 'normalizeMenuVendors'], 10, 1);
    add_filter('cch_core_menu_ids', [$this, 'frontendCoreIds'], 9, 1);

    // Editor tweaks.
    add_action(
      'enqueue_block_editor_assets',
      [$this, 'disableEditorFullscreenByDefault']
    );

    // Site Editor integration.
    add_action('load-site-editor.php', [$this, 'siteEditorInit']);

    // Customizer integration.
    add_action('customize_controls_init', [$this, 'customizerControlsInit']);
    add_action(
      'customize_controls_print_styles',
      [$this, 'customizerControlsStyles'],
      5
    );
    add_action('customize_preview_init', [$this, 'customizerPreviewInit'], 20);
    add_action(
      'customize_controls_enqueue_scripts',
      [$this, 'customizerControlsScripts'],
      20
    );

    // Theme vars: print early so CSS can consume them
    add_action('admin_head', [$this, 'printThemeVars'], 0);
    add_action('wp_head', [$this, 'printThemeVarsFront'], 0);

    // Critical CSS (already present)
    add_action('admin_head', [$this, 'printCriticalCss'], 0);
    add_action('wp_head',   [$this, 'printCriticalCssFront'], 0);

  }

  /* =========================== User preference ========================== */

  public function onActivate(): void
  {
    $uid = get_current_user_id();
    if ($uid) {
      update_user_meta($uid, 'cch_helm_enabled', '1');
    }
  }

  public function renderProfileField(\WP_User $user): void
  {
    $enabled = $this->isEnabledForUser($user->ID);
    ?>
    <table class="form-table" role="presentation">
      <tr>
        <th scope="row">
          <label for="cch_helm_enabled">
            <?php echo esc_html__(
              'CaptainCore Helm',
              'captaincore-helm'
            ); ?>
          </label>
        </th>
        <td>
          <label>
            <input
              type="checkbox"
              name="cch_helm_enabled"
              id="cch_helm_enabled"
              value="1"
              <?php checked($enabled, true); ?>
            />
            <?php echo esc_html__(
              'Use the Helm admin view (Quick Menu, compact toolbar, hidden left menu).',
              'captaincore-helm'
            ); ?>
          </label>
          <?php wp_nonce_field('cch_helm_profile', 'cch_helm_nonce'); ?>
        </td>
      </tr>
    </table>
    <?php
  }

  public function saveProfileField(int $userId): void
  {
    if (!current_user_can('edit_user', $userId)) {
      return;
    }
    if (
      !isset($_POST['cch_helm_nonce']) ||
      !wp_verify_nonce($_POST['cch_helm_nonce'], 'cch_helm_profile')
    ) {
      return;
    }
    $enabled = isset($_POST['cch_helm_enabled']) ? '1' : '0';
    update_user_meta($userId, 'cch_helm_enabled', $enabled);
  }

  private function isEnabledForUser(int $userId = 0): bool
  {
    $userId = $userId ?: get_current_user_id();
    if (!$userId) {
      return false;
    }
    $val = get_user_meta($userId, 'cch_helm_enabled', true) === '1';
    return (bool) apply_filters('cch_is_helm_enabled', $val, $userId);
  }

  private function isEnabled(): bool
  {
    return $this->isEnabledForUser(get_current_user_id());
  }

  /* ============================= Body classes =========================== */

  public function adminBodyClass(string $classes): string
  {
    if (!$this->isEnabled()) {
      return $classes;
    }
    $classes .= ' cch-hide-admin-menu cch-compact-toolbar cch-php-boot';
    return trim($classes);
  }

  public function bodyClass(array $classes): array
  {
    if (!$this->isEnabled()) {
      return $classes;
    }
    if (is_user_logged_in() && is_admin_bar_showing()) {
      $classes[] = 'cch-compact-toolbar';
      $classes[] = 'cch-php-boot';
    }
    return $classes;
  }

  /* ============================== Admin bar ============================= */

  public function addAdminbarToggle(\WP_Admin_Bar $bar): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    if (defined('WP_CLI') && WP_CLI) {
      return;
    }

    $shortcut = $this->shortcutLabel();
    $title =
      '<span class="dashicons dashicons-menu-alt" aria-hidden="true"></span>' .
      '<span class="cch-menu-text"> Menu</span>' .
      '<kbd class="cch-kbd" aria-hidden="true">' .
      esc_html($shortcut) .
      '</kbd>';

    $bar->add_node([
      'id' => 'cch-popout-toggle',
      'title' => $title,
      'href' => '#',
      'meta' => [
        'title' => 'Open Quick Menu (' . $shortcut . ')',
        'class' => 'cch-toggle',
      ],
    ]);
  }

  public function changeSiteNameToDashboard(\WP_Admin_Bar $bar): void
  {
      if (!$this->isEnabled()) {
          return;
      }

      $node = $bar->get_node('site-name');

      if ($node) {
          // Check if viewing the admin area or the frontend
          if (is_admin()) {
              $node->title = 'Home';
          } else {
              $node->title = 'Dashboard';
          }
          $bar->add_node($node);
      }
  }

  public function replaceHowdy(\WP_Admin_Bar $bar): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    $node = $bar->get_node('my-account');
    if (!$node) {
      return;
    }
    $avatar = get_avatar(get_current_user_id(), 26);
    $bar->add_node([
      'id' => 'my-account',
      'title' => 'My Account ' . $avatar,
      'href' => $node->href,
    ]);
  }

  public function frontendKeepIds(array $ids): array
  {
    if (!is_admin() && $this->isEnabled()) {
      $ids[] = 'wp-admin-bar-my-account';
      $ids[] = 'wp-admin-bar-site-name';
    }
    return $ids;
  }

  /* ============================= Critical CSS =========================== */

  public function printCriticalCss(): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    $ids = apply_filters(
      'cch_toolbar_keep_ids',
      $this->defaultToolbarKeepIds()
    );
    $css = $this->toolbarBootCss($ids);
    echo '<style id="cch-critical">' . $css . '</style>';
  }

  public function printCriticalCssFront(): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    if (!is_user_logged_in() || !is_admin_bar_showing()) {
      return;
    }
    $ids = apply_filters(
      'cch_toolbar_keep_ids',
      $this->defaultToolbarKeepIds()
    );
    $css = $this->toolbarBootCss($ids);
    echo '<style id="cch-critical">' . $css . '</style>';
  }

  private function toolbarBootCss(array $keepIds): string
  {
    $ids = array_values(
      array_unique(array_filter(array_map('strval', (array) $keepIds)))
    );
    if (empty($ids)) {
      return '';
    }

    $css = '';
    $css .=
      'body.cch-php-boot #wpadminbar ' . '#wp-admin-bar-root-default > li,';
    $css .=
      'body.cch-php-boot #wpadminbar ' . '#wp-admin-bar-top-secondary > li';
    $css .= '{display:none!important;}';

    foreach ($ids as $id) {
      $safe = preg_replace('/[^a-zA-Z0-9\-_]/', '', $id);
      if ($safe === '') {
        continue;
      }
      $css .=
        'body.cch-php-boot #wpadminbar ' .
        '#wp-admin-bar-root-default > li#' .
        $safe .
        '{display:list-item!important;}';
      $css .=
        'body.cch-php-boot #wpadminbar ' .
        '#wp-admin-bar-top-secondary > li#' .
        $safe .
        '{display:list-item!important;}';
    }

    return $css;
  }

  private function defaultToolbarKeepIds(): array
  {
    if (is_admin()) {
      return [
        'wp-admin-bar-cch-popout-toggle',
        'wp-admin-bar-site-name',
        'wp-admin-bar-new-content',
        'wp-admin-bar-comments',
        'wp-admin-bar-my-account',
        'wp-admin-bar-view',
      ];
    }
    return [
      'wp-admin-bar-cch-popout-toggle',
      'wp-admin-bar-edit',
      'wp-admin-bar-menu-toggle',
    ];
  }

  /* ================================ Assets ============================== */

  public function enqueueAdmin(): void
  {
    if (!$this->isEnabled()) {
      return;
    }

    $coreIds = apply_filters('cch_core_menu_ids', $this->defaultCoreIds());
    $toolbarKeep = apply_filters(
      'cch_toolbar_keep_ids',
      $this->defaultToolbarKeepIds()
    );

    $updatesCount = 0;
    if (function_exists('wp_get_update_data')) {
      $data = wp_get_update_data();
      $updatesCount = isset($data['counts']['plugins'])
        ? (int) $data['counts']['plugins']
        : 0;
    }

    $menuSnapshot = get_user_meta(
      get_current_user_id(),
      'cch_menu_snapshot',
      true
    );
    if (!is_array($menuSnapshot)) {
      $menuSnapshot = [];
    }

    $toolbarLabelMap = apply_filters(
      'cch_toolbar_label_map',
      ['wp-admin-bar-comments' => 'Comments']
    );
    $toolbarIconMap = apply_filters('cch_toolbar_icon_map', [
      'wp-admin-bar-site-name' => 'dashicons-admin-home',
      'wp-admin-bar-new-content' => 'dashicons-plus',
      'wp-admin-bar-comments' => 'dashicons-admin-comments',
      'wp-admin-bar-updates' => 'dashicons-update',
      'wp-admin-bar-customize' => 'dashicons-admin-customize',
      'wp-admin-bar-search' => 'dashicons-search',
      'wp-admin-bar-my-account' => 'dashicons-admin-users',
      'wp-admin-bar-edit' => 'dashicons-edit',
    ]);
    $toolbarSkipIds = apply_filters(
      'cch_toolbar_skip_ids',
      ['wp-admin-bar-menu-toggle', 'wp-admin-bar-search']
    );

    // File-based CSS/JS.
    wp_enqueue_style('cch-helm', CCHELM_URL . 'assets/css/helm.css', [], CCHELM_VER);
    wp_enqueue_style('dashicons');

    $config = [
      'coreIds' => array_values($coreIds),
      'toolbarKeepIds' => array_values($toolbarKeep),
      'updatesCount' => (int) $updatesCount,
      'menuSnapshot' => $menuSnapshot,
      'toolbarLabelMap' => $toolbarLabelMap,
      'toolbarIconMap' => $toolbarIconMap,
      'toolbarSkipIds' => array_values($toolbarSkipIds),
    ];

    wp_register_script(
      'cch-helm',
      CCHELM_URL . 'assets/js/helm.js',
      [],
      CCHELM_VER,
      true
    );
    wp_enqueue_script('cch-helm');

    wp_add_inline_script(
      'cch-helm',
      'window.CCHELM_CONFIG = ' . wp_json_encode($config) . ';',
      'before'
    );
  }

  public function enqueueFront(): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    if (!is_user_logged_in() || !is_admin_bar_showing()) {
      return;
    }

    $coreIds = apply_filters('cch_core_menu_ids', []);
    $toolbarKeep = apply_filters(
      'cch_toolbar_keep_ids',
      $this->defaultToolbarKeepIds()
    );

    $updatesCount = 0;
    if (function_exists('wp_get_update_data')) {
      $data = wp_get_update_data();
      $updatesCount = isset($data['counts']['plugins'])
        ? (int) $data['counts']['plugins']
        : 0;
    } else {
      $updates = get_site_transient('update_plugins');
      if (isset($updates->response) && is_array($updates->response)) {
        $updatesCount = (int) count($updates->response);
      }
    }

    $menuSnapshot = get_user_meta(
      get_current_user_id(),
      'cch_menu_snapshot',
      true
    );
    if (!is_array($menuSnapshot)) {
      $menuSnapshot = [];
    }

    wp_enqueue_style('cch-helm', CCHELM_URL . 'assets/css/helm.css', [], CCHELM_VER);
    wp_enqueue_style('dashicons');

    $config = [
      'coreIds' => array_values($coreIds),
      'toolbarKeepIds' => array_values($toolbarKeep),
      'updatesCount' => (int) $updatesCount,
      'menuSnapshot' => $menuSnapshot,
    ];

    wp_register_script(
      'cch-helm',
      CCHELM_URL . 'assets/js/helm.js',
      [],
      CCHELM_VER,
      true
    );
    wp_enqueue_script('cch-helm');

    wp_add_inline_script(
      'cch-helm',
      'window.CCHELM_CONFIG = ' . wp_json_encode($config) . ';',
      'before'
    );
  }

  private function defaultCoreIds(): array
  {
    return [
      'menu-dashboard',
      'menu-posts',
      'menu-media',
      'menu-pages',
      'menu-comments',
      'menu-appearance',
      'menu-plugins',
      'menu-users',
      'menu-tools',
      'menu-settings',
    ];
  }

  /* ============================ Menu snapshot =========================== */

  public function captureMenuSnapshot(): void
  {
    if (!is_user_logged_in()) {
      return;
    }
    $snapshot = $this->buildMenuSnapshot();
    if ($snapshot) {
      update_user_meta(get_current_user_id(), 'cch_menu_snapshot', $snapshot);
    }
  }

  public function normalizeMenuVendors(array $items): array
  {
    foreach ($items as &$it) {
      // Gravity Forms label normalization (existing)
      $isGfId =
        isset($it['id']) && $it['id'] === 'toplevel_page_gf_edit_forms';
      $isGfSlug = false;
      if (!empty($it['href'])) {
        $q = [];
        $query = parse_url($it['href'], PHP_URL_QUERY);
        if ($query) {
          parse_str($query, $q);
          $isGfSlug = isset($q['page']) && $q['page'] === 'gf_edit_forms';
        }
      }
      if ($isGfId || $isGfSlug) {
        $it['label'] = 'Gravity Forms';
      }

      // WooCommerce: fix dead top-level links
      if (!empty($it['id'])) {
        // Marketing → wc-admin marketing app
        if ($it['id'] === 'toplevel_page_woocommerce-marketing') {
          $target = admin_url('admin.php?page=wc-admin&path=/marketing');
          $it['href'] = !empty($it['subs'][0]['href'])
            ? $it['subs'][0]['href']
            : $target;
        }

        // Main WooCommerce → wc-admin home (defensive normalization)
        if ($it['id'] === 'toplevel_page_woocommerce') {
          $target = admin_url('admin.php?page=wc-admin');
          // Prefer first submenu if Woo already points there
          $it['href'] = !empty($it['subs'][0]['href'])
            ? $it['subs'][0]['href']
            : $target;
        }
      }
    }
    unset($it);

    return $items;
  }

  public function frontendCoreIds(array $ids): array
  {
    if (is_admin()) {
      return $ids;
    }
    return $this->defaultCoreIds();
  }

  private function buildMenuSnapshot(): array
  {
    global $menu, $submenu;

    if (!is_array($menu) || empty($menu)) {
      return [];
    }

    $items = [];

    foreach ($menu as $m) {
      $classes = isset($m[4]) ? (string) $m[4] : '';
      if (strpos($classes, 'wp-menu-separator') !== false) {
        continue;
      }

      $id = isset($m[5]) ? (string) $m[5] : '';
      $rawLabel = isset($m[0]) ? (string) $m[0] : '';
      $label = $this->cleanLabel($rawLabel);

      $slug = isset($m[2]) ? (string) $m[2] : '';
      $href =
        strpos($slug, '.php') !== false ||
        strpos($slug, 'admin.php') !== false ||
        strpos($slug, 'edit.php') !== false
          ? admin_url($slug)
          : admin_url('admin.php?page=' . $slug);

      $iconClass = '';
      if (!empty($m[6]) && is_string($m[6])) {
        $iconClass = $m[6];
      }

      $subs = [];
      if (!empty($submenu[$slug]) && is_array($submenu[$slug])) {
        foreach ($submenu[$slug] as $s) {
          $subLabel = $this->cleanLabel($s[0] ?? '');
          $target = (string) ($s[2] ?? '');
          $subHref = $this->makeAdminHref($target, $slug);

          // Skip empty or invalid submenu links.
          if ($subLabel === '' || $subHref === admin_url('admin.php?page=')) {
            continue;
          }

          // NEW: skip submenu links the user cannot access (e.g. legacy).
          if (!$this->canAccessHref($subHref)) {
            continue;
          }

          $subs[] = [
            'label' => $subLabel,
            'href' => esc_url_raw($subHref),
          ];
        }
      }

      // Skip empty or invalid top-level links early.
      if ($label === '' || $href === admin_url('admin.php?page=')) {
        continue;
      }

      // NEW: only keep a card if top-level is accessible or it has
      // at least one accessible sub-link.
      $topOk = $this->canAccessHref($href);
      if (!$topOk && empty($subs)) {
        continue;
      }

      $items[] = [
        'id' => $id,
        'label' => $label,
        'href' => esc_url_raw($href),
        'iconClass' => $iconClass,
        'subs' => $subs,
      ];
    }

    return apply_filters('cch_menu_snapshot', $items);
  }

  private function makeAdminHref(string $target, string $parentSlug): string
  {
    $t = ltrim($target, '/');

    // Absolute URL
    if (preg_match('#^https?://#i', $t)) {
      return esc_url_raw($t);
    }

    // Treat these as complete admin paths (keep any query string)
    $starts = [
      'admin.php',
      'index.php',
      'edit.php',
      'upload.php',
      'themes.php',
      'plugins.php',
      'post-new.php',
      'users.php',
      'user-new.php',
      'tools.php',
      'options-general.php',
      'options-writing.php',
      'options-reading.php',
      'options-discussion.php',
      'options-media.php',
      'options-permalink.php',
      'options-privacy.php',
      'customize.php',
      'site-editor.php',
      'theme-editor.php',
      'nav-menus.php',
      'widgets.php',
      'media-new.php',
      'edit-comments.php',
      'edit-tags.php',
      'update-core.php',
      'profile.php',
      'plugin-install.php',
      'plugin-editor.php',
      'theme-install.php',

      // Add these core Tools endpoints so they stay direct:
      'site-health.php',
      'import.php',
      'export.php',
      'export-personal-data.php',
      'erase-personal-data.php',
    ];
    foreach ($starts as $p) {
      if (stripos($t, $p) === 0) {
        return esc_url_raw(admin_url($t));
      }
    }

    // Bare .php (plugin screens like redirection.php) → route via parent
    // if parent is a .php screen
    $isBarePhp = substr($t, -4) === '.php' && strpos($t, '/') === false;
    if ($isBarePhp && strpos($parentSlug, '.php') !== false) {
      return esc_url_raw(admin_url($parentSlug . '?page=' . $t));
    }

    // Default: admin.php?page=child
    return esc_url_raw(admin_url('admin.php?page=' . $t));
  }

  private function cleanLabel(string $labelHtml): string
  {
    $labelHtml = preg_replace(
      '#<span[^>]*class=("|\')[^"\']*' .
        '(screen-reader-text|awaiting-mod|update-plugins|count-[^"\']*)' .
        '[^"\']*\\1[^>]*>.*?</span>#si',
      '',
      (string) $labelHtml
    );

    $label = wp_strip_all_tags($labelHtml);
    $label = html_entity_decode($label, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $label = preg_replace('/\s+/u', ' ', trim($label));
    $label = preg_replace(
      '/(?:[\s\x{00A0}]*[()\[\]•·|:\-\x{2013}\x{2014}]*)?\d+(?:\+)?$/u',
      '',
      $label
    );
    $label = preg_replace('/\b\d+\s+.*in moderation\b/i', '', $label);

    return trim($label);
  }

  /* ============================ Editor tweaks =========================== */

  public function disableEditorFullscreenByDefault(): void
  {
    if (!is_admin() || !$this->isEnabled()) {
      return;
    }
    $script =
      "jQuery( window ).load(function() { const isFullscreenMode = wp.data.select( 'core/edit-post' ).isFeatureActive( 'fullscreenMode' ); if ( isFullscreenMode ) { wp.data.dispatch( 'core/edit-post' ).toggleFeature( 'fullscreenMode' ); } });";
    wp_add_inline_script('wp-blocks', $script);
  }

  public function siteEditorInit(): void
  {
    if (!$this->isEnabled()) {
      return;
    }

    // Always show the admin bar on Site Editor.
    add_filter('show_admin_bar', '__return_true', PHP_INT_MAX);

    // Ensure core admin bar classes are available.
    require_once ABSPATH . WPINC . '/class-wp-admin-bar.php';
    require_once ABSPATH . WPINC . '/admin-bar.php';

    // Styles + bump + Helm’s critical CSS.
    add_action('admin_head', [$this, 'siteEditorHeadStyles'], 5);

    // Admin bar behavior (optional, but nice to have).
    add_action('admin_enqueue_scripts', function (): void {
      wp_enqueue_script('admin-bar');
    }, 5);

    // Render the admin bar markup late so menus/filters are in place.
    add_action('admin_footer', [$this, 'siteEditorRenderAdminBar'], PHP_INT_MAX);
  }

  public function siteEditorHeadStyles(): void
  {
    if (!$this->isEnabled()) {
      return;
    }

    wp_enqueue_style('admin-bar');
    wp_enqueue_style('dashicons');

    if (function_exists('_admin_bar_bump_cb')) {
      _admin_bar_bump_cb();
    } else {
      echo '<style>
        html.wp-toolbar { padding-top: 32px !important; }
        @media (max-width: 782px) {
          html.wp-toolbar { padding-top: 46px !important; }
        }
      </style>';
    }

    // Force visibility for the admin bar
    echo '<style>
      #wpadminbar{ display:flex !important; }
    </style>';

    // 🧱 Site Editor canvas spacing
    echo '<style>
      .edit-site { margin-top: 32px; }
      @media (max-width: 782px) {
        .edit-site { margin-top: 46px; }
      }
    </style>';

    // Critical shaping CSS from Helm
    $ids = apply_filters('cch_toolbar_keep_ids', $this->defaultToolbarKeepIds());
    $css = $this->toolbarBootCss($ids);
    echo '<style id="cch-critical">' . $css . '</style>';
  }

  /* ========================== Site editor support ======================== */

  public function siteEditorRenderAdminBar(): void
  {
    if (!$this->isEnabled()) {
      return;
    }

    global $wp_admin_bar;

    // Initialize and render the admin bar just like core’s normal flow.
    $wp_admin_bar = new \WP_Admin_Bar();
    $wp_admin_bar->initialize();
    $wp_admin_bar->add_menus();

    // Allow existing menu customizations (including Helm’s toggle/howdy replacement).
    do_action_ref_array('admin_bar_menu', [ &$wp_admin_bar ]);

    // Finally, output the toolbar markup.
    $wp_admin_bar->render();
  }

  /* ========================== Customizer support ======================== */

  public function customizerControlsInit(): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    add_filter('show_admin_bar', '__return_true', PHP_INT_MAX);
    require_once ABSPATH . WPINC . '/class-wp-admin-bar.php';
    require_once ABSPATH . WPINC . '/admin-bar.php';

    add_action(
      'customize_controls_print_scripts',
      function (): void {
        wp_enqueue_script('admin-bar');
      },
      5
    );

    add_action(
      'customize_controls_print_footer_scripts',
      function (): void {
        global $wp_admin_bar;
        $wp_admin_bar = new \WP_Admin_Bar();
        $wp_admin_bar->initialize();
        $wp_admin_bar->add_menus();
        do_action_ref_array('admin_bar_menu', [ &$wp_admin_bar ]);
        $wp_admin_bar->render();
      },
      PHP_INT_MAX
    );
  }

  public function customizerControlsStyles(): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    wp_enqueue_style('admin-bar');
    wp_enqueue_style('dashicons');

    if (function_exists('_admin_bar_bump_cb')) {
      _admin_bar_bump_cb();
    } else {
      echo '<style>
        html.wp-customizer { padding-top: 32px !important; }
        @media (max-width: 782px) {
          html.wp-customizer { padding-top: 46px !important; }
        }
      </style>';
    }

    echo '<style>.wp-customizer #wpadminbar{display:flex!important;}</style>';

    // Print the critical CSS used for toolbar shaping within controls frame.
    $ids = apply_filters(
      'cch_toolbar_keep_ids',
      $this->defaultToolbarKeepIds()
    );
    $css = $this->toolbarBootCss($ids);
    echo '<style id="cch-critical">' . $css . '</style>';
  }

  public function customizerPreviewInit(): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    $js = <<<JS
(function (api) {
  if (window.__CCHELM_boundPreviewShortcut) return;
  window.__CCHELM_boundPreviewShortcut = true;
  const isMac = () =>
    /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
    /Mac/i.test(navigator.platform || '');
  const isOpenShortcut = (e) => {
    if (!e.shiftKey || e.altKey) return false;
    const period = (e.code && e.code.toLowerCase() === 'period') || e.keyCode === 190;
    if (!period) return false;
    return isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  };
  api.bind('preview-ready', function () {
    window.addEventListener(
      'keydown',
      function (e) {
        if (!isOpenShortcut(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        api.preview.send('cch:toggle');
      },
      true
    );
    document.addEventListener(
      'click',
      function (e) {
        const a = e.target.closest('#wp-admin-bar-cch-popout-toggle > .ab-item');
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        api.preview.send('cch:toggle');
      },
      true
    );
  });
})(wp.customize);
JS;
    wp_add_inline_script('customize-preview', $js);
  }

  public function customizerControlsScripts(): void
  {
    if (!$this->isEnabled()) {
      return;
    }
    $js = <<<JS
(function (api) {
  if (window.__CCHELM_boundControlsListener) return;
  window.__CCHELM_boundControlsListener = true;
  function triggerToggle() {
    var a = document.querySelector('#wp-admin-bar-cch-popout-toggle > .ab-item');
    if (a) a.click();
  }
  api.bind('ready', function () {
    api.previewer.bind('cch:toggle', function () {
      triggerToggle();
    });
  });
})(wp.customize);
JS;
    wp_add_inline_script('customize-controls', $js);
  }

  /* ============================== Utilities ============================= */

  /**
   * Check whether the current user can access a given admin URL.
   *
   * This filters legacy or non-UI endpoints (e.g. Links/Link Categories)
   * and mirrors WP capabilities for common routes.
   */
  private function canAccessHref(string $href): bool
  {
    $p = wp_parse_url($href);
    if (!is_array($p) || empty($p['path'])) {
      return true;
    }

    $path = ltrim((string) $p['path'], '/');
    $q = [];
    if (!empty($p['query'])) {
      parse_str((string) $p['query'], $q);
    }

    // Taxonomy terms screens (edit-tags.php?taxonomy=...)
    if ($path === 'wp-admin/edit-tags.php') {
      $taxName = isset($q['taxonomy']) ? (string) $q['taxonomy'] : '';
      $tax = $taxName !== '' ? get_taxonomy($taxName) : null;
      if (!$tax) {
        return false;
      }
      if ( $taxName === 'link_category' ) {
        $enabled = (bool) get_option('link_manager_enabled');
        return $enabled && current_user_can('manage_links');
      }
      $showUi = isset($tax->show_ui) ? (bool) $tax->show_ui : true;
      $cap =
        isset($tax->cap->manage_terms) && is_string($tax->cap->manage_terms)
          ? $tax->cap->manage_terms
          : 'manage_categories';
      return $showUi && current_user_can($cap);
    }

    // Legacy Links manager.
    if ($path === 'wp-admin/link-manager.php' || ( $path === "wp-admin/admin.php" && isset($q['page']) && $q['page'] === 'edit-tags.php?taxonomy=link_category' ) ) {
      $enabled = (bool) get_option('link_manager_enabled');
      return $enabled && current_user_can('manage_links');
    }

    // Post type lists (edit.php or edit.php?post_type=...).
    if ($path === 'wp-admin/edit.php') {
      $pt =
        isset($q['post_type']) && is_string($q['post_type'])
          ? get_post_type_object($q['post_type'])
          : get_post_type_object('post');
      if (!$pt) {
        return false;
      }
      $showUi = isset($pt->show_ui) ? (bool) $pt->show_ui : true;
      $cap =
        isset($pt->cap->edit_posts) && is_string($pt->cap->edit_posts)
          ? $pt->cap->edit_posts
          : 'edit_posts';
      return $showUi && current_user_can($cap);
    }

    // Otherwise, allow.
    return true;
  }

  private function isMacUa(?string $ua = null): bool
  {
    $ua = $ua ?? ($_SERVER['HTTP_USER_AGENT'] ?? '');
    $ua = strtolower((string) $ua);
    if ($ua === '') {
      return false;
    }
    if (
      strpos($ua, 'macintosh') !== false ||
      strpos($ua, 'mac os x') !== false ||
      strpos($ua, 'iphone') !== false ||
      strpos($ua, 'ipad') !== false ||
      strpos($ua, 'ipod') !== false
    ) {
      return true;
    }
    return false;
  }

  private function shortcutLabel(): string
  {
    return $this->isMacUa() ? '⌘⇧.' : 'Ctrl+Shift+.';
  }

  /* ======================= Admin color scheme vars ======================= */

  private function schemeColors(): array {
  
    // Pull the user's selected admin color scheme
    $scheme = get_user_option('admin_color', get_current_user_id());
    if (!$scheme) { $scheme = 'fresh'; }

    // Access WP’s registered admin color schemes
    global $_wp_admin_css_colors;
    
    $colors = []; // Initialize as an empty array
    if (isset($_wp_admin_css_colors[$scheme]) && !empty($_wp_admin_css_colors[$scheme]->colors)) {
      $colors = (array) $_wp_admin_css_colors[$scheme]->colors;
    }
    
    return [
      'raw'       => $colors, // Pass the original color array
    ];
  }

  public function printThemeVars(): void {
    if (!$this->isEnabled()) {
      return;
    }
    $c = $this->schemeColors();
    // Scope to body so frontend + admin both inherit safely.
    $css = '<style id="cch-theme-vars">body{';

    // Loop through the raw colors and create a CSS var for each
    if (!empty($c['raw']) && is_array($c['raw'])) {
        foreach ($c['raw'] as $index => $color) {
            $css .= '--cch-color-' . intval($index) . ':' . esc_html(trim($color)) . ';';
        }
    }

    $css .= '}</style>';
    
    echo $css;
  }

  public function printThemeVarsFront(): void {
    if (!$this->isEnabled()) { return; }
    if (!is_user_logged_in() || !is_admin_bar_showing()) { return; }
    $this->printThemeVars();
  }

}