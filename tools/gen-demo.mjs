#!/usr/bin/env node
// Builds the landing page's live app demo from the Winhance source and its catalog export.
//   node tools/gen-demo.mjs [--app ../winhance] [--site .] [--icons ../package-icons] [--check]
// --check builds in memory and exits 1 listing files that differ from what is on disk.
//
// Outputs:
//   demo/app.js           the demo's whole world: shell (title bar, nav, page strings), features, settings, apps
//   demo/tech/<id>.js     each feature's Technical Details panels, loaded on first expand
//   demo/tech-css.js      the docs' setting-card sheet, scoped for the panels' shadow roots, as a script
//   demo/assets/*.png     the app's own mode and title-bar images, copied byte for byte
//   index.html            elements carrying data-gen="<key>" get their text replaced with the value below,
//                         and the icon sprite between the gen:icons markers is rebuilt from what the page uses
// Data ships as scripts, not JSON, and the sprite sits inline, because a page opened straight from disk
// (file://) may not fetch() or <use> another file; both work on GitHub Pages either way.
//
// What is read from the app, so a release can't ship a demo that disagrees with it:
//   nav order, labels and icons   NavSidebar.xaml -> MainWindowViewModel.cs keys -> en.json
//   title bar                     MainWindow.xaml (height, mode buttons, action buttons and their icons)
//   feature order, area, icon     FeatureDefinitions.cs + FeatureIcons.xaml
//   settings, options, roles      extras/docs-export/catalog.json (the same export the docs use)
//   badge colours                 extras/docs-export/theme.json, via docs/css/app-tokens.css
//   apps                          the SoftwareApps catalogs' ItemDefinition blocks
//   app icons                     memstechtips/package-icons at the path RepoIconKey.cs builds, bundled
//                                 small by tools/app-icons.py; --check compares that bundle to the repo
//   nav, header and toolbar icons the IconVariant NavButton.xaml and PageHeader.xaml draw with, and each
//                                 page's own header icon
//   which Windows apps are installed  tools/app-defaults/windows-11-pro.json (a fresh install, read
//                                 from the Windows image by tools/image-apps.py), matched with each
//                                 item's own AppxPackageName / CapabilityName, as the app matches them
// What is chosen here, and so is hand-mirrored: WHICH strings each page shows (the key lists in
// pageStrings below) and the layout metrics in demo/winhance-demo.css. Diff those against the XAML by eye
// when the app's pages change shape; nothing can catch that drift automatically.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { matrixBody, optionWarnings } from './lib/render-card.mjs';
import { loadPages } from './lib/render-page.mjs';
import { esc } from './lib/html.mjs';
import {
  APP_PATHS, readAppFile, stringTable, str, parseFeatureIds, parseFeatureDefinitions,
  parseFeatureIcons, parseViewModelStringKeys, parseNavSidebar, parseTitleBar, parseAppItems, parseMetrics, parseMoreMenu,
  parseIconVariant, parsePageIcon, repoIconKey, repoIconKeyGuard, parseItemTypes, parseRemovalItems, parseHelpLink, parseBreakpoints, launchedUrl, parseSupportUrl, parseConfig,
} from './lib/app-source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_APP = resolve(here, '..', '..', 'winhance');
const DEFAULT_SITE = resolve(here, '..');
const DEFAULT_ICONS = resolve(here, '..', '..', 'package-icons');

