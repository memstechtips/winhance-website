// Readers for the parts of the Winhance source the landing-page demo mirrors.
// Every reader fails closed: if the app's source no longer has the shape it expects, it throws
// and names the file, so a release can never ship a demo quietly built from half the app.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const APP_PATHS = {
  strings: 'src/Winhance.Core/Features/Common/Localization/en.json',
  featureIds: 'src/Winhance.Core/Features/Common/Constants/FeatureIds.cs',
  featureDefinitions: 'src/Winhance.Core/Features/Common/Constants/FeatureDefinitions.cs',
  featureIcons: 'src/Winhance.UI/Features/Common/Resources/FeatureIcons.xaml',
  navSidebar: 'src/Winhance.UI/Features/Common/Controls/NavSidebar.xaml',
  navSidebarCode: 'src/Winhance.UI/Features/Common/Controls/NavSidebar.xaml.cs',
  moreMenuViewModel: 'src/Winhance.UI/Features/Common/ViewModels/MoreMenuViewModel.cs',
  mainWindow: 'src/Winhance.UI/MainWindow.xaml',
  mainWindowViewModel: 'src/Winhance.UI/ViewModels/MainWindowViewModel.cs',
  appCatalogs: 'src/Winhance.Core/Features/SoftwareApps/Catalogs',
  appIconDark: 'src/Winhance.UI/Assets/AppIcons/winhance-rocket-white-transparent-bg.png',
  appIconLight: 'src/Winhance.UI/Assets/AppIcons/winhance-rocket-black-transparent-bg.png',
  modeIcons: 'src/Winhance.UI/Assets/ModeIcons',
  dimConverter: 'src/Winhance.UI/Features/Common/Converters/BoolToDimOpacityConverter.cs',
  settingTemplates: 'src/Winhance.UI/Features/Common/Resources/SettingTemplates.xaml',
  iconSizes: 'src/Winhance.UI/Features/Common/Resources/IconSizes.xaml',
  navButton: 'src/Winhance.UI/Features/Common/Controls/NavButton.xaml',
  pageHeader: 'src/Winhance.UI/Features/Common/Controls/PageHeader.xaml',
  repoIconKey: 'src/Winhance.Core/Features/SoftwareApps/Models/RepoIconKey.cs',
  mainWindowCode: 'src/Winhance.UI/MainWindow.xaml.cs',
  appXaml: 'src/Winhance.UI/App.xaml',
  sponsorsDialog: 'src/Winhance.UI/Features/Common/Dialogs/SponsorsDialogBuilder.cs',
  recommendedConfig: 'src/Winhance.UI/Features/Common/Resources/Configs/Winhance_Recommended_Config.winhance',
  appItemViewModel: 'src/Winhance.UI/Features/SoftwareApps/ViewModels/AppItemViewModel.cs',
  removalStatus: 'src/Winhance.UI/Features/SoftwareApps/ViewModels/RemovalStatusContainerViewModel.cs',
  windowsAppsHelp: 'src/Winhance.UI/Features/SoftwareApps/Views/WindowsAppsHelpContent.xaml.cs',
  externalAppsHelp: 'src/Winhance.UI/Features/SoftwareApps/Views/ExternalAppsHelpContent.xaml.cs',
  pages: {
    SoftwareApps: 'src/Winhance.UI/Features/SoftwareApps/SoftwareAppsPage.xaml',
    Optimize: 'src/Winhance.UI/Features/Optimize/OptimizePage.xaml',
    Customize: 'src/Winhance.UI/Features/Customize/CustomizePage.xaml',
    Autounattend: 'src/Winhance.UI/Features/Autounattend/AutounattendPage.xaml',
    WimUtil: 'src/Winhance.UI/Features/WimUtil/WimUtilPage.xaml',
    Settings: 'src/Winhance.UI/Features/Settings/SettingsPage.xaml',
  },
};

export function readAppFile(appRoot, rel) {
  const file = join(appRoot, rel);
  if (!existsSync(file)) throw new Error(`app source missing: ${rel}`);
  return readFileSync(file, 'utf8').replace(/^﻿/, '');
}

function need(value, what, rel) {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    throw new Error(`${rel}: could not read ${what}`);
  }
  return value;
}

export function stringTable(text) {
  return JSON.parse(text);
}

export function str(strings, key) {
  const value = strings[key];
  if (typeof value !== 'string') throw new Error(`en.json has no string "${key}"`);
  return value;
}

