// The live Winhance window on the landing page. Everything it shows comes from demo/app.js, which
// tools/gen-demo.mjs builds from the app's own source and catalog export; this file only lays it out.
// Nothing here changes anything on the visitor's PC: a toggle flips a value in memory and the page's
// readout says what Winhance would write.
(function () {
  'use strict';

  var host = document.getElementById('winhance-demo');
  if (!host || !window.WinhanceDemoData) return;
  // Paths in the demo and its data are from the site root; the root is found from this script, so the same
  // files work on the landing page and on a docs page two folders down.
  var me = document.currentScript;
  var base = new URL(me && me.src ? '..' : '.', me && me.src ? me.src : document.baseURI).href;
  function asset(path) { return /^([a-z]+:|\/|#)/i.test(path) ? path : base + path; }
  // A docs page shows one page of the app: data-page (and data-feature or data-tab) picks it, and data-focus
  // locks the rest of the sidebar, the same way the app locks a page it can't open yet.
  var start = host.dataset;
  var focus = start.focus != null ? start.page : null;

  var app, S, glyphs, M, techCache = {};
  var state = {
    page: start.page || 'Optimize',
    feature: start.feature || null,
    mode: 'Normal',
    target: 'Config',
    query: '',
    menu: null,
    dialog: null,
    // View menu (SectionPageShell): Technical Details starts off, InfoBadges and NEW Badges on.
    techOn: false,
    badgesOn: true,
    newOn: true,
    techOpen: {},
    collapsed: {},
    excluded: {},
    values: {},
    appsTab: start.tab || 'windows',
    appsView: 'card',
    appsSort: 'installedFirst',
    tableSort: null,
    picked: {},
    groupsClosed: {},
    filterOn: true,
    filterAsked: false,
    // MainWindow.FitNavPane: the pane closes below the compact width and reopens above it, unless the
    // visitor toggled it in between.
    paneOpen: true,
    narrow: null,
    paneForWidth: false,
    short: false,
    // WIMUtil opens mid-use: an ISO extracted, steps 2-4 open, and on the first visit the Winhance XML session.
    wim: { open: { 1: false, 2: true, 3: true, 4: true }, dest: 'iso', visited: false, generated: false },
    // Config Review: what the visitor decided for each change, the apps action per tab, and the picks to
    // restore on cancel.
    review: null,
  };
  if (state.page === 'Autounattend') { state.mode = 'Builder'; state.target = 'Autounattend'; }
  var listeners = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(template) {
    var args = arguments;
    return template.replace(/\{(\d)\}/g, function (m, i) { return args[Number(i) + 1]; });
  }

  function attr(name, value) { return value ? ' ' + name + '="' + esc(value) + '"' : ''; }

  function glyph(key, cls) {
    var g = glyphs[key];
    var c = 'wd-glyph' + (cls ? ' ' + cls : '');
    if (!g) return '<span class="' + c + '"></span>';
    if (g.image) return '<span class="' + c + ' wd-glyph-img" style="--img:url(' + g.image + ')"></span>';
    if (g.svg) return '<svg class="' + c + '" viewBox="' + g.viewBox + '" aria-hidden="true" focusable="false">' + g.svg + '</svg>';
    var box = g.fit ? '' : ' viewBox="' + g.viewBox + '"';
    return '<svg class="' + c + '"' + box + (g.fit ? ' data-fit="' + esc(key) + '"' : '') +
      ' aria-hidden="true" focusable="false"><path fill="currentColor" d="' + g.path + '"/></svg>';
  }

  // The rocket, white on dark and black on light, swapped by theme as MainWindowViewModel does.
  function appIcon(cls) {
    var c = cls ? cls + ' ' : '';
    return '<img class="' + c + 'wd-on-dark" src="' + asset('demo/assets/app-icon-dark.png') + '" alt="">' +
      '<img class="' + c + 'wd-on-light" src="' + asset('demo/assets/app-icon-light.png') + '" alt="">';
  }

  // XAML PathIcon draws a geometry scaled to its own bounds; an SVG needs that box spelled out.
  var fitted = {};
  function fitGlyphs(scope) {
    scope.querySelectorAll('svg[data-fit]').forEach(function (svg) {
      var key = svg.getAttribute('data-fit');
      if (!fitted[key]) {
        try {
          var b = svg.firstChild.getBBox();
          if (!b.width || !b.height) return;
          var side = Math.max(b.width, b.height);
          fitted[key] = [b.x - (side - b.width) / 2, b.y - (side - b.height) / 2, side, side].join(' ');
        } catch (e) { return; }
      }
      svg.setAttribute('viewBox', fitted[key]);
      svg.removeAttribute('data-fit');
    });
  }

  function chevron() { return glyph('Fluent/ChevronDown', 'wd-dd-chev'); }

  // ---- Settings model ----

  function allSettings() {
    var out = [];
    app.features.forEach(function (f) { f.settings.forEach(function (s) { out.push(s); }); });
    return out;
  }

  function startingValue(s) { return s.windowsDefault.length ? s.windowsDefault[0] : 0; }
  function value(s) { return state.values[s.id]; }
  function isOn(s) { return value(s) === 0; }
  function matches(s, list) { return list.indexOf(value(s)) >= 0; }
  function hasChoices(s) { return s.control !== 'Action' && s.control !== 'List' && s.control !== 'TextBox'; }
  function hasBadgeData(s) { return hasChoices(s) && (s.recommended.length > 0 || s.windowsDefault.length > 0); }

  // FeatureBadgeAggregator: one denominator, the settings that carry badge data.
  function featureCounts(f) {
    var c = { rec: 0, def: 0, total: 0, isNew: 0 };
    f.settings.forEach(function (s) {
      if (s.isNew) c.isNew++;
      if (!hasBadgeData(s)) return;
      c.total++;
      if (s.recommended.length && matches(s, s.recommended)) c.rec++;
      if (s.windowsDefault.length && matches(s, s.windowsDefault)) c.def++;
    });
    return c;
  }

  function featureById(id) {
    for (var i = 0; i < app.features.length; i++) if (app.features[i].id === id) return app.features[i];
    return null;
  }

  function featureOfSetting(id) {
    for (var i = 0; i < app.features.length; i++) {
      for (var j = 0; j < app.features[i].settings.length; j++) if (app.features[i].settings[j].id === id) return app.features[i];
    }
    return null;
  }

  function settingById(id) {
    var f = featureOfSetting(id);
    if (!f) return null;
    for (var j = 0; j < f.settings.length; j++) if (f.settings[j].id === id) return f.settings[j];
    return null;
  }

  function optionText(s, i) {
    if (s.control === 'Toggle' || s.control === 'CheckBox') return i === 0 ? S.common.on : S.common.off;
    return s.options[i];
  }

  // ---- Config Review (ConfigReviewService) ----
  // The demo reviews the app's own recommended config against the window's current values.

  function inReview() { return state.mode === 'ConfigReview'; }
  function configValue(s) { return inReview() ? app.review.settings[s.id] : undefined; }
  function hasDiff(s) { var c = configValue(s); return c !== undefined && c !== value(s); }
  function decision(s) { return state.review.decided[s.id]; }
  function reviewFeatures() { return app.features.filter(function (f) { return f.area !== 'Autounattend'; }); }

  function diffsIn(features) {
    var out = [];
    features.forEach(function (f) { f.settings.forEach(function (s) { if (hasDiff(s)) out.push(s); }); });
    return out;
  }

  function pendingIn(features) { return diffsIn(features).filter(function (s) { return decision(s) === undefined; }).length; }

  function inConfig(features) {
    return features.some(function (f) { return f.settings.some(function (s) { return app.review.settings[s.id] !== undefined; }); });
  }

  function kindOf(key) { return key.slice(0, key.indexOf(':')); }
  function pickedIn(tab) { return Object.keys(state.picked).filter(function (k) { return state.picked[k] && appKinds[tab].indexOf(kindOf(k)) >= 0; }).length; }
  function appsInConfig(tab) { return app.review.apps.some(function (k) { return appKinds[tab].indexOf(kindOf(k)) >= 0; }); }
  // SoftwareAppsViewModel.IsSoftwareAppsReviewed: each tab has nothing ticked, or an action chosen for what is.
  function appsReviewed() { return ['windows', 'external'].every(function (t) { return !pickedIn(t) || !!state.review.action[t]; }); }

  function reviewStatus() {
    var diffs = diffsIn(reviewFeatures());
    if (!diffs.length) return S.Builder.reviewAllMatch;
    var reviewed = diffs.filter(function (s) { return decision(s) !== undefined; }).length;
    var approved = diffs.filter(function (s) { return decision(s) === true; }).length;
    return fmt(S.Builder.reviewStatus, reviewed, diffs.length, approved);
  }

  // ReviewModeBarViewModel.CanApplyReviewedConfig.
  function canApply() { return pendingIn(reviewFeatures()) === 0 && appsReviewed(); }

  // InfoBadge: AttentionValueInfoBadgeStyle with the pending count, SuccessIconInfoBadgeStyle once done.
  function reviewBadge(pending, done) {
    if (pending) return '<span class="wd-infobadge">' + pending + '</span>';
    return done ? '<span class="wd-infobadge wd-infobadge-success">' + glyph('Fluent/Checkmark') + '</span>' : '';
  }

  // SectionOverviewItemViewModel.UpdateReviewBadge and NavBadgeService, for a section or a whole page.
  function featuresBadge(features) {
    if (!inReview()) return '';
    var pending = pendingIn(features);
    return reviewBadge(pending, !pending && inConfig(features));
  }

  function navBadge(tag) {
    if (!inReview()) return '';
    if (tag === 'SoftwareApps') {
      var done = appsReviewed();
      return reviewBadge(done ? 0 : pickedIn('windows') + pickedIn('external'), done && (appsInConfig('windows') || appsInConfig('external')));
    }
    return tag === 'Optimize' || tag === 'Customize' ? featuresBadge(areaFeatures(tag)) : '';
  }

  // The diff banner's sides: Checked/Unchecked for a checkbox, On/Off for a toggle, else the option.
  function diffText(s, i) {
    if (s.control === 'CheckBox') return i === 0 ? S.Builder.checked : S.Builder.unchecked;
    return optionText(s, i);
  }

  function emit(event) { listeners.forEach(function (fn) { fn(event); }); }

  function locked(tag) {
    if (focus && tag !== focus && tag !== 'More') return start.focus || 'Not part of this demo';
    if (tag === 'Autounattend') return !(state.mode === 'Builder' && state.target === 'Autounattend') && S.Builder.locked;
    if (tag === 'WimUtil') return state.mode === 'ConfigReview' && S.Builder.wimLocked;
    return false;
  }

  // ---- Title bar, mode bar, nav ----

  function titleBar() {
    var sh = app.shell, C = S.common;
    var modes = sh.modes.map(function (m) {
      return '<button type="button" class="wd-mode' + (state.mode === m.id ? ' is-on' : '') + '" data-mode="' + m.id +
        '" title="' + esc(m.tooltip) + '" aria-pressed="' + (state.mode === m.id) + '">' +
        '<img src="' + asset(m.image) + '" alt=""><span class="wd-mode-text">' + esc(m.label) + '</span></button>';
    }).join('<span class="wd-mode-sep"></span>');
    var buttons = sh.buttons.map(function (b) {
      var style = b.color ? ' style="color:' + b.color + '"' : '';
      if (b.label) {
        return '<a class="wd-tb-btn wd-tb-pill" href="' + esc(b.href) + '" target="_blank" rel="noopener" data-stop="1" title="' + esc(b.tooltip || '') + '">' +
          '<span' + style + '>' + glyph(b.icon, 'wd-heart') + '</span><span class="wd-tb-pill-text">' + esc(b.label) + '</span></a>';
      }
      if (b.name === 'WindowsFilterButton') {
        var tip = state.filterOn ? C.filterOn + '\n' + C.filterOnText : C.filterOff + '\n' + C.filterOffText;
        return '<button type="button" class="wd-tb-btn wd-tb-filter" data-tb="' + b.name + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '"' +
          (state.mode === 'Normal' ? '' : ' disabled') + '>' + glyph(state.filterOn ? b.icon : sh.filterOffIcon) + '</button>';
      }
      if (b.href) return '<a class="wd-tb-btn" href="' + esc(b.href) + '" target="_blank" rel="noopener" data-stop="1" title="' + esc(b.tooltip || '') + '" aria-label="' + esc(b.tooltip || b.name) + '"' + style + '>' + glyph(b.icon) + '</a>';
      return '<button type="button" class="wd-tb-btn" data-tb="' + b.name + '" title="' + esc(b.tooltip || '') + '" aria-label="' + esc(b.tooltip || b.name) + '"' + style + '>' + glyph(b.icon) + '</button>';
    }).join('');
    return '<div class="wd-titlebar" style="height:' + sh.titleBarHeight + 'px">' +
      '<button type="button" class="wd-tb-btn wd-pane" data-act="pane" title="' + esc(sh.paneToggleLabel) + '" aria-label="' + esc(sh.paneToggleLabel) + '" aria-expanded="' + state.paneOpen + '">' + glyph(sh.paneToggle) + '</button>' +
      appIcon('wd-appicon') +
      '<span class="wd-title">' + esc(sh.title) + '</span><span class="wd-by">' + esc(sh.by) + '</span>' +
      '<div class="wd-modes"><span class="wd-mode-label">' + esc(sh.modeLabel) + '</span><div class="wd-mode-group">' + modes + '</div></div>' +
      '<div class="wd-tb-buttons">' + buttons + '</div>' +
      '<div class="wd-caption" aria-hidden="true"><span>' + glyph('Fluent/Subtract') + '</span><span>' + glyph('Fluent/Maximize') + '</span><span>' + glyph('Fluent/Dismiss') + '</span></div>' +
      '</div>';
  }

  function modeImage(id) {
    for (var i = 0; i < app.shell.modes.length; i++) if (app.shell.modes[i].id === id) return asset(app.shell.modes[i].image);
    return '';
  }

  // MainWindow.xaml's BuilderModeBar / ReviewModeBar: an accent strip under the title bar.
  function modeBar() {
    if (state.mode === 'Normal') return '';
    var B = S.Builder, C = S.common;
    var barButton = function (act, icon, text, cls, disabled) {
      return '<button type="button" class="wd-modebar-btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + (disabled ? ' disabled' : '') + '>' + glyph(icon) + '<span>' + esc(text) + '</span></button>';
    };
    if (state.mode === 'Builder') {
      var radio = function (id, label) {
        return '<label class="wd-radio wd-radio-on-accent"><input type="radio" name="wd-target" data-target="' + id + '"' + (state.target === id ? ' checked' : '') + '><span class="wd-radio-dot"></span><span>' + esc(label) + '</span></label>';
      };
      return '<div class="wd-modebar"><img src="' + modeImage('Builder') + '" alt=""><strong>' + esc(B.title) + '</strong>' +
        '<span class="wd-modebar-desc">' + esc(B.description) + '</span>' +
        '<span class="wd-modebar-targets">' + radio('Config', B.targetConfig) + radio('Autounattend', B.targetAutounattend) + '</span>' +
        barButton('save', 'Fluent/DocumentSave', state.target === 'Autounattend' ? B.saveAutounattend : B.saveConfig, 'wd-modebar-save') +
        barButton('mode-cancel', 'Fluent/Dismiss', C.cancel) + '</div>';
    }
    return '<div class="wd-modebar"><img src="' + modeImage('ConfigReview') + '" alt=""><strong>' + esc(B.reviewTitle) + '</strong>' +
      '<span class="wd-modebar-desc">' + esc(B.reviewDescription) + '</span><span class="wd-modebar-status">' + esc(reviewStatus()) + '</span>' +
      barButton('review-apply', 'Fluent/Checkmark', B.reviewApply, 'wd-modebar-save', !canApply()) + barButton('mode-cancel', 'Fluent/Dismiss', C.cancel) + '</div>';
  }

  function navButton(b) {
    var lock = locked(b.tag);
    var on = state.page === b.tag;
    return '<button type="button" class="wd-nav-btn' + (on ? ' is-on' : '') + (lock ? ' is-locked' : '') +
      '" data-nav="' + b.tag + '" title="' + esc(lock || b.label) + '"' + (lock ? ' aria-disabled="true"' : '') +
      (on ? ' aria-current="page"' : '') + '><span class="wd-nav-content">' + glyph(b.icon) + '<span class="wd-nav-label">' + esc(b.label) + '</span></span>' +
      (lock ? '<span class="wd-nav-lock">' + glyph(app.shell.lockIcon) + '</span>' : '') + navBadge(b.tag).replace('wd-infobadge', 'wd-infobadge wd-nav-badge') + '</button>';
  }

  function moreMenu() {
    return '<div class="wd-flyout wd-flyout-more" role="menu">' + app.shell.moreMenu.map(function (m) {
      if (m.separator) return '<div class="wd-flyout-sep" role="separator"></div>';
      var text = m.version !== undefined ? m.version + 'v' + app.version : m.label;
      var inner = '<span class="wd-flyout-icon"' + (m.color ? ' style="color:' + m.color + '"' : '') + '>' + glyph(m.icon) + '</span><span>' + esc(text) + '</span>';
      if (m.href) return '<a class="wd-flyout-item" role="menuitem" href="' + esc(m.href) + '" target="_blank" rel="noopener" data-more-link="1">' + inner + '</a>';
      return '<button type="button" class="wd-flyout-item' + (m.disabled ? ' is-disabled' : '') + '" role="menuitem"' + (m.disabled ? ' disabled' : ' data-act="more-item"') + '>' + inner + '</button>';
    }).join('') + '</div>';
  }

  function nav() {
    var n = app.shell.nav;
    return '<nav class="wd-nav" aria-label="Winhance">' +
      '<div class="wd-nav-group">' + n.top.map(navButton).join('') + '</div>' +
      '<div class="wd-nav-group wd-nav-bottom">' + n.bottom.map(navButton).join('') + '</div>' +
      (state.menu === 'more' ? moreMenu() : '') +
      '</nav>';
  }

  // ---- Shared controls ----

  // PageHeader.xaml: a 64px colour icon, the title at 30 bold and a caption, with the page's actions
  // (the search box) bottom-aligned on the right.
  function pageHeader(page, title, subtitle, actions) {
    return '<header class="wd-header"><div class="wd-header-main">' + glyph(app.shell.pageIcons[page].large, 'wd-header-icon') +
      '<div class="wd-header-text"><h3 class="wd-header-title">' + esc(title) + '</h3>' +
      (subtitle ? '<p class="wd-header-sub">' + esc(subtitle) + '</p>' : '') + '</div></div>' +
      (actions ? '<div class="wd-header-actions">' + actions + '</div>' : '') + '</header>';
  }

  function searchBox() {
    var C = S.common;
    return '<label class="wd-search"><input type="search" placeholder="' + esc(C.search) + '" value="' + esc(state.query) + '" data-act="search" aria-label="' + esc(C.search) + '">' +
      '<span class="wd-search-btn">' + glyph('Fluent/Search') + '</span></label>';
  }

  function dropDown(id, content, flyout, opts) {
    opts = opts || {};
    var open = state.menu === id;
    return '<div class="wd-menu' + (opts.cls ? ' ' + opts.cls : '') + '"' + attr('title', opts.title) + '><button type="button" class="wd-btn wd-dd" data-menu="' + id + '" aria-expanded="' + open + '"' + (opts.disabled ? ' disabled' : '') + attr('title', opts.tip) + '>' +
      content + chevron() + '</button>' + (open ? '<div class="wd-flyout' + (opts.left ? ' wd-flyout-left' : '') + '" role="menu">' + flyout + '</div>' : '') + '</div>';
  }

  function menuItem(attrs, icon, text, extra) {
    return '<button type="button" class="wd-flyout-item" role="menuitem" ' + attrs + '><span class="wd-flyout-icon">' + icon + '</span><span>' + esc(text) + '</span>' + (extra || '') + '</button>';
  }

  // ToggleMenuFlyoutItem: a check column, then the icon and text.
  function toggleItem(act, on, icon, text, tip) {
    return '<button type="button" class="wd-flyout-item wd-flyout-toggle" role="menuitemcheckbox" aria-checked="' + on + '" data-act="' + act + '"' + attr('title', tip) + '>' +
      '<span class="wd-flyout-check">' + (on ? glyph('Fluent/Checkmark') : '') + '</span><span class="wd-flyout-icon">' + icon + '</span><span>' + esc(text) + '</span></button>';
  }

  function radioItem(attrs, on, text) {
    return '<button type="button" class="wd-flyout-item wd-flyout-toggle" role="menuitemradio" aria-checked="' + on + '" ' + attrs + '>' +
      '<span class="wd-flyout-check">' + (on ? '<span class="wd-radio-mark"></span>' : '') + '</span><span>' + esc(text) + '</span></button>';
  }

  function checkbox(attrs, on, label, cls) {
    return '<label class="wd-checkbox' + (cls ? ' ' + cls : '') + '"><input type="checkbox" ' + attrs + (on ? ' checked' : '') + '>' +
      '<span class="wd-checkbox-box">' + glyph('Fluent/Checkmark') + '</span>' + (label ? '<span>' + esc(label) + '</span>' : '') + '</label>';
  }

  function newTag(text) { return '<span class="wd-new">' + esc(text) + '</span>'; }

  // ---- Optimize / Customize (SectionPageShell.xaml) ----

  function areaFeatures(area) { return app.features.filter(function (f) { return f.area === area; }); }

  function navRow(area) {
    var C = S.common, P = S[area], mi = app.shell.menuIcons;
    var crumbs = '<button type="button" class="wd-btn wd-crumb" data-act="up">' + glyph(app.shell.pageIcons[area].small, 'wd-crumb-icon') + '<span>' + esc(P.title) + '</span></button>';
    if (state.feature) {
      var f = featureById(state.feature);
      var list = areaFeatures(area).map(function (x) {
        return '<button type="button" class="wd-flyout-item wd-section-item" role="menuitem" data-feature="' + x.id + '"><span class="wd-flyout-icon">' + glyph(x.icon) + '</span><span>' + esc(x.name) + '</span>' + featuresBadge([x]) + '</button>';
      }).join('');
      crumbs += glyph('Fluent/ChevronRight', 'wd-crumb-sep') +
        dropDown('section', glyph(f.icon, 'wd-crumb-icon') + '<span>' + esc(f.name) + '</span>' + featuresBadge([f]), list, { cls: 'wd-crumb-dd', left: true });
    }
    // SectionPage.UpdateQuickActionsForReviewMode: in review the two actions accept or reject the changes.
    var quick = inReview()
      ? menuItem('data-quick="accept"', glyph('Fluent/Checkmark'), S.Builder.acceptAll) + menuItem('data-quick="reject"', glyph('Fluent/Dismiss'), S.Builder.rejectAll)
      : menuItem('data-quick="recommended"', glyph('Fluent/StarFilled'), C.applyRecommended) + menuItem('data-quick="default"', glyph(mi.windowsDefaults), C.resetDefaults);
    if (state.mode === 'Builder') {
      quick += '<div class="wd-flyout-sep" role="separator"></div>' +
        menuItem('data-quick="include"', glyph('Fluent/Checkmark'), C.includeAll) +
        menuItem('data-quick="exclude"', glyph('Fluent/Dismiss'), C.excludeAll);
    }
    var view = toggleItem('tech', state.techOn, glyph('Fluent/Info'), C.technicalDetails, C.technicalDetailsTip) +
      toggleItem('badges', state.badgesOn, glyph(mi.infoBadges), C.infoBadges, C.infoBadgesTip) +
      toggleItem('new', state.newOn, glyph(mi.newBadges), C.newBadges, C.newBadgesTip);
    if (inReview()) view += '<div class="wd-flyout-sep" role="separator"></div>' + toggleItem('only', state.review.only, glyph(mi.onlyChanges), S.Builder.onlyChanges, S.Builder.onlyChangesTip);
    return '<div class="wd-navrow"><div class="wd-crumbs">' + crumbs + '</div>' +
      dropDown('quick', glyph('Fluent/Flash', 'wd-dd-icon') + '<span class="wd-dd-text">' + esc(C.quickActions) + '</span>', quick, { cls: 'wd-quick-dd' }) +
      dropDown('view', glyph('Fluent/Eye', 'wd-dd-icon') + '<span class="wd-dd-text">' + esc(C.view) + '</span>', view) + '</div>';
  }

  function countPills(f) {
    var c = featureCounts(f), C = S.common, bi = app.shell.badgeIcons;
    if (!state.badgesOn || !c.total) return '';
    return '<span class="wd-pills"><span class="wd-pill wd-pill-rec' + (c.rec ? '' : ' is-zero') + '">' + glyph(bi.recommended) + esc(C.recommended + ' ' + c.rec + '/' + c.total) + '</span>' +
      '<span class="wd-pill wd-pill-def' + (c.def ? '' : ' is-zero') + '">' + glyph(bi.default) + esc(C.default + ' ' + c.def + '/' + c.total) + '</span></span>';
  }

  function overview(area) {
    return '<div class="wd-sections">' + areaFeatures(area).map(function (f) {
      var c = featureCounts(f);
      return '<button type="button" class="wd-scard wd-section" data-feature="' + f.id + '">' + glyph(f.icon, 'wd-section-icon') +
        '<span class="wd-scard-text"><span class="wd-scard-header"><span>' + esc(f.name) + '</span>' + (state.newOn && c.isNew ? newTag(S.common.newBadge + ' ' + c.isNew) : '') + '</span>' +
        '<span class="wd-scard-desc">' + esc(f.groups) + '</span></span>' +
        featuresBadge([f]) + countPills(f) + glyph('Fluent/ChevronRight', 'wd-section-chev') + '</button>';
    }).join('') + '</div>';
  }

  // SettingDescriptionWithBadges: Preference, Recommended, Default, dimmed when the value isn't there.
  function badgeRow(s) {
    if (!state.badgesOn) return '';
    var C = S.common, bi = app.shell.badgeIcons, row = '';
    if (s.preference) row += '<span class="wd-pill wd-pill-pref" title="' + esc(C.preferenceTip) + '">' + glyph(bi.preference) + esc(C.preference) + '</span>';
    if (hasChoices(s)) {
      if (s.recommended.length) row += '<span class="wd-pill wd-pill-rec' + (matches(s, s.recommended) ? '' : ' is-dim') + '" title="' + esc(C.recommendedTip) + '">' + glyph(bi.recommended) + esc(C.recommended) + '</span>';
      if (s.windowsDefault.length) row += '<span class="wd-pill wd-pill-def' + (matches(s, s.windowsDefault) ? '' : ' is-dim') + '" title="' + esc(C.defaultTip) + '">' + glyph(bi.default) + esc(C.default) + '</span>';
    }
    return row ? '<span class="wd-badges">' + row + '</span>' : '';
  }

  function quickSet(s) {
    if (!state.badgesOn || !hasChoices(s)) return '';
    var C = S.common, out = '', dis = inReview() ? ' disabled' : '';
    if (s.recommended.length) out += '<button type="button" class="wd-quick wd-quick-rec" data-set="' + s.id + '" data-to="' + s.recommended[0] + '" title="' + esc(fmt(C.setToRecommended, optionText(s, s.recommended[0]))) + '"' + dis + '>' + glyph('Fluent/StarFilled') + '</button>';
    if (s.windowsDefault.length) out += '<button type="button" class="wd-quick wd-quick-def" data-set="' + s.id + '" data-to="' + s.windowsDefault[0] + '" title="' + esc(fmt(C.setToDefault, optionText(s, s.windowsDefault[0]))) + '"' + dis + '>' + glyph(app.shell.badgeIcons.default) + '</button>';
    return out ? '<span class="wd-quickset">' + out + '</span>' : '';
  }

  // SettingItemViewModel.EffectiveIsEnabled: every control is read-only while a config is in review.
  function control(s) {
    var dis = inReview() ? ' disabled' : '';
    if (s.control === 'Toggle') {
      return '<label class="wd-toggle' + (dis ? ' is-disabled' : '') + '"><span class="wd-toggle-text">' + esc(isOn(s) ? S.common.on : S.common.off) + '</span>' +
        '<input type="checkbox" role="switch" data-toggle="' + s.id + '"' + (isOn(s) ? ' checked' : '') + dis + ' aria-label="' + esc(s.name) + '"><span class="wd-toggle-track"></span></label>';
    }
    if (s.control === 'CheckBox') return checkbox('data-toggle="' + s.id + '" aria-label="' + esc(s.name) + '"' + dis, isOn(s), '', dis ? 'is-disabled' : '');
    if (s.control === 'Action') return '<button type="button" class="wd-btn" data-action="' + s.id + '"' + dis + '>' + esc(s.options[0] || s.name) + '</button>';
    if (s.control === 'TextBox' || s.control === 'List') return '<input class="wd-textbox" type="text" aria-label="' + esc(s.name) + '"' + dis + '>';
    return '<span class="wd-combo"><select data-select="' + s.id + '" aria-label="' + esc(s.name) + '"' + dis + '>' +
      s.options.map(function (o, i) { return '<option value="' + i + '"' + (value(s) === i ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
      '</select>' + chevron() + '</span>';
  }

  // TechnicalDetailsPanel.xaml: a thin informational bar attached under the card, opening the docs' own
  // OptionMatrixView mirror.
  function techPanel(s) {
    if (!state.techOn) return '';
    var open = !!state.techOpen[s.id];
    return '<button type="button" class="wd-tech-bar' + (open ? ' is-open' : '') + '" data-tech="' + s.id + '" aria-expanded="' + open + '">' + glyph('Fluent/Info', 'wd-tech-info') +
      '<span>' + esc(S.common.technicalDetails) + '</span>' + glyph(open ? 'Fluent/ChevronUp' : 'Fluent/ChevronDown', 'wd-tech-chev') + '</button>' +
      (open ? '<div class="wd-tech" data-tech-body="' + s.id + '"></div>' : '');
  }

  // SettingTemplates' review diff banner: a warning InfoBar attached under the card, the change in one line
  // and Apply / Don't apply beside it.
  function diffBar(s) {
    if (!hasDiff(s)) return '';
    var B = S.Builder, d = decision(s);
    var radio = function (apply, label) {
      return '<label class="wd-radio"><input type="radio" name="wd-decide-' + s.id + '" data-decide="' + s.id + '" value="' + (apply ? 1 : 0) + '"' +
        (d === apply ? ' checked' : '') + '><span class="wd-radio-dot"></span><span>' + esc(label) + '</span></label>';
    };
    return '<div class="wd-infobar wd-infobar-warning wd-diff">' + glyph('Fluent/ErrorCircleColor') +
      '<span class="wd-diff-text">' + esc(fmt(B.diff, diffText(s, value(s)), diffText(s, configValue(s)))) + '</span>' +
      radio(true, B.apply) + radio(false, B.dontApply) + '</div>';
  }

  function card(s, kind, kids) {
    var expanded = kind === 'parent' && !state.collapsed[s.id];
    var cls = 'wd-scard wd-setting-card' + (kind === 'parent' ? ' wd-parent' : '') + (kind === 'child' ? ' wd-child' : '') +
      (state.techOn || expanded || hasDiff(s) ? ' is-attached' : '') + (state.excluded[s.id] ? ' is-excluded' : '');
    var head = '<div class="' + cls + '"' + (kind === 'parent' ? ' data-expand="' + s.id + '"' : '') + '>' +
      (kind === 'child' ? '' : (s.icon ? glyph(s.icon, 'wd-scard-icon') : '<span class="wd-scard-icon"></span>')) +
      '<div class="wd-scard-text"><div class="wd-scard-header"><span>' + esc(s.name) + '</span>' + (state.newOn && s.isNew ? newTag(S.common.newBadge) : '') + '</div>' +
      (s.description ? '<div class="wd-scard-desc">' + esc(s.description) + '</div>' : '') + badgeRow(s) + '</div>' +
      '<div class="wd-scard-control">' + quickSet(s) + control(s) +
      (kind === 'parent' ? '<span class="wd-expand-chev">' + glyph(expanded ? 'Fluent/ChevronUp' : 'Fluent/ChevronDown') + '</span>' : '') + '</div></div>';
    var children = expanded ? kids.map(function (k) { return card(k, 'child', []); }).join('') : '';
    return '<div class="wd-setting" data-card="' + s.id + '">' + head + techPanel(s) + diffBar(s) + children + '</div>';
  }

  function settingsList(settings) {
    if (inReview() && state.review.only) settings = settings.filter(hasDiff);
    var byParent = {}, ids = {};
    settings.forEach(function (s) { ids[s.id] = true; if (s.parent) (byParent[s.parent] = byParent[s.parent] || []).push(s); });
    var html = '', group = null;
    settings.forEach(function (s) {
      if (s.parent && ids[s.parent]) return;
      if (s.group !== group) {
        group = s.group;
        if (group) html += '<h4 class="wd-group">' + esc(group) + '</h4>';
      }
      var kids = byParent[s.id] || [];
      html += card(s, kids.length ? 'parent' : 'single', kids);
    });
    return html;
  }

  function searchHits(features) {
    var q = state.query.trim().toLowerCase();
    var html = '';
    features.forEach(function (f) {
      var hits = f.settings.filter(function (s) { return (s.name + ' ' + s.description + ' ' + s.group).toLowerCase().indexOf(q) >= 0; });
      if (!hits.length) return;
      html += '<h4 class="wd-group wd-group-feature">' + esc(f.name) + '</h4>' + hits.map(function (s) { return card(s, 'single', []); }).join('');
    });
    return html;
  }

  function content(inner, cls) {
    return '<div class="wd-content' + (cls ? ' ' + cls : '') + '"><div class="wd-scroll"><div class="wd-column">' + inner + '</div></div></div>';
  }

  function settingsPage(area) {
    var P = S[area];
    var body;
    if (state.query.trim()) body = searchHits(state.feature ? [featureById(state.feature)] : areaFeatures(area));
    else if (state.feature) body = settingsList(featureById(state.feature).settings);
    else body = overview(area);
    return pageHeader(area, P.title, P.subtitle, searchBox()) + navRow(area) + content(body, state.feature || state.query.trim() ? 'is-list' : '');
  }

  // The Unattend page: its header, then the answer-file settings straight under it (AutounattendPage.xaml).
  function unattendPage() {
    var P = S.Autounattend, f = featureById('Autounattend');
    state.feature = 'Autounattend';
    var body = state.query.trim() ? searchHits([f]) : settingsList(f.settings);
    return pageHeader('Autounattend', P.title, '', searchBox()) + '<div class="wd-gap"></div>' + content(body, 'is-list');
  }

  // ---- Software & Apps (SoftwareAppsPage.xaml) ----

  var appKinds = { windows: ['windows', 'capabilities', 'optionalFeatures'], external: ['external'] };

  function keyOf(kind, a) { return kind + ':' + a.name; }

  function searchApps(list) {
    var q = state.query.trim().toLowerCase();
    return q ? list.filter(function (a) { return (a.name + ' ' + a.description).toLowerCase().indexOf(q) >= 0; }) : list;
  }

  function sorted(list) {
    var by = function (a, b) { return a.name.localeCompare(b.name); };
    var out = list.slice();
    if (state.appsSort === 'za') out.sort(function (a, b) { return by(b, a); });
    else if (state.appsSort === 'az') out.sort(by);
    else out.sort(function (a, b) { return (b.installed ? 1 : 0) - (a.installed ? 1 : 0) || by(a, b); });
    return out;
  }

  function tabItems() {
    var out = [];
    appKinds[state.appsTab].forEach(function (kind) {
      searchApps(app.apps[kind]).forEach(function (a) { out.push({ key: keyOf(kind, a), app: a, kind: kind }); });
    });
    return out;
  }


  // AppItemViewModel's InstalledStatusTooltip / ReinstallableStatusTooltip on the status icons.
  function statusIcon(a) {
    var P = S.SoftwareApps;
    return '<span class="wd-status-icon" title="' + esc(a.installed ? P.installedTip : P.notInstalledTip) + '">' + glyph(a.installed ? 'Fluent/CheckmarkCircleColor' : 'Fluent/DismissCircleColor', 'wd-row-icon') + '</span>';
  }

  function installableIcon(a) {
    var P = S.SoftwareApps;
    return '<span class="wd-status-icon" title="' + esc(a.permanent ? P.permanentTip : P.installableTip) + '">' + glyph(a.permanent ? 'Fluent/FlagColor' : 'Fluent/ApprovalsAppColor', 'wd-row-icon') + '</span>';
  }

  // One cell of demo/icons/atlas.webp: the background scales with the box, so any icon size works.
  function appIconHtml(a, cls) {
    if (a.icon === undefined) return glyph(a.glyph, 'wd-app-fallback ' + cls);
    var at = app.shell.iconAtlas;
    var x = (a.icon % at.columns) / (at.columns - 1) * 100, y = Math.floor(a.icon / at.columns) / (at.rows - 1) * 100;
    return '<span class="wd-app-img ' + cls + '" style="background-position:' + x.toFixed(3) + '% ' + y.toFixed(3) + '%"></span>';
  }

  function linkButton(a) {
    return a.website ? '<a class="wd-link-btn" href="' + esc(a.website) + '" target="_blank" rel="noopener" title="' + esc(a.website) + '" data-stop="1">' + glyph('Fluent/Open') + '</a>' : '';
  }

  function actionBar() {
    // SoftwareAppsViewModel.UpdateButtonStates: both buttons need something ticked on the open tab.
    var P = S.SoftwareApps, n = pickedIn(state.appsTab);
    var btn = function (act, icon, text, enabled, cls) {
      return '<button type="button" class="wd-btn wd-ab-btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" title="' + esc(text) + '"' + (enabled ? '' : ' disabled') + '>' + glyph(icon, 'wd-ab-icon') + '<span class="wd-ab-text">' + esc(text) + '</span></button>';
    };
    var view = function (id, icon, tip) {
      return '<button type="button" class="wd-view-btn' + (state.appsView === id ? ' is-on' : '') + '" data-view="' + id + '" title="' + esc(tip) + '" aria-pressed="' + (state.appsView === id) + '">' + glyph(icon) + '</button>';
    };
    var sort = radioItem('data-sort="installedFirst"', state.appsSort === 'installedFirst', P.sortInstalledFirst) +
      radioItem('data-sort="az"', state.appsSort === 'az', P.sortAZ) + radioItem('data-sort="za"', state.appsSort === 'za', P.sortZA);
    var tableView = state.appsView === 'table';
    // In review the two buttons become toggles that pick what happens to the ticked apps on this tab.
    var action = function (act, icon, text) {
      var on = state.review.action[state.appsTab] === act;
      return '<button type="button" class="wd-btn wd-ab-btn wd-ab-main wd-ab-toggle' + (on ? ' is-on' : '') + '" data-review-action="' + act + '" aria-pressed="' + on + '" title="' + esc(text) + '">' +
        glyph(icon, 'wd-ab-icon') + '<span class="wd-ab-text">' + esc(text) + '</span></button>';
    };
    var main = inReview()
      ? action('install', 'Fluent/ArrowDownload', P.install) + action('remove', 'Fluent/Delete', P.uninstall)
      : btn('install', 'Fluent/ArrowDownload', P.install, n > 0, 'wd-ab-main') + btn('uninstall', 'Fluent/Delete', P.uninstall, n > 0, 'wd-ab-main');
    return '<div class="wd-actionbar">' + main +
      '<span class="wd-ab-sep"></span>' +
      btn('refresh', 'Fluent/ArrowSync', P.refresh, true) +
      '<div class="wd-menu">' + btn('help', 'Fluent/QuestionCircle', P.help, true) + (state.menu === 'help' ? helpFlyout() : '') + '</div>' +
      '<span class="wd-view-switch" role="group">' + view('card', 'Fluent/Grid', P.viewCard) + view('table', 'Fluent/LineHorizontal3', P.viewTable) + view('compact', 'Fluent/TableSimple', P.viewCompact) + '</span>' +
      dropDown('sort', glyph('Fluent/ArrowSort', 'wd-ab-icon') + '<span class="wd-ab-text">' + esc(P.sort) + '</span>', sort, { disabled: tableView, title: tableView ? P.sortTableHint : '', tip: P.sort }) +
      '</div>';
  }

  // WindowsAppsHelpContent / ExternalAppsHelpContent.
  function helpFlyout() {
    var P = S.SoftwareApps, sh = app.shell;
    var legendItem = function (icon, text) { return '<span class="wd-legend-item">' + glyph(icon) + '<span>' + esc(text) + '</span></span>'; };
    var body;
    if (state.appsTab === 'windows') {
      body = '<div class="wd-legend">' + legendItem('Fluent/CheckmarkCircleColor', P.installed) + legendItem('Fluent/ApprovalsAppColor', P.installable) +
        legendItem('Fluent/DismissCircleColor', P.notInstalled) + legendItem('Fluent/FlagColor', P.permanent) + legendItem('Fluent/ErrorCircleColor', P.warning) + '</div>' +
        '<div class="wd-help-sep"></div><div class="wd-help-status"><strong>' + esc(P.helpStatus) + '</strong><span class="wd-help-removal">' +
        sh.removal.map(function (r) { return '<button type="button" class="wd-help-removal-btn" disabled title="' + esc(r.name) + '">' + glyph(r.icon) + '</button>'; }).join('') + '</span></div>' +
        '<div class="wd-help-sep"></div><p class="wd-help-text">' + esc(P.helpWindows) + '</p><a class="wd-help-link" href="' + sh.helpLinks.windows + '">' + esc(P.helpWindowsMore) + '</a>';
    } else {
      body = '<p class="wd-help-text">' + esc(P.helpExternal) + '</p><a class="wd-help-link" href="' + sh.helpLinks.external + '">' + esc(P.helpExternalMore) + '</a>';
    }
    return '<div class="wd-flyout wd-help" role="dialog" aria-label="' + esc(P.help) + '">' + body + '</div>';
  }

  function tabs() {
    var P = S.SoftwareApps, ti = app.shell.tabIcons;
    var tab = function (id, icon, label) {
      var on = state.appsTab === id;
      // SoftwareAppsPage.UpdateTabBadges: in review, each tab carries the count of its ticked apps.
      var count = inReview() ? pickedIn(id) : 0;
      return '<button type="button" class="wd-tab' + (on ? ' is-on' : '') + '" data-tab="' + id + '" role="tab" aria-selected="' + on + '">' + glyph(icon) + '<span>' + esc(label) + '</span>' +
        (count ? '<span class="wd-infobadge wd-tab-badge">' + count + '</span>' : '') + '</button>';
    };
    return '<div class="wd-tabs" role="tablist">' + tab('windows', ti.windows, P.tabWindows) + '<span class="wd-tabs-divider"></span>' + tab('external', ti.external, P.tabExternal) + '</div>';
  }

  var pickFilters = {
    all: function () { return true; },
    installed: function (a) { return !!a.installed; },
    not: function (a) { return !a.installed; },
  };

  function selectRow() {
    var P = S.SoftwareApps, items = tabItems();
    var box = function (kind, label) {
      var cover = items.filter(function (i) { return pickFilters[kind](i.app); });
      var on = cover.length > 0 && cover.every(function (i) { return state.picked[i.key]; });
      return checkbox('data-pickall="' + kind + '"', on, label);
    };
    return '<div class="wd-pickall-row">' + box('all', P.selectAll) + box('installed', P.selectAllInstalled) + box('not', P.selectAllNotInstalled) + '</div>';
  }

  function cardPills(a) {
    var P = S.SoftwareApps;
    var pill = function (kind, icon, text, tip) {
      return '<span class="wd-app-pill wd-app-pill-' + kind + '" title="' + esc(tip) + '">' + glyph(icon) + '<span>' + esc(text) + '</span></span>';
    };
    var pills = (a.installed ? pill('installed', 'Fluent/CheckmarkCircleColor', P.installed, P.installedTip) : '') +
      (a.permanent ? pill('permanent', 'Fluent/FlagColor', P.permanent, P.permanentTip) : '') +
      (a.warning ? pill('warning', 'Fluent/ErrorCircleColor', P.warning, P.warningTip) : '');
    return pills ? '<span class="wd-app-pills">' + pills + '</span>' : '';
  }

  function appCard(item) {
    var a = item.app, on = !!state.picked[item.key];
    return '<div class="wd-app-card' + (on ? ' is-on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + on + '" data-pick="' + esc(item.key) + '">' +
      '<span class="wd-checkbox"><span class="wd-checkbox-box' + (on ? ' is-checked' : '') + '">' + glyph('Fluent/Checkmark') + '</span></span>' +
      '<span class="wd-app-icon">' + appIconHtml(a, '') + '</span>' +
      '<span class="wd-app-text"><span class="wd-app-name-row"><span class="wd-app-name">' + esc(a.name) + '</span>' + linkButton(a) + '</span>' +
      (a.description ? '<span class="wd-app-desc">' + esc(a.description) + '</span>' : '') + cardPills(a) + '</span></div>';
  }

  function compactRow(item) {
    var a = item.app, on = !!state.picked[item.key];
    var status = item.kind === 'external' ? '' : statusIcon(a) + installableIcon(a);
    return '<label class="wd-compact-row" title="' + esc(a.description) + '"><input type="checkbox" data-pick="' + esc(item.key) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="wd-checkbox-box">' + glyph('Fluent/Checkmark') + '</span>' + status +
      '<span class="wd-row-app">' + appIconHtml(a, '') + '</span><span class="wd-compact-name">' + esc(a.name) + '</span>' +
      (a.warning ? glyph('Fluent/ErrorCircleColor', 'wd-row-icon') : '') + '</label>';
  }

  function sections() {
    var P = S.SoftwareApps, out = [];
    if (state.appsTab === 'windows') {
      [['windows', P.sectionApps], ['capabilities', P.sectionCapabilities], ['optionalFeatures', P.sectionFeatures]].forEach(function (s) {
        out.push({ title: s[1], items: sorted(searchApps(app.apps[s[0]])).map(function (a) { return { key: keyOf(s[0], a), app: a, kind: s[0] }; }) });
      });
    } else {
      var groups = {};
      searchApps(app.apps.external).forEach(function (a) { (groups[a.group] = groups[a.group] || []).push(a); });
      Object.keys(groups).sort().forEach(function (g) {
        out.push({ title: groups[g][0].groupName, id: g, items: sorted(groups[g]).map(function (a) { return { key: keyOf('external', a), app: a, kind: 'external' }; }) });
      });
    }
    return out.filter(function (s) { return s.items.length; });
  }

  function cardView() {
    return '<div class="wd-apps-stack">' + selectRow() + sections().map(function (s) {
      return '<section class="wd-apps-section"><h4 class="wd-apps-title">' + esc(s.title) + '</h4><div class="wd-app-grid">' + s.items.map(appCard).join('') + '</div></section>';
    }).join('') + '</div>';
  }

  function compactView() {
    return '<div class="wd-apps-stack wd-compact-stack">' + selectRow() + sections().map(function (s) {
      var rows = '<div class="wd-compact-grid">' + s.items.map(compactRow).join('') + '</div>';
      if (state.appsTab === 'external') {
        var open = !state.groupsClosed[s.id];
        return '<section class="wd-expander' + (open ? ' is-open' : '') + '"><button type="button" class="wd-expander-head" data-group="' + esc(s.id) + '" aria-expanded="' + open + '"><span>' + esc(s.title) + '</span>' +
          glyph(open ? 'Fluent/ChevronUp' : 'Fluent/ChevronDown', 'wd-expander-chev') + '</button>' + (open ? '<div class="wd-expander-body">' + rows + '</div>' : '') + '</section>';
      }
      return '<section class="wd-apps-section"><h4 class="wd-apps-title">' + esc(s.title) + '</h4>' + rows + '</section>';
    }).join('') + '</div>';
  }

  // The DataGrid: one flat list per tab, sortable by clicking a header.
  function tableView() {
    var P = S.SoftwareApps, windows = state.appsTab === 'windows';
    var cols = windows
      ? [['name', P.colName, 'is-name'], ['description', P.colDescription, 'is-desc'], ['type', P.colType, ''], ['installed', P.colStatus, ''], ['permanent', P.colInstallable, '']]
      : [['name', P.colName, 'is-name'], ['description', P.colDescription, 'is-desc'], ['groupName', P.colGroup, ''], ['installed', P.colStatus, 'is-status']];
    var items = tabItems();
    var ts = state.tableSort;
    if (ts) {
      items.sort(function (x, y) {
        var a = x.app[ts.col], b = y.app[ts.col];
        var r = typeof a === 'string' || typeof b === 'string' ? String(a || '').localeCompare(String(b || '')) : (a ? 1 : 0) - (b ? 1 : 0);
        return ts.dir === 'asc' ? r : -r;
      });
    }
    var all = items.length > 0 && items.every(function (i) { return state.picked[i.key]; });
    var head = '<div class="wd-tr wd-th-row"><span class="wd-th wd-td-check">' + checkbox('data-pickall="all"', all) + '</span>' + cols.map(function (c) {
      var sortGlyph = ts && ts.col === c[0] ? glyph(ts.dir === 'asc' ? 'Fluent/ChevronUp' : 'Fluent/ChevronDown', 'wd-th-sort') : '';
      return '<button type="button" class="wd-th ' + c[2] + '" data-col="' + c[0] + '"><span>' + esc(c[1]) + '</span>' + sortGlyph + '</button>';
    }).join('') + '</div>';
    var rows = items.map(function (i) {
      var a = i.app, on = !!state.picked[i.key];
      var status = '<span class="wd-td">' + statusIcon(a) + '<span>' + esc(a.installed ? P.installed : P.notInstalled) + '</span></span>';
      var cells = '<span class="wd-td is-name">' + appIconHtml(a, 'wd-td-icon') + '<span class="wd-td-text">' + esc(a.name) + '</span>' + (windows ? '' : linkButton(a)) + (a.warning ? glyph('Fluent/ErrorCircleColor', 'wd-row-icon') : '') + '</span>' +
        '<span class="wd-td is-desc"><span class="wd-td-text">' + esc(a.description) + '</span></span>';
      if (windows) {
        cells += '<span class="wd-td"><span class="wd-td-text">' + esc(a.type) + '</span></span>' + status +
          '<span class="wd-td">' + installableIcon(a) + '<span>' + esc(a.permanent ? P.permanent : P.installable) + '</span></span>';
      } else {
        cells += '<span class="wd-td"><span class="wd-td-text">' + esc(a.groupName) + '</span></span>' + status.replace('class="wd-td"', 'class="wd-td is-status"');
      }
      return '<div class="wd-tr' + (on ? ' is-on' : '') + '" data-row="' + esc(i.key) + '"><span class="wd-td wd-td-check">' + checkbox('data-pick="' + esc(i.key) + '"', on) + '</span>' + cells + '</div>';
    }).join('');
    return '<div class="wd-table ' + (windows ? 'is-windows' : 'is-external') + '" role="table">' + head + rows + '</div>';
  }

  function builderBanner() {
    if (inReview()) {
      var act = state.review.action[state.appsTab], B = S.Builder;
      return '<div class="wd-infobar wd-infobar-warning">' + glyph('Fluent/ErrorCircleColor') + '<span>' +
        esc(act === 'install' ? B.actionInstall : act === 'remove' ? B.actionRemove : B.selectAction) + '</span></div>';
    }
    if (state.mode !== 'Builder') return '';
    var P = S.SoftwareApps;
    var text = state.target === 'Config' ? P.builderConfig : state.appsTab === 'windows' ? P.builderWindows : P.builderExternal;
    return '<div class="wd-infobar wd-infobar-warning">' + glyph('Fluent/ErrorCircleColor') + '<span>' + esc(text) + '</span></div>';
  }

  function appsPage() {
    var P = S.SoftwareApps;
    var view = state.appsView === 'table' ? tableView() : state.appsView === 'compact' ? compactView() : cardView();
    return pageHeader('SoftwareApps', P.title, P.subtitle, searchBox()) + actionBar() +
      '<div class="wd-content wd-apps-content">' + tabs() + '<div class="wd-tab-content">' + builderBanner() +
      '<div class="wd-scroll wd-apps-scroll' + (state.appsView === 'table' ? ' is-table' : '') + '">' + view + '</div></div></div>';
  }

  // ---- WIMUtil (WimUtilPage.xaml) ----

  // WizardActionCardTemplate: icon, title and description, a status icon, then the button. A card can carry
  // more under its row (the Winhance XML card's session).
  function wimCard(icon, title, text, button, opts) {
    opts = opts || {};
    return '<div class="wd-wim-card' + (opts.after ? ' has-after' : '') + '"><div class="wd-wim-card-row">' + '<span class="wd-wim-card-icon">' + icon + '</span>' +
      '<div class="wd-wim-card-text"><div class="wd-wim-card-title">' + esc(title) + '</div>' + (text ? '<div class="wd-wim-card-desc">' + esc(text) + '</div>' : '') + (opts.extra || '') + '</div>' +
      (opts.status || '') +
      (button ? '<button type="button" class="wd-btn wd-wim-card-btn" data-wim="' + (opts.act || 'card') + '">' + esc(button) + '</button>' : '') + '</div>' + (opts.after || '') + '</div>';
  }

  function wimStep(n, icon, title, status, body, opts) {
    var open = !!state.wim.open[n];
    return '<section class="wd-wim-step' + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="wd-wim-head" data-step="' + n + '" aria-expanded="' + open + '">' + icon +
      '<span class="wd-wim-head-text"><span class="wd-wim-title">' + esc(title) + '</span><span class="wd-wim-status">' + esc(status) + '</span></span>' +
      (opts.done ? glyph('Fluent/CheckmarkCircleColor', 'wd-wim-done') : '') + glyph('Fluent/ChevronDown', 'wd-wim-chev') + '</button>' +
      (open ? '<div class="wd-wim-body">' + body + '</div>' : '') + '</section>';
  }

  // The media a visitor finds loaded: a Windows 11 ISO extracted into C:\WinhanceWIM, its install.wim
  // sized like a 25H2 image. The convert card's sums are WimImageFormatViewModel's.
  var WIM_SAMPLE = { workDir: 'C:\\WinhanceWIM', wimGb: 6.12 };

  function isWimSession() { return state.mode === 'Builder' && state.target === 'Autounattend'; }

  function wimPage() {
    var W = S.WimUtil, wi = app.shell.wimIcons, session = isWimSession(), done = state.wim.generated;
    var big = function (key) { return glyph(key, 'wd-wim-head-icon'); };
    var cardIcon = function (key) { return glyph(key, 'wd-wim-icon'); };
    var check = glyph('Fluent/CheckmarkCircleColor', 'wd-wim-card-done');
    var after = WIM_SAMPLE.wimGb * 0.65;
    var step1 = wimCard(cardIcon(wi.iso), W.selectIso, W.isoDone, W.selectIsoButton, { status: check }) +
      wimCard(cardIcon(wi.folder), W.workDir, W.using + ': ' + WIM_SAMPLE.workDir, W.selectFolder, {
        extra: checkbox('data-wim-check="1"', false, W.extractedAlready, 'wd-wim-check'),
      }) +
      '<p class="wd-wim-lead">' + esc(W.optionalConvert) + '</p>' +
      wimCard(cardIcon(wi.convert), fmt(W.convertTitle, 'WIM', 'ESD'),
        W.current + ': install.wim (' + WIM_SAMPLE.wimGb.toFixed(2) + ' GB)\n' + W.afterConversion + ': ~' + after.toFixed(2) + ' GB (' + W.save + ' ~' + (WIM_SAMPLE.wimGb - after).toFixed(2) + ' GB)',
        fmt(W.convertButton, 'ESD')) +
      '<div class="wd-wim-row"><span>' + esc(W.downloadIso) + '</span><button type="button" class="wd-btn wd-btn-sm" data-wim="card" title="' + esc(W.win10Tip) + '">' + glyph('Fluent/ArrowDownload') + esc(W.win10) + '</button>' +
      '<button type="button" class="wd-btn wd-btn-sm" data-wim="card" title="' + esc(W.win11Tip) + '">' + glyph('Fluent/ArrowDownload') + esc(W.win11) + '</button></div>';
    var rocket = '<span class="wd-wim-rocket">' + appIcon() + '</span>';
    // In a session (Builder, Autounattend target) the card holds the Autounattend settings and its own Generate.
    var sessionBody = session
      ? '<div class="wd-wim-session">' + settingsList(featureById('Autounattend').settings) +
        '<div class="wd-wim-generate"><button type="button" class="wd-btn" data-wim="generate">' + esc(W.generateNow) + '</button>' + (done ? check : '') + '</div></div>'
      : '';
    var step2 = '<p class="wd-wim-lead">' + esc(W.pickOne) + '</p>' +
      wimCard(rocket, W.generate, session ? W.generateSession : W.generateText, session ? '' : W.generateButton,
        { act: 'session', status: !session && done ? check : '', after: sessionBody }) +
      wimCard(cardIcon(wi.download), W.download, W.downloadText, W.downloadButton) +
      wimCard(cardIcon(wi.select), W.selectXml, W.selectXmlText, W.selectXmlButton) +
      '<div class="wd-wim-row"><span>' + esc(W.generateFiles) + '</span><button type="button" class="wd-btn wd-btn-sm" data-wim="card" title="' + esc(W.schneegansTip) + '">' + glyph('Fluent/Open') + esc(W.schneegans) + '</button></div>';
    var step3 = wimCard(cardIcon(wi.drivers), W.extractDrivers, W.extractDriversText, W.extractDriversButton) +
      wimCard(cardIcon(wi.folder), W.customDrivers, W.customDriversText, W.customDriversButton);
    var radio = function (id, label) {
      return '<label class="wd-radio"><input type="radio" name="wd-dest" data-dest="' + id + '"' + (state.wim.dest === id ? ' checked' : '') + '><span class="wd-radio-dot"></span><span>' + esc(label) + '</span></label>';
    };
    var usb = state.wim.dest === 'usb';
    var step4 = wimCard(cardIcon(wi.destination), W.destination, W.destinationText, '', { extra: '<div class="wd-wim-radios">' + radio('iso', W.destIso) + radio('usb', W.destUsb) + '</div>' }) +
      (usb
        ? wimCard(cardIcon(wi.usb), W.usb, W.usbText, W.usbButton, { extra: '<span class="wd-combo wd-wim-combo"><select disabled><option>' + esc(W.noUsb) + '</option></select>' + chevron() + '</span>' }) +
          '<div class="wd-infobar wd-infobar-error">' + glyph('Fluent/ErrorCircleColor') + '<span>' + esc(W.usbWarning) + '</span></div>'
        : wimCard(cardIcon(wi.output), W.output, W.outputText, W.outputButton)) +
      '<div class="wd-wim-start"><button type="button" class="wd-btn wd-btn-accent" data-wim="create">' + esc(usb ? W.writeUsb : W.createIso) + '</button></div>';
    return pageHeader('WimUtil', W.title, W.subtitle, '') + '<div class="wd-gap"></div>' +
      content(
        wimStep(1, big(wi.step1), W.step1, W.isoExtracted, step1, { done: true }) +
        wimStep(2, big(wi.step2), W.step2, done ? W.xmlAdded : W.noXml, step2, { done: done }) +
        wimStep(3, big(wi.step3), W.step3, W.noDrivers, step3, {}) +
        wimStep(4, big(wi.step4), W.step4, W.readyToCreate, step4, {}),
        'is-wim');
  }

  // ---- Settings (SettingsPage.xaml) ----

  function settingsAppPage() {
    var P = S.Settings, icons = app.shell.settingsIcons;
    var row = function (icon, title, text, controlHtml) {
      return '<div class="wd-scard">' + glyph(icon, 'wd-scard-icon') + '<div class="wd-scard-text"><div class="wd-scard-header">' + esc(title) + '</div>' +
        '<div class="wd-scard-desc">' + esc(text) + '</div></div><div class="wd-scard-control">' + controlHtml + '</div></div>';
    };
    var combo = function (act, label, options, selected) {
      return '<span class="wd-combo wd-combo-wide"><select data-act="' + act + '" aria-label="' + esc(label) + '">' + options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === selected ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>' + chevron() + '</span>';
    };
    // The language list, as the app builds it: English first, then the rest by name.
    var langs = app.shell.languages.slice().sort(function (a, b) {
      return (a.code === 'en' ? -1 : 0) - (b.code === 'en' ? -1 : 0) || a.name.localeCompare(b.name);
    }).map(function (l) { return [l.code, l.name]; });
    var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    return pageHeader('Settings', P.title, P.subtitle, '') +
      content(
        '<h4 class="wd-group">' + esc(P.general) + '</h4>' +
        row(icons.language, P.language, P.languageText, combo('language', P.language, langs, 'en')) +
        row(icons.theme, P.theme, P.themeText, combo('theme', P.theme, [['system', P.themeSystem], ['light', P.themeLight], ['dark', P.themeDark]], theme)) +
        '<h4 class="wd-group">' + esc(P.configuration) + '</h4>' +
        row(icons.backup, P.backup, P.backupText, '<button type="button" class="wd-btn" data-act="save">' + esc(P.import) + '</button><button type="button" class="wd-btn" data-act="save">' + esc(P.export) + '</button>') +
        '<h4 class="wd-group">' + esc(P.protection) + '</h4>' +
        row(icons.restorePoint, P.restorePoint, P.restorePointText, '<button type="button" class="wd-btn" data-act="save">' + esc(P.restorePointButton) + '</button>'),
        'is-list is-settings');
  }

  // ---- Dialogs (ContentDialog) ----

  // AppOperationConfirmation.Build, shown by DialogService.ShowConfirmationAsync: the tab's ticked items in list
  // order (SoftwareAppsViewModel acts on the open tab only), and on Windows Apps the removal-scripts checkbox,
  // ticked to start. External uninstall passes "uninstall" through Dialog_ConfirmOperation untranslated, as
  // the app does.
  function appsDialog(op, names) {
    if (!names) {
      names = [];
      appKinds[state.appsTab].forEach(function (kind) {
        app.apps[kind].forEach(function (a) { if (state.picked[keyOf(kind, a)]) names.push(a.name); });
      });
    }
    return { kind: 'apps', op: op, names: names, save: op === 'remove' };
  }

  function dialogBox(d) {
    var C = S.common, P = S.SoftwareApps, body, buttons;
    if (d.kind === 'apps') {
      var title = d.op === 'install' ? P.confirmInstall : d.op === 'remove' ? P.confirmRemoval : fmt(P.confirmOperation, d.op);
      var text = d.op === 'install' ? P.willInstall : d.op === 'remove' ? P.willRemove : fmt(P.willProcess, d.op.toLowerCase());
      body = '<h4 class="wd-dialog-title">' + esc(title) + '</h4><p class="wd-dialog-text">' + esc(text) + '</p>' +
        '<ul class="wd-dialog-list">' + d.names.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' +
        (d.save ? checkbox('data-dialog-check="save"', true, P.saveScripts) : '');
      buttons = '<button type="button" class="wd-btn wd-btn-accent" data-dialog="ok">' + esc(P.continue) + '</button><button type="button" class="wd-btn" data-dialog="cancel">' + esc(C.cancel) + '</button>';
    } else if (d.kind === 'confirm') {
      var message = d.action === 'accept' ? S.Builder.acceptConfirm : d.action === 'reject' ? S.Builder.rejectConfirm : C.confirmMessage;
      body = '<h4 class="wd-dialog-title">' + esc(C.confirmTitle) + '</h4><p class="wd-dialog-text">' + esc(fmt(message, d.count)) + '</p>';
      buttons = '<button type="button" class="wd-btn wd-btn-accent" data-dialog="ok">' + esc(C.ok) + '</button><button type="button" class="wd-btn" data-dialog="cancel">' + esc(C.cancel) + '</button>';
    } else {
      body = '<h4 class="wd-dialog-title">' + esc(C.filterDialogTitle) + '</h4><p class="wd-dialog-text">' + esc(C.filterDialogMessage) + '</p>' +
        checkbox('data-dialog-check="1"', false, C.filterDialogCheckbox);
      buttons = '<button type="button" class="wd-btn wd-btn-accent" data-dialog="ok">' + esc(C.filterDialogToggle) + '</button><button type="button" class="wd-btn" data-dialog="cancel">' + esc(C.cancel) + '</button>';
    }
    return '<div class="wd-dialog" role="dialog" aria-modal="true"><div class="wd-dialog-body">' + body + '</div><div class="wd-dialog-buttons">' + buttons + '</div></div>';
  }

  function dialogHtml() {
    return state.dialog ? '<div class="wd-smoke">' + dialogBox(state.dialog) + '</div>' : '';
  }

  // ---- Render ----

  function pageHtml() {
    if (state.page === 'Optimize' || state.page === 'Customize') return settingsPage(state.page);
    if (state.page === 'Autounattend') return unattendPage();
    if (state.page === 'SoftwareApps') return appsPage();
    if (state.page === 'WimUtil') return wimPage();
    if (state.page === 'Settings') return settingsAppPage();
    return '';
  }

  var win, pageEl;

  function windowClasses() {
    return 'wd-window' + (state.paneOpen ? '' : ' is-compact') + (state.short ? ' is-short' : '') + (state.mode !== 'Normal' ? ' has-modebar' : '');
  }

  function renderAll() {
    host.innerHTML = '<div class="' + windowClasses() + '" data-page="' + state.page + '">' + titleBar() + modeBar() +
      '<div class="wd-body">' + nav() + '<main class="wd-page">' + pageHtml() + '</main></div>' + dialogHtml() + '</div>';
    win = host.firstChild;
    pageEl = win.querySelector('.wd-page');
    afterRender(win);
  }

  function hostVars(el) {
    var atlas = app.shell.iconAtlas;
    el.style.setProperty('--wd-dim', M.dimOpacity);
    el.style.setProperty('--wd-column', M.contentMaxWidth + 'px');
    el.style.setProperty('--wd-card-gap', M.cardSpacing + 'px');
    el.style.setProperty('--wd-tb-icon', M.titleBarIconSize + 'px');
    // Absolute: a url() in a custom property resolves against the stylesheet that reads it, one folder down.
    el.style.setProperty('--wd-atlas', 'url("' + asset(atlas.src) + '")');
    el.style.setProperty('--wd-atlas-size', (atlas.columns * 100) + '% ' + (atlas.rows * 100) + '%');
  }

  function scroller() { return pageEl.querySelector('.wd-scroll'); }

  // A review decision moves the counts in the mode bar, the sidebar and the breadcrumb: redraw the window,
  // keeping the list where it was.
  function renderReview() {
    var sc = scroller(), top = sc ? sc.scrollTop : 0;
    renderAll();
    var next = scroller();
    if (next) next.scrollTop = top;
  }

  function renderPage(keepScroll) {
    var sc = scroller();
    var top = keepScroll && sc ? sc.scrollTop : 0;
    var focusSearch = document.activeElement && document.activeElement.getAttribute('data-act') === 'search';
    pageEl.innerHTML = pageHtml();
    var next = scroller();
    if (next) next.scrollTop = top;
    if (focusSearch) {
      var input = pageEl.querySelector('[data-act="search"]');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
    var smoke = win.querySelector('.wd-smoke');
    if (smoke) smoke.remove();
    if (state.dialog) win.insertAdjacentHTML('beforeend', dialogHtml());
    afterRender(pageEl);
    if (state.dialog) fitGlyphs(win);
  }

  function afterRender(scope) {
    fitGlyphs(scope);
    scope.querySelectorAll('[data-tech-body]').forEach(loadTech);
    layout();
  }

  // Window-relative layout, as the app sizes against its own window rather than the screen.
  function layout() {
    if (win) fitTitleBar(win);
    if (!pageEl) return;
    fitActionBar(pageEl);
    fitCardGrid(pageEl);
  }

  // MainWindow.FitTitleBar: when the bar doesn't fit, the mode labels go first (each mode keeps its icon and
  // tooltip), then the app title, then the Support text.
  function fitTitleBar(scope) {
    var bar = scope.querySelector('.wd-titlebar'), modes = bar && bar.querySelector('.wd-modes');
    if (!modes) return;
    // The mode switch is centred in the leftover space, so it overflows both ways: add up its children.
    var tooWide = function () {
      var w = 0, kids = modes.children;
      for (var i = 0; i < kids.length; i++) if (kids[i].offsetWidth) w += kids[i].offsetWidth + (i ? 8 : 0);
      return w + 2 * 16 > modes.clientWidth || bar.scrollWidth > bar.clientWidth; // 16px clear each side
    };
    var steps = ['is-tight', 'is-tighter', 'is-tightest'];
    bar.classList.remove.apply(bar.classList, steps);
    for (var i = 0; i < steps.length && tooWide(); i++) bar.classList.add(steps[i]);
  }

  // SoftwareAppsPage.FitActionBar: labels drop to icons when the row doesn't fit, Refresh/Help/Sort first.
  function fitActionBar(scope) {
    var bar = scope.querySelector('.wd-actionbar');
    if (!bar) return;
    // A right-aligned row overflows to the left, which scrollWidth doesn't count: add up the children.
    var tooWide = function () {
      var w = 0, kids = bar.children;
      for (var i = 0; i < kids.length; i++) w += kids[i].offsetWidth;
      return w + 8 * (kids.length - 1) > bar.clientWidth;
    };
    bar.classList.remove('is-tight', 'is-tighter');
    if (tooWide()) bar.classList.add('is-tight');
    if (tooWide()) bar.classList.add('is-tighter');
  }

  // UniformWrapPanel + the card stack's MaxWidth: columns of CardItemWidth (420) while they fit, two
  // shrunk to CardMinItemWidth (320) before dropping to one full-width column; the stack takes the
  // grid's exact width so headers and checkboxes line up with the cards.
  function fitCardGrid(scope) {
    var sc = scope.querySelector('.wd-apps-scroll');
    if (!sc) return;
    var avail = sc.clientWidth - 4;
    var stack = sc.querySelector('.wd-apps-stack');
    if (!stack) return;
    if (state.appsView === 'card') {
      var item = 420, min = 320, gap = 16;
      var cols = Math.max(1, Math.floor((avail + gap) / (item + gap)));
      var width;
      if (cols >= 2) width = cols * item + (cols - 1) * gap;
      else if (avail >= 2 * min + gap) { cols = 2; width = avail; }
      else width = avail;
      stack.style.maxWidth = width + 'px';
      stack.style.setProperty('--wd-cols', cols);
    } else if (state.appsView === 'compact') {
      var cw = 320, cg = 8;
      var ccols = Math.max(1, Math.floor((avail + cg) / (cw + cg)));
      stack.style.maxWidth = (ccols * cw + (ccols - 1) * cg) + 'px';
      stack.style.setProperty('--wd-cols', ccols);
    }
  }

  function measure() {
    var w = host.clientWidth, h = host.clientHeight;
    if (!w) return;
    var narrow = w < M.compactPaneBelowWidth;
    if (narrow !== state.narrow) {
      state.narrow = narrow;
      if (narrow && state.paneOpen) { state.paneOpen = false; state.paneForWidth = true; }
      else if (!narrow && state.paneForWidth) { state.paneOpen = true; state.paneForWidth = false; }
    }
    state.short = h < M.shortWindowHeight;
    if (win) {
      win.className = windowClasses();
      var pane = win.querySelector('[data-act="pane"]');
      if (pane) pane.setAttribute('aria-expanded', state.paneOpen);
    }
    host.classList.toggle('wd-w-600', w < 600);
    layout();
  }

  function refreshCard(s) {
    var el = pageEl.querySelector('[data-card="' + s.id + '"]');
    var top = el;
    while (top && top.parentElement && top.parentElement.closest('[data-card]')) top = top.parentElement.closest('[data-card]');
    if (!top) return;
    var root = settingById(top.getAttribute('data-card'));
    var f = featureOfSetting(root.id);
    var kids = state.query.trim() ? [] : f.settings.filter(function (k) { return k.parent === root.id; });
    var wrap = document.createElement('div');
    wrap.innerHTML = card(root, kids.length ? 'parent' : 'single', kids);
    var fresh = wrap.firstChild;
    top.replaceWith(fresh);
    fitGlyphs(fresh);
    fresh.querySelectorAll('[data-tech-body]').forEach(loadTech);
  }

  function setValue(s, index, source) {
    if (state.values[s.id] === index) return;
    var from = state.values[s.id];
    state.values[s.id] = index;
    refreshCard(s);
    emit({ type: 'change', setting: s, from: from, to: index, label: optionText(s, index), source: source });
  }

  function quickScope() {
    return state.feature ? [featureById(state.feature)] : areaFeatures(state.page);
  }

  // What a Quick Action would change on this page: the count the confirm dialog quotes.
  function quickChanges(kind) {
    var out = [];
    quickScope().forEach(function (f) {
      f.settings.forEach(function (s) {
        if (kind === 'accept' || kind === 'reject') {
          if (hasDiff(s) && decision(s) !== (kind === 'accept')) out.push([s, null]);
          return;
        }
        if (kind === 'include' || kind === 'exclude') {
          if (!!state.excluded[s.id] !== (kind === 'exclude')) out.push([s, null]);
          return;
        }
        if (!hasChoices(s)) return;
        var list = kind === 'recommended' ? s.recommended : s.windowsDefault;
        if (!list.length || list.indexOf(value(s)) >= 0) return;
        out.push([s, list[0]]);
      });
    });
    return out;
  }

  function quickAction(kind) {
    state.menu = null;
    var changes = quickChanges(kind);
    if (!changes.length) { renderPage(true); emit({ type: 'bulk', kind: kind, count: 0, scope: quickScope().map(function (f) { return f.name; }) }); return; }
    state.dialog = { kind: 'confirm', action: kind, count: changes.length };
    renderPage(true);
  }

  function applyQuick(kind) {
    var changes = quickChanges(kind);
    changes.forEach(function (c) {
      if (kind === 'accept' || kind === 'reject') state.review.decided[c[0].id] = kind === 'accept';
      else if (kind === 'include') delete state.excluded[c[0].id];
      else if (kind === 'exclude') state.excluded[c[0].id] = true;
      else state.values[c[0].id] = c[1];
    });
    emit({ type: 'bulk', kind: kind, count: changes.length, scope: quickScope().map(function (f) { return f.name; }) });
  }

  // Each feature's panels arrive as demo/tech/<id>.js calling WinhanceDemoTech, and their stylesheet (the
  // docs' own sheets, scoped for a shadow root) as demo/tech-css.js: scripts rather than fetches so the page
  // still works opened straight from disk. A panel draws only once both are in, so it never shows unstyled,
  // and every panel shares the one parsed sheet.
  var techWaiting = {}, techSheet = null, sheetWaiting = [];
  window.WinhanceDemoTech = function (featureId, data) {
    techCache[featureId] = data;
    (techWaiting[featureId] || []).forEach(function (fn) { fn(); });
    delete techWaiting[featureId];
  };
  window.WinhanceDemoTechCss = function (css) {
    if (window.CSSStyleSheet && 'adoptedStyleSheets' in Document.prototype) {
      techSheet = new CSSStyleSheet();
      techSheet.replaceSync(css);
    } else {
      techSheet = css;
    }
    sheetWaiting.forEach(function (fn) { fn(); });
    sheetWaiting = [];
  };

  function loadScript(src, onerror) {
    var tag = document.createElement('script');
    tag.src = src;
    tag.onerror = onerror;
    document.head.appendChild(tag);
  }

  function withSheet(fn) {
    if (techSheet) return fn();
    if (!sheetWaiting.length) loadScript(asset('demo/tech-css.js'), function () { sheetWaiting = []; });
    sheetWaiting.push(fn);
  }

  function loadTech(el) {
    var id = el.getAttribute('data-tech-body');
    var f = featureOfSetting(id);
    var show = function () {
      if (el.shadowRoot || !techCache[f.id] || !techSheet) return;
      var root = el.attachShadow({ mode: 'open' });
      var body = '<div class="wd-tech-body">' + (techCache[f.id][id] || '') + '</div>';
      if (typeof techSheet === 'string') root.innerHTML = '<style>' + techSheet + '</style>' + body;
      else { root.adoptedStyleSheets = [techSheet]; root.innerHTML = body; }
    };
    withSheet(show);
    if (techCache[f.id]) return show();
    if (techWaiting[f.id]) return techWaiting[f.id].push(show);
    techWaiting[f.id] = [show];
    loadScript(asset('demo/tech/' + f.id + '.js'), function () { delete techWaiting[f.id]; el.textContent = ''; });
  }

  // In review a pick moves the tab and sidebar counts, so the whole window redraws.
  function picked() {
    if (inReview()) renderReview(); else renderPage(true);
  }

  function nudgeBuilder() {
    var b = win.querySelector('[data-mode="Builder"]');
    if (b) { b.classList.remove('is-nudge'); void b.offsetWidth; b.classList.add('is-nudge'); }
  }

  function go(page) {
    if (page === 'More') { state.menu = state.menu === 'more' ? null : 'more'; renderAll(); return; }
    if (locked(page)) {
      emit({ type: 'locked', page: page });
      if (page === 'Autounattend') nudgeBuilder();
      return;
    }
    state.page = page;
    state.feature = null;
    state.query = '';
    state.menu = null;
    if (page === 'WimUtil' && !state.wim.visited) {
      state.wim.visited = true;
      if (state.mode === 'Normal') return startWimSession();
    }
    renderAll();
    emit({ type: 'page', page: page });
  }

  // StartAutounattendSession: Builder mode with the Autounattend target, the answer-file settings in the card.
  function startWimSession() {
    state.mode = 'Builder';
    state.target = 'Autounattend';
    state.menu = null;
    renderAll();
    emit({ type: 'wim', step: 'session' });
  }

  // Entering review loads the recommended config: its apps come in ticked, as an imported config's do.
  function setMode(mode) {
    if (mode === 'ConfigReview' && !state.review) {
      state.review = { decided: {}, only: false, action: {}, picked: state.picked };
      state.picked = {};
      app.review.apps.forEach(function (k) { state.picked[k] = true; });
    } else if (mode !== 'ConfigReview' && state.review) {
      state.picked = state.review.picked;
      state.review = null;
    }
    state.mode = mode;
    if (locked(state.page)) { state.page = 'Optimize'; state.feature = null; }
    state.menu = null;
    renderAll();
    emit({ type: 'mode', mode: mode, changes: inReview() ? diffsIn(reviewFeatures()).length : 0, apps: inReview() ? app.review.apps.length : 0 });
  }

  // Apply Config: the accepted changes become the window's values and the review closes.
  function applyReview() {
    var diffs = diffsIn(reviewFeatures());
    var accepted = diffs.filter(function (s) { return decision(s) === true; });
    var apps = {};
    ['windows', 'external'].forEach(function (t) { if (pickedIn(t)) apps[state.review.action[t]] = (apps[state.review.action[t]] || 0) + pickedIn(t); });
    accepted.forEach(function (s) { state.values[s.id] = configValue(s); });
    state.review = null;
    state.picked = {};
    state.mode = 'Normal';
    renderAll();
    emit({ type: 'reviewApplied', applied: accepted.length, skipped: diffs.length - accepted.length, install: apps.install || 0, remove: apps.remove || 0 });
  }

  function closeMenu() {
    if (!state.menu) return false;
    var wasMore = state.menu === 'more';
    state.menu = null;
    if (wasMore) renderAll(); else renderPage(true);
    return true;
  }

  host.addEventListener('click', function (e) {
    var link = e.target.closest('[data-stop]');
    if (link) { e.stopPropagation(); return; }
    // A More menu link opens its page in a new tab; close the menu after the browser has followed it.
    if (e.target.closest('[data-more-link]')) { setTimeout(function () { state.menu = null; renderAll(); }, 0); return; }
    var dlg = e.target.closest('[data-dialog]');
    if (dlg) {
      var d = state.dialog;
      state.dialog = null;
      if (d.kind === 'apps') {
        var save = win.querySelector('[data-dialog-check="save"]');
        if (dlg.dataset.dialog === 'ok') emit({ type: 'apps', action: d.op, names: d.names, save: save ? save.checked : null });
        renderPage(true);
        return;
      }
      if (dlg.dataset.dialog === 'ok') {
        if (d.kind === 'confirm') applyQuick(d.action);
        if (d.action === 'accept' || d.action === 'reject') { renderReview(); return; }
        else { state.filterOn = !state.filterOn; emit({ type: 'filter', on: state.filterOn }); }
      }
      if (d.kind === 'filter') { state.filterAsked = true; renderAll(); } else renderPage(true);
      return;
    }
    if (state.dialog) return;
    var t = e.target.closest('button, [data-pick], [data-row]');
    if (!t || !host.contains(t)) { closeMenu(); return; }
    var dd = t.dataset;
    if (t.closest('.wd-help') && !dd.act) return;
    if (dd.nav) return go(dd.nav);
    if (dd.mode) return setMode(dd.mode);
    if (dd.act === 'mode-cancel') return setMode('Normal');
    if (dd.act === 'pane') { state.paneOpen = !state.paneOpen; state.paneForWidth = false; renderAll(); return; }
    if (dd.tb === 'WindowsFilterButton') {
      if (!state.filterAsked) { state.dialog = { kind: 'filter' }; renderAll(); return; }
      state.filterOn = !state.filterOn;
      renderAll();
      emit({ type: 'filter', on: state.filterOn });
      return;
    }
    if (dd.feature) { state.feature = dd.feature; state.query = ''; state.menu = null; renderPage(); return; }
    if (dd.act === 'up') { state.feature = null; state.query = ''; state.menu = null; renderPage(); return; }
    if (dd.menu) { state.menu = state.menu === dd.menu ? null : dd.menu; renderPage(true); return; }
    if (dd.act === 'help') { state.menu = state.menu === 'help' ? null : 'help'; renderPage(true); return; }
    if (dd.quick) return quickAction(dd.quick);
    if (dd.act === 'tech') { state.techOn = !state.techOn; state.menu = null; renderPage(true); return; }
    if (dd.act === 'badges') { state.badgesOn = !state.badgesOn; state.menu = null; renderPage(true); return; }
    if (dd.act === 'new') { state.newOn = !state.newOn; state.menu = null; renderPage(true); return; }
    if (dd.act === 'only') { state.review.only = !state.review.only; state.menu = null; renderPage(true); return; }
    if (dd.act === 'review-apply') return applyReview();
    if (dd.reviewAction) {
      var acts = state.review.action;
      acts[state.appsTab] = acts[state.appsTab] === dd.reviewAction ? null : dd.reviewAction;
      renderReview();
      return;
    }
    if (dd.tech) { state.techOpen[dd.tech] = !state.techOpen[dd.tech]; refreshCard(settingById(dd.tech)); return; }
    if (dd.set) return setValue(settingById(dd.set), Number(dd.to), 'quickset');
    if (dd.tab) { state.appsTab = dd.tab; state.menu = null; state.tableSort = null; renderPage(); return; }
    if (dd.view) { state.appsView = dd.view; state.menu = null; renderPage(); return; }
    if (dd.sort) { state.appsSort = dd.sort; state.menu = null; renderPage(true); return; }
    if (dd.col) {
      var ts = state.tableSort;
      state.tableSort = { col: dd.col, dir: ts && ts.col === dd.col && ts.dir === 'asc' ? 'desc' : 'asc' };
      renderPage(true);
      return;
    }
    if (dd.group) { state.groupsClosed[dd.group] = !state.groupsClosed[dd.group]; renderPage(true); return; }
    if (dd.pick && t.classList.contains('wd-app-card')) {
      state.picked[dd.pick] = !state.picked[dd.pick];
      picked();
      return;
    }
    if (dd.row && !e.target.closest('input, label')) {
      state.picked[dd.row] = !state.picked[dd.row];
      picked();
      return;
    }
    if (dd.step) { state.wim.open[dd.step] = !state.wim.open[dd.step]; renderPage(true); return; }
    if (dd.wim === 'session') return startWimSession();
    if (dd.wim === 'generate') { state.wim.generated = true; renderPage(true); emit({ type: 'wim', step: 'generated' }); return; }
    if (dd.wim) { emit({ type: 'wim', step: dd.wim }); return; }
    if (dd.act === 'install' || dd.act === 'uninstall') {
      // InstallSelectedItemsAsync / RemoveSelectedItemsAsync do nothing unless the mode applies to this PC.
      if (state.mode === 'Builder') return;
      state.dialog = appsDialog(dd.act === 'install' ? 'install' : state.appsTab === 'windows' ? 'remove' : 'uninstall');
      renderPage(true);
      return;
    }
    if (dd.act === 'refresh') { emit({ type: 'refresh' }); return; }
    if (dd.act === 'save') { emit({ type: 'save', mode: state.mode, target: state.target }); return; }
    if (dd.action) { emit({ type: 'action', setting: settingById(dd.action) }); return; }
    if (dd.act === 'more-item') { state.menu = null; renderAll(); return; }
    if (dd.expand !== undefined) return;
    closeMenu();
  });

  // A parent card's own surface expands it (SettingsCard IsClickEnabled); its control and chevron sit on top.
  host.addEventListener('click', function (e) {
    var head = e.target.closest('[data-expand]');
    if (!head || e.target.closest('input, select, label, button:not(.wd-expand-chev)')) return;
    var id = head.getAttribute('data-expand');
    state.collapsed[id] = !state.collapsed[id];
    refreshCard(settingById(id));
  });

  host.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (state.dialog) { state.dialog = null; renderPage(true); return; }
      closeMenu();
      return;
    }
    var cardEl = e.target.closest && e.target.closest('.wd-app-card');
    if (cardEl && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      state.picked[cardEl.dataset.pick] = !state.picked[cardEl.dataset.pick];
      picked();
      var again = pageEl.querySelector('[data-pick="' + cardEl.dataset.pick.replace(/"/g, '\\"') + '"]');
      if (again) again.focus();
    }
  });

  host.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.toggle) return setValue(settingById(t.dataset.toggle), t.checked ? 0 : 1, 'control');
    if (t.dataset.select) return setValue(settingById(t.dataset.select), Number(t.value), 'control');
    if (t.dataset.target) {
      state.target = t.dataset.target;
      if (locked(state.page)) { state.page = 'Optimize'; state.feature = null; }
      renderAll();
      emit({ type: 'target', target: state.target });
      return;
    }
    if (t.dataset.dest) { state.wim.dest = t.dataset.dest; renderPage(true); return; }
    if (t.dataset.act === 'theme') {
      var next = t.value === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t.value;
      emit({ type: 'theme', theme: next });
      return;
    }
    if (t.dataset.act === 'language') { emit({ type: 'language', name: t.options[t.selectedIndex].text }); return; }
    if (t.dataset.pickall) {
      tabItems().filter(function (i) { return pickFilters[t.dataset.pickall](i.app); }).forEach(function (i) { state.picked[i.key] = t.checked; });
      return picked();
    }
    if (t.dataset.pick) { state.picked[t.dataset.pick] = t.checked; picked(); }
    if (t.dataset.decide) {
      var s = settingById(t.dataset.decide);
      state.review.decided[s.id] = t.value === '1';
      renderReview();
      emit({ type: 'decide', setting: s, apply: state.review.decided[s.id], from: diffText(s, value(s)), to: diffText(s, configValue(s)) });
    }
  });

  host.addEventListener('input', function (e) {
    if (e.target.dataset.act !== 'search') return;
    state.query = e.target.value;
    renderPage();
  });

  // The landing page drives the window from outside ("show me the taskbar settings").
  window.WinhanceDemo = {
    on: function (fn) { listeners.push(fn); },
    open: function (page, feature) {
      if (!app) return;
      if (page === 'Autounattend') { state.mode = 'Builder'; state.target = 'Autounattend'; }
      state.page = page; state.feature = feature || null; state.query = ''; state.menu = null; state.dialog = null;
      renderAll();
      emit({ type: 'page', page: page });
    },
    write: function (s, index) {
      return s.writes.map(function (g) {
        return { label: g.label, kind: g.kind, path: g.path, values: g.columns.map(function (c) { return { name: c.name, type: c.type, value: c.cells[index] }; }) };
      });
    },
    // A still of one page at the app's default window size, for the page's scroll story: the same
    // renderer and state, in the mode that page is used in (Unattend lives in Builder).
    mount: function (el, page) {
      var saved = { page: state.page, feature: state.feature, query: state.query, menu: state.menu, dialog: state.dialog,
        mode: state.mode, target: state.target, review: state.review, paneOpen: state.paneOpen, short: state.short };
      state.page = page; state.feature = null; state.query = ''; state.menu = null; state.dialog = null; state.review = null;
      state.mode = page === 'Autounattend' ? 'Builder' : 'Normal'; state.target = 'Autounattend';
      state.paneOpen = true; state.short = false;
      hostVars(el);
      el.innerHTML = '<div class="' + windowClasses() + '" data-page="' + page + '">' + titleBar() + modeBar() +
        '<div class="wd-body">' + nav() + '<main class="wd-page">' + pageHtml() + '</main></div></div>';
      Object.keys(saved).forEach(function (k) { state[k] = saved[k]; });
      fitGlyphs(el);
      fitActionBar(el);
      fitCardGrid(el);
    },
    // The page's before/after scenes draw app and setting icons the way the window does.
    glyph: function (key, cls) { return glyph(key, cls); },
    appIcon: function (a, cls) { return appIconHtml(a, cls); },
    paint: function (el) { hostVars(el); },
    get data() { return app; },
    asset: asset,
  };

  app = window.WinhanceDemoData;
  S = app.strings;
  glyphs = app.glyphs;
  M = app.shell.metrics;
  var atlas = app.shell.iconAtlas;
  hostVars(host);
  // Fetch and decode the app icons up front, so the first visit to Software & Apps draws them at once.
  var preload = new Image();
  preload.src = asset(atlas.src);
  allSettings().forEach(function (s) { state.values[s.id] = startingValue(s); });
  measure();
  renderAll();
  if (window.ResizeObserver) new ResizeObserver(measure).observe(host);
  else window.addEventListener('resize', measure);
  host.classList.add('is-ready');

  // A docs page can show one of these dialogs as a still, outside the window: <div data-wd-dialog="remove">
  // (or install / uninstall, with data-tab), listing the first apps the recommended config ticks on that tab.
  document.querySelectorAll('[data-wd-dialog]').forEach(function (el) {
    var tab = el.getAttribute('data-tab') || (el.getAttribute('data-wd-dialog') === 'uninstall' ? 'external' : 'windows');
    var names = app.review.apps.filter(function (k) { return appKinds[tab].indexOf(kindOf(k)) >= 0; }).slice(0, 4)
      .map(function (k) { return k.slice(k.indexOf(':') + 1); });
    el.classList.add('wd-host', 'wd-dialog-still');
    hostVars(el);
    el.innerHTML = dialogBox(appsDialog(el.getAttribute('data-wd-dialog'), names));
    var box = el.querySelector('.wd-dialog');
    box.removeAttribute('role');
    box.removeAttribute('aria-modal');
  });
})();