const PAGE_KEYS = {
  common: {
    search: 'Common_Search_Placeholder', quickActions: 'QuickActions_Menu', applyRecommended: 'QuickActions_ApplyRecommended',
    resetDefaults: 'QuickActions_ResetDefaults', includeAll: 'QuickActions_IncludeAll', excludeAll: 'QuickActions_ExcludeAll',
    confirmTitle: 'QuickActions_ConfirmTitle', confirmMessage: 'QuickActions_ConfirmMessage', ok: 'Button_OK', cancel: 'Button_Cancel',
    view: 'View_Menu', technicalDetails: 'View_TechnicalDetails', technicalDetailsTip: 'View_TechnicalDetails_Tooltip',
    infoBadges: 'View_InfoBadges', infoBadgesTip: 'View_InfoBadges_Tooltip', newBadges: 'View_NewBadges', newBadgesTip: 'View_NewBadges_Tooltip',
    newBadge: 'Badge_New',
    recommended: 'InfoBadge_Recommended', default: 'InfoBadge_Default', setToRecommended: 'InfoBadge_Numeric_SetToRecommended_Tooltip',
    setToDefault: 'InfoBadge_Numeric_SetToDefault_Tooltip', preference: 'InfoBadge_Preference',
    recommendedTip: 'InfoBadge_Recommended_Tooltip', defaultTip: 'InfoBadge_Default_Tooltip', preferenceTip: 'InfoBadge_Preference_Tooltip',
    on: 'Common_On', off: 'Common_Off',
    filterOn: 'Tooltip_FilterEnabled', filterOnText: 'Tooltip_FilterEnabled_Description',
    filterOff: 'Tooltip_FilterDisabled', filterOffText: 'Tooltip_FilterDisabled_Description',
    filterDialogTitle: 'Filter_Dialog_Title', filterDialogMessage: 'Filter_Dialog_Message', filterDialogCheckbox: 'Filter_Dialog_Checkbox',
    filterDialogToggle: 'Filter_Dialog_Button_Toggle',
  },
  Builder: {
    title: 'Builder_Mode_Title', saveConfig: 'Builder_Mode_Save_Config', saveAutounattend: 'Builder_Mode_Save_Autounattend',
    description: 'Builder_Mode_Description', targetConfig: 'Builder_Mode_Target_Config', targetAutounattend: 'Builder_Mode_Target_Autounattend',
    locked: 'Nav_Autounattend_Locked_Tooltip', reviewTitle: 'Review_Mode_Title', reviewApply: 'Review_Mode_Apply_Button',
    reviewDescription: 'Review_Mode_Description', reviewStatus: 'Review_Mode_Status_Format', reviewAllMatch: 'Review_Mode_Status_AllMatch',
    wimLocked: 'Nav_AdvancedTools_Locked_Tooltip', diff: 'Review_Mode_Diff_Toggle', apply: 'Button_Apply', dontApply: 'Review_Mode_DontApply',
    acceptAll: 'QuickActions_AcceptAll', rejectAll: 'QuickActions_RejectAll', acceptConfirm: 'QuickActions_AcceptConfirmMessage',
    rejectConfirm: 'QuickActions_RejectConfirmMessage', onlyChanges: 'View_ShowOnlyChanges', onlyChangesTip: 'View_ShowOnlyChanges_Tooltip',
    checked: 'Common_Checked', unchecked: 'Common_Unchecked', selectAction: 'Review_Mode_Select_Action', actionInstall: 'Review_Mode_Action_Install', actionRemove: 'Review_Mode_Action_Remove',
  },
  SoftwareApps: {
    title: 'Category_SoftwareApps_Title', subtitle: 'Category_SoftwareApps_StatusText',
    tabWindows: 'SoftwareApps_Tab_WindowsApps', tabExternal: 'SoftwareApps_Tab_ExternalApps',
    install: 'SoftwareApps_Button_InstallSelected', uninstall: 'SoftwareApps_Button_UninstallSelected',
    refresh: 'Button_Refresh', help: 'Button_Help',
    viewCard: 'ViewMode_Card', viewTable: 'ViewMode_Table', viewCompact: 'ViewMode_Compact',
    sort: 'SoftwareApps_Sort_Button', sortInstalledFirst: 'SoftwareApps_Sort_NameAZInstalledFirst', sortAZ: 'SoftwareApps_Sort_NameAZ',
    sortZA: 'SoftwareApps_Sort_NameZA', sortTableHint: 'SoftwareApps_Sort_TableHint',
    colName: 'SoftwareApps_Column_Name', colDescription: 'SoftwareApps_Column_Description', colType: 'SoftwareApps_Column_Type',
    colStatus: 'SoftwareApps_Column_Status', colInstallable: 'SoftwareApps_Column_Installable', colGroup: 'SoftwareApps_Column_Group',
    selectAll: 'Common_SelectAll',
    selectAllInstalled: 'Common_SelectAll_Installed', selectAllNotInstalled: 'Common_SelectAll_NotInstalled',
    sectionApps: 'WindowsApps_Section_Apps', sectionCapabilities: 'WindowsApps_Section_Capabilities',
    sectionFeatures: 'WindowsApps_Section_OptionalFeatures',
    installed: 'Status_Installed', notInstalled: 'Status_NotInstalled', installable: 'Status_CanReinstall', permanent: 'Status_CannotReinstall',
    installedTip: 'Card_Pill_Installed_Tooltip', notInstalledTip: 'Card_Pill_NotInstalled_Tooltip',
    installableTip: 'Card_Pill_Reinstallable_Tooltip', permanentTip: 'Card_Pill_NonReinstallable_Tooltip',
    warning: 'Card_Pill_Warning', warningTip: 'Card_Pill_InstabilityWarning_Tooltip',
    helpWindows: 'Help_WindowsApps_Content', helpWindowsMore: 'Help_LearnMore_WindowsApps',
    helpExternal: 'Help_ExternalApps_Content', helpExternalMore: 'Help_LearnMore_ExternalApps', helpStatus: 'Help_WinhanceStatus',
    builderConfig: 'SoftwareApps_Builder_Banner_Config', builderWindows: 'SoftwareApps_Builder_Banner_Autounattend_WindowsApps',
    builderExternal: 'SoftwareApps_Builder_Banner_Autounattend_ExternalApps',
    confirmInstall: 'Dialog_ConfirmInstallation', confirmRemoval: 'Dialog_ConfirmRemoval', confirmOperation: 'Dialog_ConfirmOperation',
    willInstall: 'Dialog_ItemsWillBeInstalled', willRemove: 'Dialog_ItemsWillBeRemoved', willProcess: 'Dialog_ItemsWillBeProcessed',
    saveScripts: 'Dialog_SaveRemovalScripts', continue: 'Button_Continue',
  },
  Optimize: { title: 'Category_Optimize_Title', subtitle: 'Category_Optimize_StatusText' },
  Customize: { title: 'Category_Customize_Title', subtitle: 'Category_Customize_StatusText' },
  Autounattend: { title: 'Autounattend_Page_Title' },
  WimUtil: {
    title: 'WIMUtil_Title', subtitle: 'WIMUtil_Subtitle',
    step1: 'WIMUtil_Step1_Title', step2: 'WIMUtil_Step2_Title', step3: 'WIMUtil_Step3_Title', step4: 'WIMUtil_Step4_Title',
    isoExtracted: 'WIMUtil_Status_IsoExtracted', noXml: 'WIMUtil_Status_NoXmlAdded',
    noDrivers: 'WIMUtil_Status_NoDriversAdded', readyToCreate: 'WIMUtil_Status_ReadyToCreateIso',
    selectIso: 'WIMUtil_Card_SelectISO_Title', selectIsoButton: 'WIMUtil_Card_SelectISO_Button', isoDone: 'WIMUtil_Status_IsoExtractionSuccess',
    workDir: 'WIMUtil_Card_SelectDirectory_Title', using: 'WIMUtil_Label_Using',
    extractedAlready: 'WIMUtil_CheckboxExtractedAlready', selectFolder: 'WIMUtil_ButtonSelectFolder', downloadIso: 'WIMUtil_DownloadISO',
    optionalConvert: 'WIMUtil_OptionalConvert', convertTitle: 'WIMUtil_Card_ConvertImage_Title_Dynamic',
    convertButton: 'WIMUtil_Card_ConvertImage_Button_Dynamic', current: 'WIMUtil_Label_Current',
    afterConversion: 'WIMUtil_Label_AfterConversion', save: 'WIMUtil_Label_Save',
    win10: 'WIMUtil_ButtonWindows10', win11: 'WIMUtil_ButtonWindows11',
    win10Tip: 'WIMUtil_Tooltip_DownloadWindows10', win11Tip: 'WIMUtil_Tooltip_DownloadWindows11',
    pickOne: 'WIMUtil_SelectOneOption',
    generate: 'WIMUtil_Card_GenerateWinhanceXML_Title', generateText: 'WIMUtil_Card_GenerateWinhanceXML_Snapshot_Description',
    generateSession: 'WIMUtil_Card_GenerateWinhanceXML_Session_Description', generateButton: 'WIMUtil_Card_GenerateWinhanceXML_Start',
    generateNow: 'WIMUtil_ButtonGenerate', xmlAdded: 'WIMUtil_Status_XmlGenSuccess',
    download: 'WIMUtil_Card_DownloadXML_Title', downloadText: 'WIMUtil_Card_DownloadXML_Description', downloadButton: 'WIMUtil_Card_DownloadXML_Button',
    selectXml: 'WIMUtil_Card_SelectXML_Title', selectXmlText: 'WIMUtil_Card_SelectXML_Description', selectXmlButton: 'WIMUtil_Card_SelectXML_Button',
    generateFiles: 'WIMUtil_GenerateXMLFiles', schneegans: 'WIMUtil_ButtonSchneegans', schneegansTip: 'WIMUtil_Tooltip_Schneegans',
    extractDrivers: 'WIMUtil_Card_ExtractDrivers_Title', extractDriversText: 'WIMUtil_Card_ExtractDrivers_Description', extractDriversButton: 'WIMUtil_Card_ExtractDrivers_Button',
    customDrivers: 'WIMUtil_Card_CustomDrivers_Title', customDriversText: 'WIMUtil_Card_CustomDrivers_Description', customDriversButton: 'WIMUtil_Card_CustomDrivers_Button',
    destination: 'WIMUtil_Card_Destination_Title', destinationText: 'WIMUtil_Card_Destination_Description',
    destIso: 'WIMUtil_Destination_Iso', destUsb: 'WIMUtil_Destination_Usb',
    output: 'WIMUtil_Card_SelectOutput_Title', outputText: 'WIMUtil_Label_NoLocation', outputButton: 'WIMUtil_Card_SelectOutput_Button',
    usb: 'WIMUtil_Card_SelectUsb_Title', usbText: 'WIMUtil_Card_SelectUsb_Description', usbButton: 'WIMUtil_Card_SelectUsb_Button',
    noUsb: 'WIMUtil_Label_NoUsbFound', usbWarning: 'WIMUtil_Msg_UsbEraseWarning',
    createIso: 'WIMUtil_ButtonCreateISO', writeUsb: 'WIMUtil_ButtonWriteUsb',
  },
  // SettingsPage.xaml: three groups, four cards, in this order.
  Settings: {
    title: 'Settings_Title', subtitle: 'Settings_Description',
    general: 'Category_General', language: 'Settings_Menu_Language', languageText: 'Settings_Language_Description',
    theme: 'Settings_Theme_Title', themeText: 'Tooltip_ToggleTheme',
    themeSystem: 'Theme_System', themeLight: 'Theme_LightNative', themeDark: 'Theme_DarkNative',
    configuration: 'Category_Configuration', backup: 'Settings_BackupRestore_Title', backupText: 'Settings_BackupRestore_Snapshot_Description',
    import: 'Button_Import', export: 'Button_Export',
    protection: 'Category_SystemProtection', restorePoint: 'Settings_SystemProtection_Title', restorePointText: 'Settings_SystemProtection_Description',
    restorePointButton: 'Settings_CreateRestorePoint_Button',
  },
};