// public const string Privacy = "Privacy";
export function parseFeatureIds(text) {
  const ids = {};
  for (const [, name, value] of text.matchAll(/public const string (\w+)\s*=\s*"([^"]+)"/g)) ids[name] = value;
  return need(Object.keys(ids).length ? ids : null, 'FeatureIds constants', APP_PATHS.featureIds);
}

// new(FeatureIds.Privacy, "Privacy & Security", "Optimize", "PrivacyIconPath"),
export function parseFeatureDefinitions(text, featureIds) {
  const defs = [];
  for (const [, idName, name, category, iconKey] of text.matchAll(/new\(FeatureIds\.(\w+),\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\)/g)) {
    const id = featureIds[idName];
    if (!id) throw new Error(`${APP_PATHS.featureDefinitions}: FeatureIds.${idName} is not a known constant`);
    defs.push({ id, name, category, iconKey });
  }
  return need(defs.length ? defs : null, 'FeatureDefinitions.All', APP_PATHS.featureDefinitions);
}

// <x:String x:Key="PrivacyIconPath">M12,17...</x:String>  (a Path geometry, 24x24 unless noted)
// <x:String x:Key="UpdateIconSymbol">ArrowSync</x:String>  (a Fluent icon name)
export function parseFeatureIcons(text) {
  const out = {};
  for (const [, key, value] of text.matchAll(/<x:String x:Key="(\w+)">([^<]+)<\/x:String>/g)) out[key] = value.trim();
  return need(Object.keys(out).length ? out : null, 'x:String icon resources', APP_PATHS.featureIcons);
}

