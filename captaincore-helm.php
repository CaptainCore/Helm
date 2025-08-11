<?php
/**
 * Plugin Name:  CaptainCore Helm
 * Description:  Take the helm of your WordPress admin.
 * Version:      0.2.0
 * Author:       CaptainCore
 * Author URI:   https://captaincore.io
 * License:      MIT License
 * License URI:  https://opensource.org/licenses/MIT
 * Text Domain:  captaincore-helm
 */

if (!defined('ABSPATH')) {
  exit;
}

define('CCHELM_VER', '0.2.0');
define('CCHELM_FILE', __FILE__);
define('CCHELM_DIR', plugin_dir_path(__FILE__));
define('CCHELM_URL', plugin_dir_url(__FILE__));

require_once __DIR__ . '/vendor/autoload.php';

CaptainCoreHelm\Plugin::boot();
CaptainCoreHelm\Updater::boot();