// Segoe Fluent Icons glyphs the app draws with FontIcon, and the Fluent System icon drawn for each here
// (the site can't ship the Segoe font). Hand-picked by meaning; keyed by code point so a new glyph in the
// XAML fails the build until it is mapped.
const SEGOE = {
  E945: 'Flash', E7B3: 'Eye', E946: 'Info', E735: 'StarFilled', E73E: 'Checkmark', E711: 'Dismiss', E8CB: 'ArrowSort',
};

// Sidebar pages the app draws from FeatureDefinitions (one card per feature) versus its own layouts.
const FEATURE_PAGES = ['Optimize', 'Customize'];

function strings(table, keys) {
  return Object.fromEntries(Object.entries(keys).map(([k, key]) => [k, str(table, key)]));
}

function loadIcons(siteDir) {
  const site = JSON.parse(readFileSync(join(siteDir, 'tools', 'icon-sources', 'site-icons.json'), 'utf8')).icons;
  const settings = JSON.parse(readFileSync(join(siteDir, 'docs', '_assets', 'icons.json'), 'utf8')).icons;
  return { site, settings };
}

// A glyph is either a Fluent name (vendored path data with its viewBox), a raw XAML geometry
// (drawn fitted to its own bounds, as PathIcon does), or an embedded app PNG.
function glyphFor(ref, { site, settings }, where) {
  if (/^Material\/\w+$/.test(ref)) {
    const entry = site[ref];
    if (!entry) throw new Error(`${where}: ${ref} is not vendored in tools/icon-sources/site-icons.json`);
    return { viewBox: entry.viewBox, path: entry.path };
  }
  if (/^[A-Z][A-Za-z0-9]*$/.test(ref)) {
    const entry = site[`Fluent/${ref}`] ?? settings[`Fluent/${ref}`];
    if (!entry) throw new Error(`${where}: Fluent icon "${ref}" is not vendored in tools/icon-sources/site-icons.json`);
    return entry.svg ? { viewBox: entry.viewBox, svg: entry.svg } : { viewBox: entry.viewBox ?? '0 0 20 20', path: entry.path };
  }
  return { path: ref, fit: true };
}