// public string NavOptimizeText =>
//     _localizationService.GetStringOrDefault("Nav_Optimize", "Optimize");
export function parseViewModelStringKeys(text) {
  const out = {};
  for (const [, prop, key] of text.matchAll(/public string (\w+)\s*=>\s*_localizationService\.GetStringOrDefault\("([^"]+)"/g)) out[prop] = key;
  return need(Object.keys(out).length ? out : null, 'localized string properties', APP_PATHS.mainWindowViewModel);
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function bindingPath(value) {
  const m = value && value.match(/\{x:Bind ViewModel\.(\w+)/);
  return m ? m[1] : undefined;
}

// The icon string on a NavButton is either a literal Fluent name or {StaticResource Key} into FeatureIcons.xaml.
function resolveSymbol(value, icons, rel) {
  const m = value.match(/^\{StaticResource (\w+)\}$/);
  if (!m) return value;
  if (!icons[m[1]]) throw new Error(`${rel}: StaticResource ${m[1]} is not in FeatureIcons.xaml`);
  return icons[m[1]];
}

// Two StackPanels, TopNavPanel and BottomNavPanel, each holding <local:NavButton .../> in display order.
export function parseNavSidebar(text, { icons, vmKeys, strings }) {
  const rel = APP_PATHS.navSidebar;
  const panel = (name) => {
    const start = text.indexOf(`x:Name="${name}"`);
    if (start < 0) throw new Error(`${rel}: no ${name}`);
    const end = text.indexOf('</StackPanel>', start);
    const body = text.slice(start, end);
    return [...body.matchAll(/<local:NavButton\b[^>]*>/g)].map(([tag]) => {
      const prop = bindingPath(attr(tag, 'Text'));
      const key = vmKeys[prop];
      if (!key) throw new Error(`${rel}: NavButton text binding ${prop} has no localized key in MainWindowViewModel`);
      return {
        tag: need(attr(tag, 'NavigationTag'), 'NavigationTag', rel),
        label: str(strings, key),
        icon: resolveSymbol(need(attr(tag, 'IconSymbol'), 'IconSymbol', rel), icons, rel),
      };
    });
  };
  return { top: need(panel('TopNavPanel'), 'top nav buttons', rel), bottom: need(panel('BottomNavPanel'), 'bottom nav buttons', rel) };
}

// Title bar: row height, the three mode buttons (label + icon file) and the right-hand buttons in order.
export function parseTitleBar(text, { vmKeys, strings, icons }) {
  const rel = APP_PATHS.mainWindow;
  const height = Number(need(text.match(/<Grid x:Name="AppTitleBar" Height="(\d+)"/)?.[1], 'AppTitleBar height', rel));

  const modes = ['NormalModeButton', 'BuilderModeButton', 'ConfigReviewModeButton'].map((name) => {
    const named = text.indexOf(`x:Name="${name}"`);
    if (named < 0) throw new Error(`${rel}: no ${name}`);
    const block = text.slice(text.lastIndexOf('<ToggleButton', named), text.indexOf('</ToggleButton>', named));
    const tag = block.match(/<ToggleButton[^>]*>/)[0];
    const image = need(block.match(/ms-appx:\/\/\/Assets\/ModeIcons\/([\w.-]+\.png)/)?.[1], `${name} icon`, rel);
    const textProp = bindingPath(block.match(/<TextBlock[^>]*Text="([^"]+)"/)?.[1]);
    const tipProp = bindingPath(attr(tag, 'ToolTipService.ToolTip'));
    return {
      id: need(attr(tag, 'Tag'), `${name} Tag`, rel),
      label: str(strings, need(vmKeys[textProp], `${name} label key`, rel)),
      tooltip: str(strings, need(vmKeys[tipProp], `${name} tooltip key`, rel)),
      image,
    };
  });

  const start = text.indexOf('x:Name="TitleBarButtons"');
  if (start < 0) throw new Error(`${rel}: no TitleBarButtons`);
  const body = text.slice(start, text.indexOf('</Grid>', start));
  const buttons = [...body.matchAll(/<Button x:Name="(\w+)"([\s\S]*?)<\/Button>/g)].map(([, name, inner]) => {
    const tipProp = bindingPath(inner.match(/ToolTipService\.ToolTip="([^"]+)"/)?.[1]);
    const fluent = inner.match(/<fluentIcons:FluentIcon Icon="(\w+)" IconVariant="(\w+)"(?:[^>]*Foreground="#(\w{8})")?/);
    const path = inner.match(/Data="\{StaticResource (\w+)\}"/)?.[1];
    const labelProp = bindingPath(inner.match(/<TextBlock[^>]*Text="([^"]+)"/)?.[1]);
    const button = { name };
    if (fluent) {
      button.icon = fluent[2] === 'Filled' ? `${fluent[1]}Filled` : fluent[1];
      if (fluent[3]) button.color = `#${fluent[3].slice(2)}${fluent[3].slice(0, 2)}`;
    } else if (path) {
      if (!icons[path]) throw new Error(`${rel}: ${name} uses ${path}, not in FeatureIcons.xaml`);
      button.path = icons[path];
    } else {
      throw new Error(`${rel}: title bar button ${name} has no icon this generator can read`);
    }
    const tipKey = vmKeys[tipProp];
    if (tipKey) button.tooltip = str(strings, tipKey);
    if (labelProp) button.label = str(strings, need(vmKeys[labelProp], `${name} label key`, rel));
    return button;
  });
  return { height, modes, buttons: need(buttons, 'title bar buttons', rel) };
}

// ItemDefinition blocks in the SoftwareApps catalogs: Name, Description, GroupName, CanBeReinstalled.
export function parseAppItems(text) {
  const items = [];
  for (const [, body] of text.matchAll(/new ItemDefinition\s*\{([\s\S]*?)\n\s{16,20}\}/g)) {
    const get = (field) => body.match(new RegExp(`\\b${field}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`))?.[1];
    const name = get('Name');
    if (!name) continue;
    const item = { id: need(get('Id'), `Id of ${name}`, APP_PATHS.appCatalogs), name, description: get('Description') ?? '', group: get('GroupName') ?? '' };
    if (get('WebsiteUrl')) item.website = get('WebsiteUrl');
    const winget = body.match(/\bWinGetPackageId\s*=\s*\[\s*"([^"]+)"/)?.[1];
    if (winget) item.winget = winget;
    if (get('ChocoPackageId')) item.choco = get('ChocoPackageId');
    if (/\bCanBeReinstalled\s*=\s*false/.test(body)) item.permanent = true;
    if (/\bHasInstabilityWarning\s*=\s*true/.test(body)) item.warning = true;
    // How the app detects it: AppX package names, or a capability / optional feature name.
    const appx = body.match(/\bAppxPackageName\s*=\s*\[([^\]]*)\]/)?.[1];
    if (appx) item.appx = [...appx.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    for (const [field, key] of [['CapabilityName', 'capability'], ['OptionalFeatureName', 'feature']]) if (get(field)) item[key] = get(field);
    items.push(item);
  }
  return items;
}

// The FluentIcon variant a control draws with (NavButton and PageHeader both use Color).
export function parseIconVariant(text, rel) {
  return need(text.match(/<fluentIcons:FluentIcon\b[^>]*\bIconVariant="(\w+)"/)?.[1], 'FluentIcon IconVariant', rel);
}

// A page's header icon: SectionPageShell's PageIcon, or the Icon attribute on its PageHeader.
export function parsePageIcon(text, rel) {
  const icon = text.match(/\bPageIcon="(\w+)"/)?.[1] ?? text.match(/<\w+:PageHeader\b[^>]*?\bIcon="(\w+)"/)?.[1];
  return need(icon, 'page header icon', rel);
}

// RepoIconKey.cs: where an item's icon lives in memstechtips/package-icons. Ported rule for rule;
// repoIconKeyGuard checks the C# still has the branches this mirrors.
export function repoIconKey(item) {
  const id = item.id;
  if (id.startsWith('external-app-')) return `external/${(item.winget || item.choco || id.slice('external-app-'.length)).toLowerCase()}.png`;
  if (id.startsWith('windows-app-')) return item.appx?.[0] ? `windows/${item.appx[0].toLowerCase()}.png` : null;
  if (id.startsWith('capability-')) return item.capability ? `windows/${item.capability.toLowerCase()}.png` : null;
  if (id.startsWith('feature-')) return item.feature ? `windows/${item.feature.toLowerCase()}.png` : null;
  return null;
}

export function repoIconKeyGuard(text) {
  for (const marker of ['"external-app-"', '"windows-app-"', '"capability-"', '"feature-"', 'WinGetPackageId', 'ChocoPackageId', 'AppxPackageName', 'CapabilityName', 'OptionalFeatureName', 'icons/external/', 'icons/windows/']) {
    if (!text.includes(marker)) throw new Error(`${APP_PATHS.repoIconKey} no longer mentions ${marker} -- re-port repoIconKey()`);
  }
}

// The window sizes the app's layout changes at: the nav pane compacts below one width (MainWindow), and
// page headers and toolbars tighten below one height (App.xaml ShortWindowHeight).
export function parseBreakpoints(mainWindowCode, appXaml) {
  return {
    compactPaneBelowWidth: Number(need(mainWindowCode.match(/const double CompactPaneBelowWidth = (\d+);/)?.[1], 'CompactPaneBelowWidth', APP_PATHS.mainWindowCode)),
    shortWindowHeight: Number(need(appXaml.match(/<x:Double x:Key="ShortWindowHeight">(\d+)<\/x:Double>/)?.[1], 'ShortWindowHeight', APP_PATHS.appXaml)),
  };
}

// AppItemViewModel.ItemTypeDescription: the Type column's text for each kind of Windows item.
export function parseItemTypes(text) {
  const rel = APP_PATHS.appItemViewModel;
  const body = need(text.match(/string ItemTypeDescription\s*\{([\s\S]*?)return string\.Empty;/)?.[1], 'ItemTypeDescription', rel);
  const pick = (field) => need(body.match(new RegExp(`Definition\\.${field}[^)]*\\)\\)?\\s*return "([^"]+)"`))?.[1], `${field} type text`, rel);
  return { capability: pick('CapabilityName'), feature: pick('OptionalFeatureName'), appx: pick('AppxPackageName') };
}

// The Windows Apps help flyout's "Winhance Status" row: one button per removal script, name and icon key.
export function parseRemovalItems(text) {
  const items = [...text.matchAll(/new RemovalStatusViewModel\(\s*"([^"]+)",\s*"(\w+)"/g)].map(([, name, icon]) => ({ name, icon }));
  return need(items, 'RemovalStatusViewModel items', APP_PATHS.removalStatus);
}

// Where the links in the title bar and the More menu go. Report a Bug and Docs launch a URL from their view
// model (MainWindowViewModel, MoreMenuViewModel); Support opens the sponsors dialog, whose Support button goes
// to the store (SupportUrl, before its ?ref= source).
export function launchedUrl(text, method, rel) {
  return need(text.match(new RegExp(`Task ${method}\\(\\)[\\s\\S]*?new Uri\\("([^"]+)"\\)`))?.[1], `${method} URL`, rel);
}

export function parseSupportUrl(sponsorsDialog) {
  return need(sponsorsDialog.match(/const string SupportUrl = "([^"?]+)/)?.[1], 'SupportUrl', APP_PATHS.sponsorsDialog);
}

// A .winhance config: every setting item under Optimize and Customize, and the ids of the apps it ticks.
export function parseConfig(text, rel) {
  let cfg;
  try { cfg = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { throw new Error(`${rel}: not JSON (${e.message})`); }
  const items = [];
  for (const section of ['Optimize', 'Customize']) {
    for (const [id, f] of Object.entries(need(cfg[section]?.Features, `${section}.Features`, rel))) {
      items.push(...need(f.Items, `${section}.${id}.Items`, rel));
    }
  }
  const apps = (key) => need(cfg[key]?.Items, `${key}.Items`, rel).filter((i) => i.IsSelected).map((i) => need(i.Id, `${key} item Id`, rel));
  return { items, windows: apps('WindowsApps'), external: apps('ExternalApps') };
}

// A help flyout's Learn more link.
export function parseHelpLink(text, rel) {
  return need(text.match(/NavigateUri = new System\.Uri\("([^"]+)"\)/)?.[1], 'Learn more link', rel);
}

// Layout numbers the demo copies rather than guesses: the dimmed-pill opacity, the settings column's
// max width and card spacing, and the title bar's icon size.
export function parseMetrics({ dimConverter, settingTemplates, iconSizes }) {
  const dim = Number(need(dimConverter.match(/const double Dim = ([\d.]+);/)?.[1], 'Dim opacity', APP_PATHS.dimConverter));
  const double = (text, key, rel) => Number(need(text.match(new RegExp(`<x:Double x:Key="${key}">([\\d.]+)</x:Double>`))?.[1], key, rel));
  return {
    dimOpacity: dim,
    contentMaxWidth: double(settingTemplates, 'SettingsContentMaxWidth', APP_PATHS.settingTemplates),
    cardSpacing: double(settingTemplates, 'SettingsCardSpacing', APP_PATHS.settingTemplates),
    titleBarIconSize: double(iconSizes, 'TitleBarIconFontSize', APP_PATHS.iconSizes),
  };
}

// The More button's flyout: items and separators in XAML order. Each item's text is set in NavSidebar's
// code-behind by Tag -> a MoreMenuViewModel property -> en.json; the disabled, untagged item is the
// version line, whose format MoreMenuViewModel builds around the version tag.
export function parseMoreMenu(xaml, code, viewModel, strings) {
  const rel = APP_PATHS.navSidebar;
  const start = xaml.indexOf('x:Name="MoreMenuFlyout"');
  if (start < 0) throw new Error(`${rel}: no MoreMenuFlyout`);
  const body = xaml.slice(start, xaml.indexOf('</MenuFlyout>', start));
  const tagToProp = {};
  for (const [, tag, prop] of code.matchAll(/"(\w+)" => _moreMenuViewModel\.(\w+),/g)) tagToProp[tag] = prop;
  const propToKey = parseViewModelStringKeys(viewModel);
  const versionFormat = need(viewModel.match(/VersionInfo = \$"([^"{]*)\{versionInfo\.Version\}"/)?.[1], 'version line format', APP_PATHS.moreMenuViewModel);

  const items = [...body.matchAll(/<MenuFlyoutSeparator\/>|<MenuFlyoutItem\b([^>]*)>([\s\S]*?)<\/MenuFlyoutItem>/g)].map(([whole, attrs, inner]) => {
    if (whole.startsWith('<MenuFlyoutSeparator')) return { separator: true };
    const icon = inner.match(/<fluentIcons:FluentIcon Icon="(\w+)" IconVariant="(\w+)"(?:[^>]*Foreground="#(\w{8})")?/);
    if (!icon) throw new Error(`${rel}: More menu item without a Fluent icon`);
    const item = { icon: icon[2] === 'Filled' ? `${icon[1]}Filled` : icon[1] };
    if (icon[3]) item.color = `#${icon[3].slice(2)}${icon[3].slice(0, 2)}`;
    const tag = attr(`<x ${attrs}>`, 'Tag');
    if (!tag && /IsEnabled="False"/.test(attrs)) {
      item.version = versionFormat;
      item.disabled = true;
      return item;
    }
    item.tag = tag;
    const prop = tagToProp[tag];
    if (!prop) throw new Error(`${APP_PATHS.navSidebarCode}: no text for More menu Tag "${tag}"`);
    item.label = str(strings, need(propToKey[prop], `${prop} key`, APP_PATHS.moreMenuViewModel));
    return item;
  });
  return need(items, 'More menu items', rel);
}
