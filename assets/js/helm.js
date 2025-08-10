/* CaptainCore Helm – JS */

(() => {
    const CFG = window.CCHELM_CONFIG || {};
    const CORE_IDS = new Set(CFG.coreIds || []);
    const TOOLBAR_KEEP = new Set(CFG.toolbarKeepIds || []);
    const UPDATES_COUNT = Number(CFG.updatesCount || 0);
    const VIEW_KEY = 'cch:view'; // 'cards' | 'expanded'

    const qs = (sel, ctx = document) => ctx.querySelector(sel);
    const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    const isMac = () => {
        const ua = navigator.userAgent || '';
        const plt = navigator.platform || '';
        return /Mac|iPhone|iPad|iPod/i.test(ua) || /Mac/i.test(plt);
    };

    const applyExternalLinkStyles = (element, href) => {
        try {
            // Resolve the href to a full URL
            const linkUrl = new URL(href, window.location.origin);
            // Check if the link's hostname is different from the site's hostname
            if (linkUrl.hostname !== window.location.hostname) {
                element.target = '_blank';
                element.rel = 'noopener noreferrer'; // Security best practice
                return true; // It's an external link
            }
        } catch (e) {
            // Invalid URL, do nothing
        }
        return false; // It's an internal link
    };

    const getShortcutLabel = () => (isMac() ? '⌘⇧.' : 'Ctrl+Shift+.');

    const isOpenShortcut = (e) => {
        if (!e.shiftKey || e.altKey) return false;
        const periodPressed =
            (e.code && e.code.toLowerCase() === 'period') || e.keyCode === 190;
        if (!periodPressed) return false;
        return isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    };

    const visibleText = (el) => {
        if (!el) return '';
        const clone = el.cloneNode(true);
        qsa(
            '.screen-reader-text, .awaiting-mod, .update-plugins, .count, ' +
            '.plugin-count, .wp-ui-notification',
            clone
        ).forEach((n) => n.remove());
        return (clone.textContent || '').trim();
    };

    const sanitizeLabel = (s) => {
        if (!s) return '';
        s = String(s).replace(/\s+/g, ' ').trim();
        s = s.replace(/(?:[\s\u00a0]*[()\[\]•·|:\-\u2013\u2014]*)?\d+(?:\+)?$/u, '');
        return s.trim();
    };

    const getAdminbarHeight = () => {
        const bar = qs('#wpadminbar');
        return bar ? bar.offsetHeight : 32;
    };

    const isSystemMenu = (li) => {
        if (!li || !li.id) return false;
        if (CORE_IDS.has(li.id)) return true;
        try {
            const a = qs('a', li);
            const href = a ? new URL(a.href, location.origin).pathname : '';
            return [
                '/wp-admin/index.php',
                '/wp-admin/upload.php',
                '/wp-admin/edit.php',
                '/wp-admin/edit.php?post_type=page',
                '/wp-admin/themes.php',
                '/wp-admin/plugins.php',
                '/wp-admin/users.php',
                '/wp-admin/tools.php',
                '/wp-admin/options-general.php',
            ].some((p) => href.startsWith(p));
        } catch {
            return false;
        }
    };

    const copyIcon = (li) => {
        const src = qs('.wp-menu-image', li);
        const span = document.createElement('span');
        span.className = 'cch-icon';
        if (!src) return span;

        const classes = Array.from(src.classList).filter((c) =>
            c.startsWith('dashicons')
        );
        if (classes.length) {
            span.classList.add(...classes);
            if (!span.classList.contains('dashicons-before')) {
                span.classList.add('dashicons-before');
            }
        }

        const bg = src.getAttribute('style') || '';
        const m = /background-image:\s*url\(([^)]+)\)/i.exec(bg);
        if (m) {
            span.style.backgroundImage = 'url(' + m[1] + ')';
            span.style.backgroundSize = 'cover';
        }

        const svg = qs('svg', src);
        if (svg) span.appendChild(svg.cloneNode(true));

        return span;
    };

    const makeDashiconIcon = (dash) => {
        const span = document.createElement('span');
        span.className = 'cch-icon';
        if (typeof dash === 'string' && dash.startsWith('dashicons-')) {
            span.classList.add('dashicons-before', dash);
        } else {
            span.classList.add('dashicons-before', 'dashicons-admin-generic');
        }
        return span;
    };

    const addSafeClasses = (el, list) => {
        (list || [])
        .map((c) => String(c).trim())
            .filter((c) => c && /^[A-Za-z0-9_\-:]+$/.test(c) && c.length < 128)
            .forEach((c) => el.classList.add(c));
    };

    const makeIconFromSnapshot = (it) => {
        const span = document.createElement('span');
        span.className = 'cch-icon';
        const bg = (it.iconBg || '').trim();
        const svg = (it.iconSvg || '').trim();
        let sig = (it.iconClass || '').trim();

        if (!bg && /^data:image\//i.test(sig)) {
            span.style.backgroundImage = `url(${sig})`;
            span.style.backgroundSize = 'cover';
            return span;
        }
        if (!bg && /^url\(/i.test(sig)) {
            span.style.backgroundImage = sig;
            span.style.backgroundSize = 'cover';
            return span;
        }
        if (!bg && /\.(svg|png|jpe?g|gif)(\?.*)?$/i.test(sig)) {
            span.style.backgroundImage = `url(${sig})`;
            span.style.backgroundSize = 'cover';
            return span;
        }
        if (bg) {
            if (/^url\(/i.test(bg)) span.style.backgroundImage = bg;
            else span.style.backgroundImage = `url(${bg})`;
            span.style.backgroundSize = 'cover';
            return span;
        }
        if (svg) {
            span.innerHTML = svg;
            return span;
        }
        if (sig.startsWith('dashicons')) {
            addSafeClasses(span, ['dashicons-before', sig]);
            return span;
        }
        addSafeClasses(span, ['dashicons-before', 'dashicons-admin-generic']);
        return span;
    };

    const collectLeftMenus = () => {
        const byLabel = (a, b) => a.label.localeCompare(b.label);
        const system = [];
        const extensions = [];

        const hasSnap = Array.isArray(CFG.menuSnapshot) && CFG.menuSnapshot.length > 0;

        if (hasSnap) {
            const snap = CFG.menuSnapshot;
            snap.forEach((it) => {
                const item = {
                    label: sanitizeLabel(it.label || ''),
                    href: it.href || '#',
                    subs: Array.isArray(it.subs) ?
                        it.subs.map((s) => ({
                            label: sanitizeLabel(s.label || ''),
                            href: s.href || '#',
                        })) :
                        [],
                    icon: makeIconFromSnapshot(it),
                    id: it.id || '',
                };
                if (item.id && CORE_IDS.has(item.id)) system.push(item);
                else extensions.push(item);
            });

            system.sort(byLabel);
            extensions.sort(byLabel);
            return {
                system,
                extensions
            };
        }

        // Fallback: build from live DOM (admin only)
        const adminMenuRoot = document.querySelector('#adminmenu');
        if (adminMenuRoot) {
            const items = Array.from(
                document.querySelectorAll('#adminmenu > li.menu-top')
            ).filter(
                (li) =>
                !li.classList.contains('wp-menu-separator') &&
                li.id !== 'collapse-menu'
            );

            items.forEach((li) => {
                const a = li.querySelector('a');
                if (!a) return;
                const nameEl = li.querySelector('.wp-menu-name') || a;
                const label = sanitizeLabel(visibleText(nameEl));
                const href = a.getAttribute('href') || '#';
                const subs = Array.from(li.querySelectorAll('ul.wp-submenu-wrap > li > a'))
                    .filter((x) => !x.classList.contains('wp-submenu-head'))
                    .map((x) => ({
                        label: sanitizeLabel(visibleText(x)),
                        href: x.getAttribute('href') || '#',
                    }));

                const icon = copyIcon(li);
                const item = {
                    label,
                    href,
                    icon,
                    subs,
                    id: li.id || ''
                };
                if (isSystemMenu(li)) system.push(item);
                else extensions.push(item);
            });

            system.sort(byLabel);
            extensions.sort(byLabel);
        }

        return {
            system,
            extensions
        };
    };

    // Known toolbar node -> dashicon mapping (can be extended via CFG)
    const ICON_MAP = Object.assign({
        'wp-admin-bar-site-name': 'dashicons-admin-home',
        'wp-admin-bar-new-content': 'dashicons-plus',
        'wp-admin-bar-comments': 'dashicons-admin-comments',
        'wp-admin-bar-updates': 'dashicons-update',
        'wp-admin-bar-customize': 'dashicons-admin-customize',
        'wp-admin-bar-search': 'dashicons-search',
        'wp-admin-bar-my-account': 'dashicons-admin-users',
        'wp-admin-bar-edit': 'dashicons-edit',
    }, CFG.toolbarIconMap || {});

    const collectToolbar = () => {
        const roots = [
            qs('#wp-admin-bar-root-default'),
            qs('#wp-admin-bar-top-secondary'),
        ].filter(Boolean);

        const extras = [];
        const system = [];

        const SKIP_IDS = new Set(
            Array.isArray(CFG.toolbarSkipIds) && CFG.toolbarSkipIds.length ?
            CFG.toolbarSkipIds :
            ['wp-admin-bar-menu-toggle', 'wp-admin-bar-search']
        );

        roots.forEach((root) => {
            qsa(':scope > li', root).forEach((li) => {
                const id = li.id || '';
                if (SKIP_IDS.has(id)) return;

                const anchor =
                    qs('a.ab-item', li) ||
                    qs('.ab-item', li) ||
                    qs('[role="menuitem"]', li);
                if (!anchor) return;

                const subs = qsa('.ab-submenu a', li).map((x) => {
                    let label = sanitizeLabel(visibleText(x));
                    const href = x.getAttribute('href') || '#';

                    // Add this check to clean up the "Edit Profile" link
                    if (href.includes('profile.php') || href.includes('user-edit.php')) {
                        label = 'Edit Profile';
                    }

                    return {
                        label: label,
                        href: href,
                    };
                });

                let label = sanitizeLabel(visibleText(anchor));
                if (!label) {
                    const aria = (anchor.getAttribute('aria-label') || '').trim();
                    const title = (anchor.getAttribute('title') || '').trim();
                    label = sanitizeLabel(aria || title);
                }
                if (!label) {
                    const sr = qs('.screen-reader-text', anchor);
                    if (sr) label = sanitizeLabel((sr.textContent || '').trim());
                }
                if (!label && subs.length) {
                    label = subs[0].label || '';
                }

                let href = anchor.getAttribute('href') || '';
                if (!href && subs.length) href = subs[0].href || '#';
                if (!href) href = '#';

                if (!label && subs.length === 0) return;

                const item = {
                    id,
                    label,
                    href,
                    subs,
                    icon: null
                };
                const mapped = ICON_MAP[id];
                if (mapped) item.icon = makeDashiconIcon(mapped);

                if (!item.icon) {
                    const candidates = [
                        anchor,
                        anchor.querySelector('.dashicons'),
                        anchor.querySelector("[class*='dashicons-']"),
                    ].filter(Boolean);

                    for (const el of candidates) {
                        const found = Array.from(el.classList).find((c) =>
                            c.startsWith('dashicons-')
                        );
                        if (found) {
                            item.icon = makeDashiconIcon(found);
                            break;
                        }
                    }
                }

                if (TOOLBAR_KEEP.has(id)) {
                    system.push(item);
                } else {
                    li.classList.add('cch-hidden-toolbar');
                    extras.push(item);
                }
            });
        });

        const byLabel = (a, b) => a.label.localeCompare(b.label);
        system.sort(byLabel);
        extras.sort(byLabel);

        return {
            system,
            extras
        };
    };

    const buildCard = (item) => {
        const card = document.createElement('a');
        card.className = 'cch-card';
        card.href = item.href || '#';
        card.setAttribute('data-label', (item.label || '').toLowerCase());

        // Use the helper to check the main card's link
        const isExternalCard = applyExternalLinkStyles(card, item.href);

        const iconSlot = item.icon || document.createElement('span');
        const content = document.createElement('div');
        const title = document.createElement('div');
        const meta = document.createElement('div');

        title.className = 'cch-label';
        title.textContent = item.label || '';
        title.dataset.cchRaw = item.label || '';

        // If the card link is external, add an icon to its title
        if (isExternalCard) {
            const icon = document.createElement('span');
            icon.className = 'dashicons dashicons-external cch-external-link-icon';
            title.appendChild(icon);
        }

        meta.className = 'cch-meta';
        if (typeof item.meta === 'string') {
            meta.textContent = item.meta;
        } else if (typeof item.updateCount === 'number') {
            meta.textContent = item.updateCount + ' updates';
        } else {
            meta.textContent =
                item.subs && item.subs.length ?
                item.subs.length + ' shortcuts' :
                'Open';
        }

        content.appendChild(title);
        content.appendChild(meta);

        card.appendChild(iconSlot);
        card.appendChild(content);

        if (item.subs && item.subs.length) {
            const ul = document.createElement('ul');
            ul.className = 'cch-submenu';
            item.subs.forEach((s) => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = s.href || '#';
                a.textContent = s.label || '';
                a.dataset.cchRaw = s.label || '';

                // Use the helper to check each submenu link
                const isExternalSub = applyExternalLinkStyles(a, s.href);
                if (isExternalSub) {
                    const icon = document.createElement('span');
                    icon.className = 'dashicons dashicons-external cch-external-link-icon';
                    a.appendChild(icon);
                }

                li.appendChild(a);
                ul.appendChild(li);
            });
            card.appendChild(ul);
            ul.addEventListener('click', (e) => e.stopPropagation());
        }

        return card;
    };

    const buildSection = (title, items) => {
        if (!items.length) return null;
        const section = document.createElement('section');
        section.className = 'cch-section';

        const h = document.createElement('h3');
        h.textContent = title;

        const grid = document.createElement('div');
        grid.className = 'cch-grid';

        items.forEach((it) => grid.appendChild(buildCard(it)));

        section.appendChild(h);
        section.appendChild(grid);
        return section;
    };

    const buildPopout = () => {
        const pop = document.createElement('div');
        pop.id = 'cch-popout';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-modal', 'true');
        pop.setAttribute('aria-hidden', 'true');
        pop.style.setProperty('--cch-adminbar-h', getAdminbarHeight() + 'px');

        const wrap = document.createElement('div');
        wrap.className = 'cch-popout-inner';

        const header = document.createElement('div');
        header.className = 'cch-popout-header';

        const title = document.createElement('h2');
        title.id = 'cch-popout-title';
        title.textContent = 'Quick Menu';

        const search = document.createElement('input');
        search.type = 'search';
        search.id = 'cch-popout-search';
        search.placeholder = 'Filter apps and actions...';

        // View toggle
        const viewToggle = document.createElement('div');
        viewToggle.className = 'cch-view-toggle';
        viewToggle.setAttribute('role', 'group');
        viewToggle.setAttribute('aria-label', 'Layout');

        const btnCards = document.createElement('button');
        btnCards.type = 'button';
        btnCards.textContent = 'Cards';

        const btnExpanded = document.createElement('button');
        btnExpanded.type = 'button';
        btnExpanded.textContent = 'Expanded';

        viewToggle.appendChild(btnCards);
        viewToggle.appendChild(btnExpanded);

        // Help button
        const helpBtn = document.createElement('button');
        helpBtn.type = 'button';
        helpBtn.className = 'cch-help';
        helpBtn.setAttribute('aria-haspopup', 'dialog');
        helpBtn.setAttribute('aria-expanded', 'false');
        helpBtn.title = 'Help';
        helpBtn.textContent = '?';

        // Close button
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'cch-close';
        close.setAttribute('aria-label', 'Close menu');
        close.textContent = 'Close';

        header.appendChild(title);
        header.appendChild(search);
        header.appendChild(viewToggle);
        header.appendChild(helpBtn); // place help before Close
        header.appendChild(close);

        const sections = document.createElement('div');
        sections.className = 'cch-sections';

        const {
            system,
            extensions
        } = collectLeftMenus();
        const {
            system: toolbarSystem,
            extras: toolbarExtras
        } = collectToolbar();

        // Promote Updates into System
        const updatesIdx = toolbarExtras.findIndex(
            (it) => it.id === 'wp-admin-bar-updates'
        );
        if (updatesIdx > -1) {
            const u = toolbarExtras.splice(updatesIdx, 1)[0];
            const icon = makeDashiconIcon('dashicons-update');
            const hasUpdates = UPDATES_COUNT > 0;
            const updatesItem = {
                label: hasUpdates ? 'Updates available' : 'Up to date',
                href: u.href || '#',
                subs: u.subs || [],
                icon,
                updateCount: UPDATES_COUNT,
            };
            system.unshift(updatesItem);
        }

        // Woo sample handling
        const wcIdx = toolbarExtras.findIndex(
            (it) => it.id === 'wp-admin-bar-woocommerce-site-visibility-badge'
        );
        if (wcIdx > -1) {
            const w = toolbarExtras.splice(wcIdx, 1)[0];
            const iconW = makeDashiconIcon('dashicons-cart');
            extensions.unshift({
                label: w.label || 'WooCommerce',
                href: w.href || '#',
                subs: w.subs || [],
                icon: iconW,
            });
        }

        const filteredToolbarSystem = toolbarSystem.filter(
            (it) => it.id !== 'wp-admin-bar-cch-popout-toggle'
        );

        const s1 = buildSection('System', system);
        const s2 = buildSection('Extensions', extensions);
        const s3 = toolbarExtras.length ?
            buildSection('Toolbar Extras', toolbarExtras) :
            null;
        const s4 = buildSection('Toolbar', filteredToolbarSystem);

        if (s1) sections.appendChild(s1);
        if (s2) sections.appendChild(s2);
        if (s3) sections.appendChild(s3);
        if (s4) sections.appendChild(s4);

        wrap.appendChild(header);
        wrap.appendChild(sections);
        pop.appendChild(wrap);

        // Help overlay
        const help = document.createElement('div');
        help.id = 'cch-help';
        help.setAttribute('aria-hidden', 'true');

        const helpPanel = document.createElement('div');
        helpPanel.className = 'cch-help-panel';

        const helpTitle = document.createElement('h3');
        helpTitle.textContent = 'Keyboard shortcuts';

        const shortcut = getShortcutLabel();
        const helplist = document.createElement('ul');
        helplist.className = 'cch-help-list';
        const items = [
            `Open / Close menu: ${shortcut.replace(".","")} + period (.)`,
            'Open selection: Enter',
            'Close menu or help: Esc',
            isMac() ?
            'Navigate cards: ⌘ + Left/Right' :
            'Navigate cards: Ctrl + Left/Right',
            isMac() ?
            'Navigate list items: ⌘ + Up/Down' :
            'Navigate list items: Ctrl + Up/Down',
            'Filter items: just start typing',
        ];
        items.forEach((txt) => {
            const li = document.createElement('li');
            li.textContent = txt;
            helplist.appendChild(li);
        });

        const helpClose = document.createElement('button');
        helpClose.type = 'button';
        helpClose.className = 'cch-help-close';
        helpClose.textContent = 'Close help';

        helpPanel.appendChild(helpTitle);
        helpPanel.appendChild(helplist);
        helpPanel.appendChild(helpClose);
        help.appendChild(helpPanel);
        pop.appendChild(help);

        document.body.appendChild(pop);

        // Stable original order
        qsa('.cch-section', pop).forEach((section) => {
            const grid = qs('.cch-grid', section);
            if (!grid) return;
            qsa(':scope > .cch-card', grid).forEach((card, idx) => {
                card.dataset.cchIdx = String(idx);
                qsa(':scope .cch-submenu > li', card).forEach((li, sidx) => {
                    li.dataset.cchIdx = String(sidx);
                });
            });
        });

        // Keyboard navigation state + helpers
        let activeCard = null;
        let activeSubIndex = -1;
        let keyboardMode = false;
        let lastHoverCard = null;

        const setKeyboardMode = (on) => {
            keyboardMode = !!on;
            pop.classList.toggle('cch-keynav', keyboardMode);
        };

        const isVisible = (el) =>
            !!(el && el.getClientRects && el.getClientRects().length);

        const candidateCards = (root) => {
            const list = qsa('.cch-card', root).filter(isVisible);
            if (!root.classList.contains('cch-has-query')) return list;
            return list.filter((c) => !c.classList.contains('cch-dim'));
        };

        const candidateSubs = (card, root) => {
            const subs = qsa('.cch-submenu a', card);
            if (!root.classList.contains('cch-has-query')) return subs;
            return subs.filter((a) => !a.classList.contains('cch-dim'));
        };

        const allCards = () => candidateCards(pop);

        const clearSubHighlight = () => {
            qsa('.cch-submenu a.cch-sub-active', pop).forEach((a) =>
                a.classList.remove('cch-sub-active')
            );
        };

        const syncSubmenuOpenState = () => {
            qsa('.cch-card.cch-sub-open', pop).forEach((c) =>
                c.classList.remove('cch-sub-open')
            );
            if (activeCard && activeSubIndex >= 0) {
                activeCard.classList.add('cch-sub-open');
            }
        };

        const updateSubHighlight = () => {
            clearSubHighlight();
            syncSubmenuOpenState();
            if (!activeCard) return;
            const subs = candidateSubs(activeCard, pop);
            if (!subs.length) return;
            if (activeSubIndex >= 0 && subs[activeSubIndex]) {
                subs[activeSubIndex].classList.add('cch-sub-active');
                subs[activeSubIndex].scrollIntoView({
                    block: 'nearest',
                    inline: 'nearest',
                });
            }
        };

        const setActiveCard = (card) => {
            if (activeCard === card) return;
            if (activeCard) activeCard.classList.remove('cch-active');
            activeCard = card && isVisible(card) ? card : null;
            activeSubIndex = -1;
            clearSubHighlight();
            syncSubmenuOpenState();
            if (activeCard) {
                activeCard.classList.add('cch-active');
                activeCard.scrollIntoView({
                    block: 'nearest',
                    inline: 'nearest',
                });
            }
        };

        const clearActiveByMouse = () => {
            if (activeCard) activeCard.classList.remove('cch-active');
            activeCard = null;
            activeSubIndex = -1;
            clearSubHighlight();
            syncSubmenuOpenState();
            setKeyboardMode(false);
        };

        const firstVisibleCard = () => candidateCards(pop)[0] || null;

        const pickStartCard = () => {
            if (lastHoverCard && isVisible(lastHoverCard)) return lastHoverCard;
            if (activeCard && isVisible(activeCard)) return activeCard;
            return firstVisibleCard();
        };

        const measureGlobalModel = () => {
            const vis = candidateCards(pop);
            const entries = vis.map((el) => {
                const r = el.getBoundingClientRect();
                return {
                    el,
                    left: r.left,
                    top: r.top,
                    right: r.right,
                    bottom: r.bottom,
                    cx: r.left + r.width / 2,
                    cy: r.top + r.height / 2,
                };
            });

            if (!entries.length) return {
                rows: [],
                byCol: []
            };

            entries.sort((a, b) =>
                a.top !== b.top ? a.top - b.top : a.left - b.left
            );
            const rows = [];
            const ROW_TOL = 10;

            entries.forEach((e) => {
                const last = rows[rows.length - 1];
                if (!last) {
                    rows.push([e]);
                    return;
                }
                const rowTop = last[0].top;
                if (Math.abs(e.top - rowTop) <= ROW_TOL) {
                    last.push(e);
                } else {
                    rows.push([e]);
                }
            });

            rows.forEach((row) => row.sort((a, b) => a.left - b.left));

            const firstRow = rows[0] || [];
            const columns = firstRow.map((e) => e.cx);
            const byCol = columns.map(() => []);

            entries.forEach((e) => {
                if (!columns.length) return;
                let best = 0;
                let bestd = Infinity;
                columns.forEach((cx, i) => {
                    const d = Math.abs(e.cx - cx);
                    if (d < bestd) {
                        bestd = d;
                        best = i;
                    }
                });
                byCol[best].push(e);
            });

            byCol.forEach((col) => col.sort((a, b) => a.top - b.top));

            return {
                rows,
                byCol
            };
        };

        const moveHorizontal = (delta) => {
            const start = pickStartCard();
            if (!start) return;
            if (!activeCard) setActiveCard(start);

            const {
                rows
            } = measureGlobalModel();
            if (!rows.length) return;

            let rowIdx = -1;
            let colIdx = -1;
            for (let r = 0; r < rows.length; r++) {
                const c = rows[r].findIndex((e) => e.el === activeCard);
                if (c !== -1) {
                    rowIdx = r;
                    colIdx = c;
                    break;
                }
            }
            if (rowIdx === -1) {
                setActiveCard(rows[0][0].el);
                return;
            }

            const row = rows[rowIdx];
            let nextRowIdx = rowIdx;
            let nextColIdx = colIdx + (delta > 0 ? 1 : -1);

            if (nextColIdx >= row.length) {
                nextRowIdx = (rowIdx + 1) % rows.length;
                nextColIdx = 0;
            } else if (nextColIdx < 0) {
                nextRowIdx = (rowIdx - 1 + rows.length) % rows.length;
                const prevRow = rows[nextRowIdx];
                nextColIdx = prevRow.length - 1;
            }

            setActiveCard(rows[nextRowIdx][nextColIdx].el);
        };

        const moveVerticalGlobal = (dir) => {
            const start = pickStartCard();
            if (!start) return;
            if (!activeCard) setActiveCard(start);

            const {
                byCol
            } = measureGlobalModel();
            if (!byCol.length) return;

            let colIdx = -1;
            let rowIdx = -1;
            for (let c = 0; c < byCol.length; c++) {
                const r = byCol[c].findIndex((e) => e.el === activeCard);
                if (r !== -1) {
                    colIdx = c;
                    rowIdx = r;
                    break;
                }
            }
            if (colIdx === -1) return;

            const step = (c, r, d) => {
                if (d > 0) {
                    if (r < byCol[c].length - 1) return {
                        c,
                        r: r + 1
                    };
                    return {
                        c: (c + 1) % byCol.length,
                        r: 0
                    };
                } else {
                    if (r > 0) return {
                        c,
                        r: r - 1
                    };
                    const pc = (c - 1 + byCol.length) % byCol.length;
                    return {
                        c: pc,
                        r: byCol[pc].length - 1
                    };
                }
            };

            const next = step(colIdx, rowIdx, dir);
            setActiveCard(byCol[next.c][next.r].el);
        };

        const moveVertical = (dir) => {
            const start = pickStartCard();
            if (!start) return;
            if (!activeCard) setActiveCard(start);

            const subs = candidateSubs(activeCard, pop);

            if (subs.length) {
                // We are on a card that has a submenu.
                if (activeSubIndex === -1) {
                    if (dir > 0) {
                        // First Down: select first submenu item.
                        activeSubIndex = 0;
                        updateSubHighlight();
                        return;
                    }
                    // First Up: go to previous card, then select the last submenu item if available.
                    moveVerticalGlobal(-1);
                    const newSubs = candidateSubs(activeCard, pop);
                    if (newSubs.length) {
                        activeSubIndex = newSubs.length - 1;
                        updateSubHighlight();
                    }
                    return;
                }

                // We already have a submenu item selected — move within the list.
                const nextIndex = activeSubIndex + dir;

                if (nextIndex >= 0 && nextIndex < subs.length) {
                    activeSubIndex = nextIndex;
                    updateSubHighlight();
                    return;
                }

                if (nextIndex < 0) {
                    // Up from first submenu item: deselect (next Up will move to previous card).
                    activeSubIndex = -1;
                    updateSubHighlight();
                    return;
                }

                if (nextIndex >= subs.length) {
                    // Down past last submenu item: advance to next card.
                    activeSubIndex = -1;
                    updateSubHighlight();
                    moveVerticalGlobal(+1);
                    return;
                }
            } else {
                // Current card has no submenu: move vertically across cards.
                if (dir < 0) {
                    // Up into previous card: if it has a submenu, auto-select its last item.
                    moveVerticalGlobal(-1);
                    const newSubs = candidateSubs(activeCard, pop);
                    if (newSubs.length) {
                        activeSubIndex = newSubs.length - 1;
                        updateSubHighlight();
                    }
                } else {
                    // Down into next card (no auto-select here; matches existing Down behavior).
                    moveVerticalGlobal(+1);
                }
                return;
            }

            // Fallback (should rarely hit).
            moveVerticalGlobal(dir);
        };

        const clickSelection = () => {
            if (!activeCard) return;
            const subs = candidateSubs(activeCard, pop);
            if (subs.length && activeSubIndex >= 0 && subs[activeSubIndex]) {
                subs[activeSubIndex].click();
                return;
            }
            activeCard.click();
        };

        const escHtml = (s) =>
            String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const highlightInto = (el, raw, q) => {
            if (!el) return;
            if (!q) {
                el.textContent = raw;
                return;
            }
            const src = String(raw);
            const hay = src.toLowerCase();
            const needle = q.toLowerCase();
            if (!needle) {
                el.textContent = src;
                return;
            }
            let i = 0;
            let html = '';
            while (true) {
                const j = hay.indexOf(needle, i);
                if (j === -1) {
                    html += escHtml(src.slice(i));
                    break;
                }
                html += escHtml(src.slice(i, j));
                html +=
                    '<mark class="cch-hl">' +
                    escHtml(src.slice(j, j + needle.length)) +
                    '</mark>';
                i = j + needle.length;
            }
            el.innerHTML = html;
        };

        const ensureActiveAfterFilter = () => {
            const first = firstVisibleCard();
            if (!first) {
                setActiveCard(null);
                return;
            }
            if (!activeCard || !isVisible(activeCard)) {
                setActiveCard(first);
            }
        };

        // Search/filter
        search.addEventListener('input', () => {
            const q = search.value.trim();
            pop.classList.toggle('cch-has-query', q.length > 0);

            qsa('.cch-card', pop).forEach((card) => {
                const titleEl = qs('.cch-label', card);
                const rawTitle =
                    (titleEl && titleEl.dataset && titleEl.dataset.cchRaw) ||
                    (titleEl && titleEl.textContent) ||
                    '';
                const titleMatch =
                    q.length === 0 || rawTitle.toLowerCase().includes(q.toLowerCase());

                highlightInto(titleEl, rawTitle, q);

                const ul = qs('.cch-submenu', card);
                let matchCount = 0;
                if (ul) {
                    const lis = qsa(':scope > li', ul);
                    const matches = [];
                    const nonMatches = [];
                    lis.forEach((li) => {
                        const a = qs('a', li);
                        if (!a) return;
                        const raw =
                            (a.dataset && a.dataset.cchRaw) || a.textContent || '';
                        const isMatch =
                            q.length === 0 || raw.toLowerCase().includes(q.toLowerCase());
                        highlightInto(a, raw, q);
                        if (isMatch) {
                            a.classList.remove('cch-dim');
                            matchCount++;
                            matches.push(li);
                        } else {
                            a.classList.add('cch-dim');
                            nonMatches.push(li);
                        }
                    });
                    const byIdx = (a, b) =>
                        (+a.dataset.cchIdx || 0) - (+b.dataset.cchIdx || 0);
                    matches.sort(byIdx);
                    nonMatches.sort(byIdx);
                    [...matches, ...nonMatches].forEach((li) => ul.appendChild(li));
                }

                const isCardMatch = titleMatch || matchCount > 0;
                card.classList.toggle('cch-dim', q.length > 0 && !isCardMatch);
                card.classList.toggle(
                    'cch-sub-open',
                    q.length > 0 && matchCount > 0 && !titleMatch
                );
            });

            // Reorder and hide/show sections based on matches
            qsa('.cch-section', pop).forEach((section) => {
                const grid = qs('.cch-grid', section);
                if (!grid) return;

                const cards = qsa(':scope > .cch-card', grid);
                const matches = [];
                const nonMatches = [];
                cards.forEach((card) => {
                    if (card.classList.contains('cch-dim')) nonMatches.push(card);
                    else matches.push(card);
                });

                const byIdx = (a, b) =>
                    (+a.dataset.cchIdx || 0) - (+b.dataset.cchIdx || 0);
                matches.sort(byIdx);
                nonMatches.sort(byIdx);
                [...matches, ...nonMatches].forEach((c) => grid.appendChild(c));

                const matchCount = section.querySelectorAll(
                    '.cch-card:not(.cch-dim)'
                ).length;
                const hide = search.value.trim().length > 0 && matchCount === 0;
                section.classList.toggle('cch-hidden', hide);
            });

            // Keyboard: restrict to matching items/cards only
            activeSubIndex = -1;
            updateSubHighlight();

            const first = allCards()[0] || null;
            if (!first) {
                setActiveCard(null);
            } else if (!activeCard || activeCard.classList.contains('cch-dim')) {
                setActiveCard(first);
            }
        });

        // Mouse hover behavior vs keyboard mode
        pop.addEventListener('mouseover', (e) => {
            const hovered = e.target.closest('.cch-card');
            if (!hovered) return;
            lastHoverCard = hovered;
            if (keyboardMode && activeCard && hovered !== activeCard) {
                clearActiveByMouse();
            }
        });

        const keyIs = (e, names, codes) => {
            const k = (e.key || '').toLowerCase();
            const c = (e.code || '').toLowerCase();
            const kc = e.keyCode || e.which || 0;
            return (
                names.some((n) => k === n.toLowerCase()) ||
                names.some((n) => c === n.toLowerCase()) ||
                (codes && codes.includes(kc))
            );
        };

        const isHorizMod = (e) => e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
        const isVertMod = (e) =>
            (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;

        const handleNavKey = (e) => {
            if (pop.getAttribute('aria-hidden') === 'true') return;
            if (!pop.contains(e.target)) return;
            if (e.__cchNavHandled) return;

            if (isHorizMod(e)) {
                if (keyIs(e, ['ArrowLeft', 'Left'], [37])) {
                    e.__cchNavHandled = true;
                    e.preventDefault();
                    setKeyboardMode(true);
                    activeSubIndex = -1;
                    updateSubHighlight();
                    moveHorizontal(-1);
                    return;
                }
                if (keyIs(e, ['ArrowRight', 'Right'], [39])) {
                    e.__cchNavHandled = true;
                    e.preventDefault();
                    setKeyboardMode(true);
                    activeSubIndex = -1;
                    updateSubHighlight();
                    moveHorizontal(+1);
                    return;
                }
            }

            if (isVertMod(e)) {
                if (keyIs(e, ['ArrowUp', 'Up'], [38])) {
                    e.__cchNavHandled = true;
                    e.preventDefault();
                    setKeyboardMode(true);
                    moveVertical(-1);
                    return;
                }
                if (keyIs(e, ['ArrowDown', 'Down'], [40])) {
                    e.__cchNavHandled = true;
                    e.preventDefault();
                    setKeyboardMode(true);
                    if (activeCard) {
                        const subs = candidateSubs(activeCard, pop);
                        if (subs.length && activeSubIndex === -1) {
                            activeSubIndex = 0;
                            updateSubHighlight();
                            return;
                        }
                    }
                    moveVertical(+1);
                    return;
                }
            }

            if (keyIs(e, ['Enter'], [13])) {
                e.__cchNavHandled = true;
                e.preventDefault();
                clickSelection();
            }
        };

        document.addEventListener('keydown', handleNavKey);

        const hide = () => {
            pop.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('cch-lock-scroll');
            setKeyboardMode(false);
            hideHelp();
        };
        const show = () => {
            pop.style.setProperty('--cch-adminbar-h', getAdminbarHeight() + 'px');
            pop.setAttribute('aria-hidden', 'false');
            document.body.classList.add('cch-lock-scroll');
            setKeyboardMode(false);

            requestAnimationFrame(() => {
                pop.style.setProperty('--cch-adminbar-h', getAdminbarHeight() + 'px');
            });

            setTimeout(() => {
                search.focus();
            }, 0);
        };

        close.addEventListener('click', hide);
        pop.addEventListener('click', (e) => {
            if (e.target === pop) hide();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && pop.getAttribute('aria-hidden') === 'false') {
                if (help.getAttribute('aria-hidden') === 'false') {
                    hideHelp();
                } else {
                    hide();
                }
            }
        });

        // Help overlay show/hide
        let helpPrevFocus = null;
        const showHelp = () => {
            helpPrevFocus = document.activeElement;
            help.setAttribute('aria-hidden', 'false');
            helpBtn.setAttribute('aria-expanded', 'true');
            const btn = qs('.cch-help-close', help) || help;
            btn.focus();
        };
        const hideHelp = () => {
            help.setAttribute('aria-hidden', 'true');
            helpBtn.setAttribute('aria-expanded', 'false');
            if (helpPrevFocus && typeof helpPrevFocus.focus === 'function') {
                helpPrevFocus.focus();
            } else {
                helpBtn.focus();
            }
        };

        helpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (help.getAttribute('aria-hidden') === 'false') hideHelp();
            else showHelp();
        });
        help.addEventListener('click', (e) => {
            if (e.target === help) hideHelp();
        });
        helpClose.addEventListener('click', hideHelp);

        // View preference
        const applyView = (view) => {
            const expanded = view === 'expanded';
            pop.classList.toggle('cch-view-expanded', expanded);
            pop.classList.toggle('cch-view-cards', !expanded);
            btnCards.classList.toggle('is-selected', !expanded);
            btnExpanded.classList.toggle('is-selected', expanded);
            localStorage.setItem(VIEW_KEY, expanded ? 'expanded' : 'cards');
            setKeyboardMode(false);
            activeSubIndex = -1;
            updateSubHighlight();
            search.focus();
        };

        const initialView = localStorage.getItem(VIEW_KEY) || 'cards';
        applyView(initialView);

        btnCards.addEventListener('click', () => applyView('cards'));
        btnExpanded.addEventListener('click', () => applyView('expanded'));

        // Finish building
        return {
            pop,
            show,
            hide
        };
    };

    function setToggleShortcutLabel(anchor) {
        if (!anchor) return;
        const label = getShortcutLabel();
        let kbd = anchor.querySelector('.cch-kbd');
        if (!kbd) {
            kbd = document.createElement('kbd');
            kbd.className = 'cch-kbd';
            kbd.setAttribute('aria-hidden', 'true');
            anchor.appendChild(kbd);
        }
        kbd.textContent = label;
        const aria = `Open Quick Menu (${label})`;
        anchor.setAttribute('aria-label', aria);
        anchor.title = aria;
    }

    function bindOrCreateAdminbarToggle(onClick) {
        const root = qs('#wp-admin-bar-root-default');
        if (!root) return;

        const handler = (e) => {
            e.preventDefault();
            onClick();
        };

        const existing = qs('#wp-admin-bar-cch-popout-toggle > .ab-item');
        if (existing) {
            existing.addEventListener('click', handler);
            setToggleShortcutLabel(existing);
            return;
        }

        const li = document.createElement('li');
        li.id = 'wp-admin-bar-cch-popout-toggle';

        const a = document.createElement('a');
        a.className = 'ab-item';
        a.href = '#';
        a.innerHTML =
            '<span class="dashicons dashicons-menu-alt" aria-hidden="true"></span>' +
            '<span class="cch-menu-text"> Menu</span>';

        setToggleShortcutLabel(a);
        a.addEventListener('click', handler);

        li.appendChild(a);
        root.insertBefore(li, root.firstChild);
    }

    const init = () => {
        document.body.classList.add('cch-hide-admin-menu', 'cch-compact-toolbar');

        const {
            pop,
            show,
            hide
        } = buildPopout();

        const syncBarHeight = () => {
            pop.style.setProperty('--cch-adminbar-h', getAdminbarHeight() + 'px');
        };
        window.addEventListener('resize', syncBarHeight);
        syncBarHeight();

        bindOrCreateAdminbarToggle(() => {
            const isOpen = pop.getAttribute('aria-hidden') === 'false';
            if (isOpen) hide();
            else show();
        });

        document.addEventListener('keydown', (e) => {
            if (!isOpenShortcut(e)) return;
            e.preventDefault();
            const isOpen = qs('#cch-popout') ?. getAttribute('aria-hidden') === 'false';
            if (isOpen) {
                hide();
            } else {
                show();
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();