// BaseSettingsFeatureViewModel.GroupDescriptionText: the first four group names, then ", ..." if more.
// ConfigReviewService's reading of a config item: a power setting's AC index, a combo's key label or
// index, else a toggle's IsSelected (On is option 0). Left out (undefined): a setting whose options the app
// reads at run time, and a slider's raw value that no option names.
function configIndex(item, s) {
  let i;
  if (!s.options.length) return undefined;
  if (item.PowerSettings?.ACValue !== undefined) {
    i = s.options.findIndex((o) => parseFloat(o) === item.PowerSettings.ACValue);
    return i < 0 ? undefined : i;
  }
  if (item.PowerSettings) i = item.PowerSettings.ACIndex;
  else if (item.SelectedKeyLabel !== undefined) i = s.options.indexOf(item.SelectedKeyLabel);
  else if (item.SelectedIndex !== undefined) i = item.SelectedIndex;
  else if (typeof item.IsSelected === 'boolean') i = item.IsSelected ? 0 : 1;
  if (!Number.isInteger(i) || i < 0 || i >= s.options.length) throw new Error(`recommended config: ${item.Id} sets an option the catalog doesn't have`);
  return i;
}

function groupDescription(settings) {
  const groups = [...new Set(settings.map((s) => s.group).filter(Boolean))];
  return groups.slice(0, 4).join(', ') + (groups.length > 4 ? ', ...' : '');
}

function settingData(s, glyphs, icons) {
  const m = s.matrix;
  const iconKey = s.icon ? `${s.icon.pack}/${s.icon.name}` : null;
  if (iconKey && !glyphs[iconKey]) {
    const entry = icons.settings[iconKey];
    if (!entry) throw new Error(`setting ${s.id}: icon ${iconKey} is not in docs/_assets/icons.json (run tools/vendor-icons.mjs)`);
    glyphs[iconKey] = entry.image ? { image: entry.image } : { viewBox: entry.viewBox ?? '0 0 24 24', path: entry.path };
  }
  const indexes = (pred) => m.options.flatMap((o, i) => (pred(o) ? [i] : []));
  // What each option writes, for the page's own "what changed" readout: per matrix group, its first
  // path line and its columns, each column carrying one cell per option (the same strings the panel shows).
  const writes = m.groups.filter((g) => g.hasPaths).map((g) => ({
    kind: g.kind,
    label: g.label,
    path: g.paths[0].display,
    columns: m.columns.slice(g.startColumn, g.startColumn + g.columnSpan).map((c, i) => ({
      name: c.header,
      type: c.hasType ? c.typeName : '',
      cells: m.options.map((o) => {
        const cell = o.cells[g.startColumn + i];
        return !cell ? '' : cell.isCheck ? '\u2713' : cell.hasText ? cell.text : '';
      }),
    })),
  }));
  const out = {
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    group: s.group ?? '',
    icon: iconKey,
    control: s.control,
    options: m.options.map((o) => o.label),
    recommended: indexes((o) => o.isRecommended),
    windowsDefault: indexes((o) => o.isWindowsDefault),
    writes,
  };
  if (s.isSubjectivePreference) out.preference = true;
  // NewBadgeService: on a first run the baseline is 0.0.0, so every setting with an AddedInVersion is NEW.
  if (s.addedInVersion) out.isNew = true;
  if (s.uiParentId) out.parent = s.uiParentId;
  if (s.optionWarnings?.length) out.warnings = s.optionWarnings;
  return out;
}

export function generate({ appRoot, siteDir, iconsRepo }) {
  const read = (key) => readAppFile(appRoot, APP_PATHS[key]);
  const table = stringTable(read('strings'));
  const vmKeys = parseViewModelStringKeys(read('mainWindowViewModel'));
  const featureIcons = parseFeatureIcons(read('featureIcons'));
  const definitions = parseFeatureDefinitions(read('featureDefinitions'), parseFeatureIds(read('featureIds')));
  const nav = parseNavSidebar(read('navSidebar'), { icons: featureIcons, vmKeys, strings: table });
  const titleBar = parseTitleBar(read('mainWindow'), { vmKeys, strings: table, icons: featureIcons });
  const icons = loadIcons(siteDir);
  const metrics = parseMetrics({ dimConverter: read('dimConverter'), settingTemplates: read('settingTemplates'), iconSizes: read('iconSizes') });

  const catalogPath = join(appRoot, 'extras', 'docs-export', 'catalog.json');
  if (!existsSync(catalogPath)) throw new Error(`catalog export missing at ${catalogPath} -- run winhance-harness DocsCatalogExport`);
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  if (catalog.schemaVersion !== 1) throw new Error(`unsupported export schemaVersion ${catalog.schemaVersion}`);
  const catalogById = Object.fromEntries(catalog.features.map((f) => [f.id, f]));

  // Where each setting is documented; the Technical Details files and the page's readout link there.
  const theme = JSON.parse(readFileSync(join(appRoot, 'extras', 'docs-export', 'theme.json'), 'utf8'));
  const pages = loadPages(JSON.parse(readFileSync(join(siteDir, 'docs', '_pages.json'), 'utf8')));
  const docsPage = Object.fromEntries(pages.features.map((p) => [p.id, p.path]));
  const settingPage = new Map();
  for (const f of catalog.features) {
    if (!docsPage[f.id]) throw new Error(`docs/_pages.json maps no page for feature ${f.id}`);
    for (const s of f.settings) settingPage.set(s.id, docsPage[f.id]);
  }
  const urlFor = (id) => (settingPage.has(id) ? `docs/${settingPage.get(id)}#${id}` : null);

  const glyphs = {};
  const useGlyph = (ref, where) => {
    const key = /^Material\/\w+$/.test(ref) ? ref : /^[A-Z][A-Za-z0-9]*$/.test(ref) ? `Fluent/${ref}` : `Path/${Object.keys(glyphs).length}`;
    const existing = Object.entries(glyphs).find(([, g]) => g.path === ref);
    if (existing) return existing[0];
    if (!glyphs[key]) glyphs[key] = glyphFor(ref, icons, where);
    return key;
  };

  // NavButton draws every nav icon in one variant (Color); the vendored key carries it as a suffix.
  const navVariant = parseIconVariant(read('navButton'), APP_PATHS.navButton);
  for (const b of [...nav.top, ...nav.bottom]) b.icon = useGlyph(b.icon + navVariant, `nav ${b.tag}`);
  const navTags = new Set([...nav.top, ...nav.bottom].map((b) => b.tag));
  for (const page of [...FEATURE_PAGES, 'SoftwareApps', 'Autounattend', 'WimUtil', 'Settings']) {
    if (!navTags.has(page)) throw new Error(`NavSidebar.xaml has no ${page} button any more -- update gen-demo.mjs`);
  }
  // Links open in a new tab: docs on this site's own copy, bug reports on GitHub, Support at the store.
  const local = (url) => url.replace(/^https:\/\/winhance\.net\//, '');
  const support = parseSupportUrl(read('sponsorsDialog'));
  const mainVm = read('mainWindowViewModel'), moreVm = read('moreMenuViewModel');
  const links = {
    BugReportButton: launchedUrl(mainVm, 'BugReportAsync', APP_PATHS.mainWindowViewModel),
    DocsButton: local(launchedUrl(mainVm, 'DocsAsync', APP_PATHS.mainWindowViewModel)),
    DonateButton: support,
  };
  const moreLinks = {
    OpenDocs: local(launchedUrl(moreVm, 'OpenDocsAsync', APP_PATHS.moreMenuViewModel)),
    ReportBug: launchedUrl(moreVm, 'ReportBugAsync', APP_PATHS.moreMenuViewModel),
    SupportWinhance: support,
  };
  const buttons = titleBar.buttons.map((b) => ({ ...b, icon: useGlyph(b.icon ?? b.path, `title bar ${b.name}`), path: undefined, href: links[b.name] }));
  for (const name of Object.keys(links)) if (!buttons.some((b) => b.name === name)) throw new Error(`MainWindow.xaml has no ${name} any more -- update gen-demo.mjs`);
  // The filter button swaps its path by state (MainWindow.xaml.cs): FilterCheck while on, FilterOff while off.
  if (!featureIcons.FilterOffIconPath) throw new Error('FeatureIcons.xaml has no FilterOffIconPath');
  const filterOffIcon = useGlyph(featureIcons.FilterOffIconPath, 'title bar filter off');
  // NavButton's locked overlay: PrivacyIconPath, centred over the dimmed button.
  if (!featureIcons.PrivacyIconPath) throw new Error('FeatureIcons.xaml has no PrivacyIconPath');
  const lockIcon = useGlyph(featureIcons.PrivacyIconPath, 'nav lock');
  const navGlyph = useGlyph('Navigation', 'title bar pane toggle');
  const moreMenu = parseMoreMenu(read('navSidebar'), read('navSidebarCode'), read('moreMenuViewModel'), table)
    .map((m) => (m.separator ? m : { ...m, icon: useGlyph(m.icon, 'More menu'), href: moreLinks[m.tag], tag: undefined }));
  for (const tag of Object.keys(moreLinks)) if (!moreMenu.some((m) => m.href === moreLinks[tag])) throw new Error(`NavSidebar.xaml's More menu has no ${tag} item any more -- update gen-demo.mjs`);

  const features = definitions
    .filter((d) => FEATURE_PAGES.includes(d.category) || d.category === 'Autounattend')
    .map((d) => {
      const exported = catalogById[d.id];
      if (!exported) throw new Error(`catalog.json has no feature ${d.id} (FeatureDefinitions.cs lists it)`);
      const iconRef = featureIcons[d.iconKey];
      if (!iconRef) throw new Error(`FeatureIcons.xaml has no ${d.iconKey} (feature ${d.id})`);
      const nameKey = `Feature_${d.id}_Name`;
      return {
        id: d.id,
        area: d.category,
        name: table[nameKey] ?? d.name,
        icon: useGlyph(iconRef, `feature ${d.id}`),
        docs: `docs/${docsPage[d.id]}`,
        groups: groupDescription(exported.settings),
        settings: exported.settings.map((s) => settingData(s, glyphs, icons)),
      };
    });
  for (const f of catalog.features) if (!features.some((x) => x.id === f.id)) throw new Error(`catalog.json feature ${f.id} has no FeatureDefinitions entry`);

  const catalogsDir = join(appRoot, APP_PATHS.appCatalogs);
  if (!existsSync(catalogsDir)) throw new Error(`app source missing: ${APP_PATHS.appCatalogs}`);
  const appsFrom = (prefix) => readdirSync(catalogsDir).filter((f) => f.startsWith(prefix)).sort()
    .flatMap((f) => parseAppItems(readFileSync(join(catalogsDir, f), 'utf8')));
  const apps = {
    windows: appsFrom('WindowsAppDefinitions'),
    capabilities: appsFrom('CapabilityDefinitions'),
    optionalFeatures: appsFrom('OptionalFeatureDefinitions'),
    external: appsFrom('ExternalAppDefinitions.'),
  };
  for (const [k, list] of Object.entries(apps)) if (!list.length) throw new Error(`no ${k} apps read from ${APP_PATHS.appCatalogs}`);
  const fresh = freshInstall(siteDir);
  const bundled = bundledIcons(siteDir, iconsRepo);
  repoIconKeyGuard(read('repoIconKey'));
  const types = parseItemTypes(read('appItemViewModel'));
  // Without a repo icon the app falls back to a colour glyph by kind (AppIconResolver).
  const fallback = { windows: 'AppsColor', capabilities: 'PuzzlePieceColor', optionalFeatures: 'StarSettingsColor', external: 'AppsColor' };
  const appKeys = new Map();
  for (const [kind, list] of Object.entries(apps)) {
    for (const a of list) {
      // Optional features stay off: the image records no state for them (see tools/image-apps.py).
      if (a.appx?.some((n) => fresh.appx.has(n.toLowerCase())) || (a.capability && fresh.capabilities.has(a.capability.toLowerCase()))) a.installed = true;
      const key = repoIconKey(a);
      if (key && bundled.cells.has(key)) a.icon = bundled.cells.get(key);
      else a.glyph = useGlyph(fallback[kind], `app fallback ${kind}`);
      if (kind !== 'external') a.type = a.capability ? types.capability : a.feature ? types.feature : a.appx ? types.appx : '';
      else {
        // AppItemViewModel.CategoryDisplayName: the group's ExternalApps_Category_* string, else the raw name.
        const groupKey = 'ExternalApps_Category_' + a.group.replace(/[ &,()]/g, '');
        a.groupName = table[groupKey] ?? a.group;
      }
      appKeys.set(a.id, `${kind}:${a.name}`);
      delete a.appx; delete a.capability; delete a.feature; delete a.winget; delete a.choco; delete a.id;
    }
  }

  // Config Review loads the app's own recommended config: each setting it sets, as an option index, and the
  // apps it ticks. Like the app, it sets aside what this build doesn't have.
  const config = parseConfig(read('recommendedConfig'), APP_PATHS.recommendedConfig);
  const settingsById = new Map(features.flatMap((f) => f.settings.map((s) => [s.id, s])));
  const review = { settings: {}, apps: [] };
  for (const item of config.items) {
    const s = settingsById.get(item.Id);
    if (!s || item.InputType === 3) continue;
    const index = configIndex(item, s);
    if (index !== undefined) review.settings[item.Id] = index;
  }
  for (const id of [...config.windows, ...config.external]) if (appKeys.has(id)) review.apps.push(appKeys.get(id));
  if (Object.keys(review.settings).length < config.items.length / 2) throw new Error(`${APP_PATHS.recommendedConfig}: most items match no setting any more`);
  if (!review.apps.length) throw new Error(`${APP_PATHS.recommendedConfig}: no app matches the catalogs`);

  // Each page's header icon, drawn in PageHeader's variant at 64 (ColorLarge artwork) and at 16 in the
  // breadcrumb (20px Color artwork).
  const headerVariant = parseIconVariant(read('pageHeader'), APP_PATHS.pageHeader);
  const pageIcons = {};
  for (const [page, rel] of Object.entries(APP_PATHS.pages)) {
    const name = parsePageIcon(readAppFile(appRoot, rel), rel);
    pageIcons[page] = { small: useGlyph(name + headerVariant, `page ${page}`), large: useGlyph(`${name}${headerVariant}Large`, `page ${page}`) };
  }
  const badgeIcons = {};
  for (const [k, key] of [['recommended', 'BadgeRecommendedIconPath'], ['default', 'BadgeDefaultIconPath'], ['preference', 'BadgePreferenceIconPath']]) {
    if (!featureIcons[key]) throw new Error(`FeatureIcons.xaml has no ${key}`);
    badgeIcons[k] = useGlyph(featureIcons[key], `badge ${k}`);
  }
  for (const name of ['CheckmarkCircleColor', 'DismissCircleColor', 'ApprovalsAppColor', 'FlagColor', 'ErrorCircleColor',
    'ChevronRight', 'ChevronDown', 'ChevronUp', 'Search', 'ArrowDownload', 'Delete', 'ArrowSync', 'QuestionCircle', 'Open',
    'Grid', 'TableSimple', 'LineHorizontal3', 'Subtract', 'Maximize', 'Dismiss', 'DocumentSave', ...Object.values(SEGOE)]) useGlyph(name, 'demo chrome');
  const menuIcons = {};
  for (const [k, key] of [['infoBadges', 'BookInformationVariantIconPath'], ['newBadges', 'NewBoxIconPath'], ['windowsDefaults', 'WindowsLogoIconPath'], ['onlyChanges', 'CogTransferIconPath']]) {
    if (!featureIcons[key]) throw new Error(`FeatureIcons.xaml has no ${key}`);
    menuIcons[k] = useGlyph(featureIcons[key], `menu ${k}`);
  }
  const removal = parseRemovalItems(read('removalStatus')).map((r) => {
    if (!featureIcons[r.icon]) throw new Error(`FeatureIcons.xaml has no ${r.icon} (Windows Apps help)`);
    return { name: r.name, icon: useGlyph(featureIcons[r.icon], `help ${r.name}`) };
  });
  // The help flyouts link to the docs on winhance.net; the demo opens the same page on this site.
  const helpLinks = Object.fromEntries([['windows', 'windowsAppsHelp'], ['external', 'externalAppsHelp']].map(([k, file]) => {
    const url = parseHelpLink(read(file), APP_PATHS[file]);
    if (!url.startsWith('https://winhance.net/')) throw new Error(`${APP_PATHS[file]}: Learn more no longer points at winhance.net (${url})`);
    return [k, url.slice('https://winhance.net/'.length)];
  }));
  if (!featureIcons.ExternalAppsIconPath || !featureIcons.WindowsLogoIconPath) throw new Error('FeatureIcons.xaml lost the Software & Apps tab icons');
  const tabIcons = { windows: useGlyph(featureIcons.WindowsLogoIconPath, 'tab windows'), external: useGlyph(featureIcons.ExternalAppsIconPath, 'tab external') };

  const localizationDir = join(appRoot, dirname(APP_PATHS.strings));
  const localeFiles = readdirSync(localizationDir).filter((f) => /^[a-z]{2}(-[A-Za-z]+)?\.json$/.test(f)).sort();
  const languages = localeFiles.length;
  // Each locale names itself; the Settings page's language list is these, as the app shows them.
  const languageNames = localeFiles.map((f) => {
    const name = JSON.parse(readFileSync(join(localizationDir, f), 'utf8').replace(/^\uFEFF/, ''))._Meta_LanguageDisplayName;
    if (!name) throw new Error(`${f} has no _Meta_LanguageDisplayName`);
    return { code: f.replace('.json', ''), name };
  });
  // WIMUtil: each step header's icon (WimUtilPage.xaml) and each action card's (the Wim*ViewModel cards).
  // Cards drawn with a Segoe glyph get the Fluent icon of the same meaning; Fluent has no optical disc, so
  // E958 (StorageOptical) is Material's Disc, and the convert card's E740 (FullScreen, shown for a WIM) is
  // FullScreenMaximize.
  const wimIcons = {};
  for (const [k, ref] of [['step1', 'HardDrive'], ['step2', featureIcons.AutounattendXmlIconPath], ['step3', 'PlugConnected'],
    ['step4', featureIcons.WrenchClockIconPath], ['iso', 'Material/Disc'], ['folder', featureIcons.ExplorerIconPath],
    ['download', featureIcons.FileDownloadIconPath], ['select', featureIcons.AutounattendXmlIconPath],
    ['drivers', featureIcons.MemoryArrowDownIconPath], ['destination', 'DocumentSave'], ['output', 'Save'], ['usb', 'Usb'],
    ['convert', 'FullScreenMaximize']]) {
    if (!ref) throw new Error(`FeatureIcons.xaml lost the WIMUtil ${k} icon`);
    wimIcons[k] = useGlyph(ref, `WIMUtil ${k}`);
  }
  const settingsIcons = {};
  for (const [k, name] of [['language', 'LocalLanguage'], ['theme', 'PaintBrushSparkle'], ['backup', 'ArrowSync'], ['restorePoint', 'ShieldTask']]) {
    settingsIcons[k] = useGlyph(name, `settings ${k}`);
  }

  const app = {
    version: catalog.winhanceVersion,
    shell: {
      title: str(table, vmKeys.AppTitle ?? 'App_Title'),
      by: str(table, vmKeys.AppSubtitle ?? 'App_By'),
      titleBarHeight: titleBar.height,
      metrics: { ...metrics, ...parseBreakpoints(read('mainWindowCode'), read('appXaml')) },
      paneToggle: navGlyph,
      paneToggleLabel: str(table, vmKeys.ToggleNavigationTooltip ?? 'Tooltip_ToggleNavigation'),
      moreMenu,
      modeLabel: str(table, vmKeys.WinhanceModeLabel ?? 'Mode_Switcher_Label'),
      modes: titleBar.modes.map((m) => ({ ...m, image: `demo/assets/${m.image}` })),
      buttons,
      nav,
      pageIcons,
      badgeIcons,
      tabIcons,
      settingsIcons,
      wimIcons,
      menuIcons,
      filterOffIcon,
      lockIcon,
      removal,
      helpLinks,
      iconAtlas: bundled.atlas,
      languages: languageNames,
    },
    strings: Object.fromEntries(Object.entries(PAGE_KEYS).map(([page, keys]) => [page, strings(table, keys)])),
    features,
    apps,
    review,
    freshInstall: fresh.source,
    glyphs,
  };

  const counts = {
    version: `v${catalog.winhanceVersion}`,
    settings: String(catalog.settingCount),
    tweaks: String(features.filter((f) => f.area !== 'Autounattend').reduce((n, f) => n + f.settings.length, 0)),
    answerFile: String(features.filter((f) => f.area === 'Autounattend').reduce((n, f) => n + f.settings.length, 0)),
    externalApps: String(apps.external.length),
    windowsApps: String(apps.windows.length + apps.capabilities.length + apps.optionalFeatures.length),
    languages: String(languages),
    optimize: String(features.filter((f) => f.area === 'Optimize').reduce((n, f) => n + f.settings.length, 0)),
    customize: String(features.filter((f) => f.area === 'Customize').reduce((n, f) => n + f.settings.length, 0)),
  };
  for (const m of titleBar.modes) {
    counts[`mode${m.id}`] = m.label;
    // The tooltip opens by naming its mode ("Builder mode — ..."); beside a heading that already says so,
    // the page shows only what follows the dash.
    const tip = m.tooltip.includes(' \u2014 ') ? m.tooltip.slice(m.tooltip.indexOf(' \u2014 ') + 3) : m.tooltip;
    counts[`mode${m.id}Tip`] = tip.charAt(0).toUpperCase() + tip.slice(1);
  }
  for (const b of [...nav.top, ...nav.bottom]) counts[`nav${b.tag}`] = b.label;

  const out = new Map();
  out.set('demo/app.js', `window.WinhanceDemoData = ${JSON.stringify(app)};\n`);
  // Technical Details: the docs' own OptionMatrixView mirror, one file per feature, loaded on first expand.
  for (const f of catalog.features) {
    const html = Object.fromEntries(f.settings.map((s) => [s.id,
      optionWarnings(s) + matrixBody(s, catalog.referenceBuilds, urlFor, theme.geometries)]));
    out.set(`demo/tech/${f.id}.js`, `WinhanceDemoTech(${JSON.stringify(f.id)}, ${JSON.stringify(html)});\n`);
  }
  out.set('demo/tech-css.js', `WinhanceDemoTechCss(${JSON.stringify(techCss(siteDir))});\n`);
  for (const m of titleBar.modes) out.set(`demo/assets/${m.image}`, readFileSync(join(appRoot, APP_PATHS.modeIcons, m.image)));
  // MainWindowViewModel swaps the title-bar rocket by theme: white on dark, black on light.
  out.set('demo/assets/app-icon-dark.png', readFileSync(join(appRoot, APP_PATHS.appIconDark)));
  out.set('demo/assets/app-icon-light.png', readFileSync(join(appRoot, APP_PATHS.appIconLight)));
  const indexPath = join(siteDir, 'index.html');
  const navIcons = Object.fromEntries([...nav.top, ...nav.bottom].map((b) => [b.tag, b.icon.replace(/^Fluent\//, '')]));
  out.set('index.html', spliceSprite(spliceAreaIcons(spliceCounts(readFileSync(indexPath, 'utf8'), counts), navIcons), icons.site));
  return { out, counts };
}

// demo/icons/ is tools/app-icons.py's atlas of package-icons. It must list exactly what the repo's
// manifest lists, with the same hashes, or the demo would show icons the app no longer fetches.
function bundledIcons(siteDir, iconsRepo) {
  const indexFile = join(siteDir, 'demo', 'icons', 'index.json');
  const manifestFile = join(iconsRepo, 'manifest.json');
  if (!existsSync(indexFile) || !existsSync(join(siteDir, 'demo', 'icons', 'atlas.webp'))) throw new Error('demo/icons/ is missing its atlas -- run tools/app-icons.py');
  if (!existsSync(manifestFile)) throw new Error(`package-icons checkout missing at ${iconsRepo} (pass --icons)`);
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')).icons;
  const stale = [...new Set([...Object.keys(index.icons), ...Object.keys(manifest)])]
    .filter((rel) => index.icons[rel]?.sha256 !== manifest[rel]?.sha256);
  if (stale.length) throw new Error(`demo/icons/ differs from package-icons (${stale.length}: ${stale.slice(0, 5).join(', ')}) -- run tools/app-icons.py`);
  return {
    atlas: { src: 'demo/icons/atlas.webp', cell: index.cell, columns: index.columns, rows: index.rows },
    cells: new Map(Object.entries(index.icons).map(([rel, v]) => [rel, v.cell])),
  };
}

function freshInstall(siteDir) {
  const file = join(siteDir, 'tools', 'app-defaults', 'windows-11-pro.json');
  if (!existsSync(file)) throw new Error(`fresh-install app list missing at ${file} -- run tools/image-apps.py`);
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const set = (list) => new Set(list.map((n) => n.toLowerCase()));
  return { source: d.source, appx: set(d.appx), capabilities: set(d.capabilities) };
}

// The panels render the docs' own markup, so they wear the docs' own sheets. Those declare their tokens
// on :root, which a shadow tree can't see, so :root is read as :host; nothing else changes.
function techCss(siteDir) {
  const sheets = ['setting-card.css'].map((f) => readFileSync(join(siteDir, 'docs', 'css', f), 'utf8'));
  return `/* Generated by tools/gen-demo.mjs from docs/css/setting-card.css. Do not edit. */\n${
    sheets.join('\n').replace(/:root\b/g, ':host').replace(/:where\(\.setting-card\) /g, '')}\n:host{display:block}.wd-tech-body{padding:0 16px 16px}\n`;
}

export function spriteSvg(siteIcons, ids) {
  const symbols = ids.map((id) => {
    const g = siteIcons[`Fluent/${id}`] ?? siteIcons[`Material/${id}`];
    if (!g) throw new Error(`the page uses #i-${id}, which is not vendored in tools/icon-sources/site-icons.json`);
    // A Color icon carries its own body and gradients (ids already unique per key); the rest take currentColor.
    return g.svg ? `<symbol id="i-${id}" viewBox="${g.viewBox}">${g.svg}</symbol>`
      : `<symbol id="i-${id}" viewBox="${g.viewBox}"><path fill="currentColor" d="${g.path}"/></symbol>`;
  });
  return `<svg class="sprite" aria-hidden="true">${symbols.join('')}</svg>`;
}

// Rebuilds the inline sprite between <!-- gen:icons --> markers from the #i-<Name> refs the page makes.
export function spliceSprite(html, siteIcons) {
  const open = '<!-- gen:icons -->', close = '<!-- /gen:icons -->';
  const start = html.indexOf(open), end = html.indexOf(close);
  if (start < 0 || end < start) throw new Error('the page has no <!-- gen:icons --> ... <!-- /gen:icons --> block');
  const rest = html.slice(0, start) + html.slice(end);
  const ids = [...new Set([...rest.matchAll(/href="#i-(\w+)"/g)].map((m) => m[1]))].sort();
  return html.slice(0, start + open.length) + spriteSvg(siteIcons, ids) + html.slice(end);
}

// Each "What's in the app" row draws the icon the app's nav button for that page draws (its data-open tag).
export function spliceAreaIcons(html, navIcons) {
  let rows = 0;
  const out = html.replace(/<li class="area">[\s\S]*?<\/li>/g, (row) => {
    const tag = row.match(/data-open="(\w+)"/)?.[1];
    if (!navIcons[tag]) throw new Error(`index.html: an area row opens "${tag}", which has no nav button`);
    rows++;
    return row.replace(/(class="i area-icon"><use href="#i-)\w+/, (m, head) => head + navIcons[tag]);
  });
  if (!rows) throw new Error('index.html has no <li class="area"> rows');
  return out;
}

// <span data-gen="settings">455</span> -> text replaced; an unknown key fails, so a typo can't hide.
export function spliceCounts(html, counts) {
  return html.replace(/(<(\w+)[^>]*\sdata-gen="(\w+)"[^>]*>)([^<]*)(<\/\2>)/g, (all, open, tag, key, _old, close) => {
    if (!(key in counts)) throw new Error(`index.html: data-gen="${key}" is not a value gen-demo produces`);
    return `${open}${esc(counts[key])}${close}`;
  });
}

function main() {
  const { values } = parseArgs({ options: { app: { type: 'string' }, site: { type: 'string' }, icons: { type: 'string' }, check: { type: 'boolean' } } });
  const appRoot = resolve(values.app ?? DEFAULT_APP);
  const siteDir = resolve(values.site ?? DEFAULT_SITE);
  const iconsRepo = resolve(values.icons ?? DEFAULT_ICONS);
  const { out, counts } = generate({ appRoot, siteDir, iconsRepo });
  const changed = [];
  for (const [rel, content] of out) {
    const file = join(siteDir, rel);
    const current = existsSync(file) ? readFileSync(file) : null;
    const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (!current || !current.equals(next)) changed.push(rel);
    if (!values.check && (!current || !current.equals(next))) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, next);
    }
  }
  if (values.check) {
    if (changed.length) {
      console.error(`demo is out of date with the app (${changed.length} file(s)):\n  ${changed.join('\n  ')}`);
      process.exit(1);
    }
    console.log('demo matches the app');
    return;
  }
  console.log(`v${counts.version.replace(/^v/, '')}: wrote ${changed.length} file(s); ${counts.tweaks} settings, ${counts.externalApps} external apps, ${counts.languages} languages`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
