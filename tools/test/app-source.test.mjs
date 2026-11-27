import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFeatureIds, parseFeatureDefinitions, parseFeatureIcons, parseViewModelStringKeys,
  parseNavSidebar, parseTitleBar, parseAppItems, parseMetrics, parseMoreMenu,
  parseIconVariant, parsePageIcon, repoIconKey, repoIconKeyGuard, parseItemTypes, parseBreakpoints,
  launchedUrl, parseHelpLinks, parseSupportUrl, parseConfig, parseAppsViewMenu, parseColors,
} from '../lib/app-source.mjs';
import { spliceCounts, spliceSprite, spliceAreaIcons } from '../gen-demo.mjs';

// Trimmed copies of the real files' shapes, so a reader that stops matching the app's layout fails here.
const FEATURE_IDS = `public static class FeatureIds
{
    public const string Privacy = "Privacy";
    public const string Explorer = "Explorer";
}`;

const FEATURE_DEFS = `new(FeatureIds.Explorer, "Explorer", "Customize", "ExplorerIconSymbol"),
        new(FeatureIds.Privacy, "Privacy & Security", "Optimize", "PrivacyIconSymbol"),`;

const ICONS = `<x:String x:Key="OptimizeIconSymbol">Gauge</x:String>
    <x:String x:Key="PrivacyIconSymbol">Shield</x:String>`;

const VM = `    public Icon WindowsFilterIcon => IsWindowsVersionFilterEnabled ? Icon.Filter : Icon.FilterDismiss;
    public string NavOptimizeText =>
        _localizationService.GetStringOrDefault("Nav_Optimize", "Optimize");
    public string NavMoreText =>
        _localizationService.GetStringOrDefault("Nav_More", "More");
    public string ModeNormalLabel => _localizationService.GetStringOrDefault("Mode_Normal", "Normal");
    public string ModeNormalTooltip => _localizationService.GetStringOrDefault("Mode_Normal_Tooltip", "Normal mode");
    public string DonateTooltip =>
        _localizationService.GetStringOrDefault("Menu_SupportWinhance", "Support Winhance");
    public string SupportButtonText =>
        _localizationService.GetStringOrDefault("Support_TitleBarLabel", "Support");`;

const STRINGS = {
  Nav_Optimize: 'Optimize', Nav_More: 'More', Mode_Normal: 'Normal', Mode_Normal_Tooltip: 'Normal mode — applies now.',
  Menu_SupportWinhance: 'Support Winhance', Support_TitleBarLabel: 'Support',
};

const NAV = `<StackPanel x:Name="TopNavPanel" Grid.Row="0">
            <local:NavButton x:Name="OptimizeButton"
                             IconSymbol="{StaticResource OptimizeIconSymbol}"
                             Text="{x:Bind ViewModel.NavOptimizeText, Mode=OneWay}"
                             NavigationTag="Optimize"
                             Clicked="NavButton_Clicked"/>
        </StackPanel>
        <StackPanel x:Name="BottomNavPanel" Grid.Row="2">
            <local:NavButton x:Name="MoreButton"
                             IconSymbol="ListBar"
                             Text="{x:Bind ViewModel.NavMoreText, Mode=OneWay}"
                             NavigationTag="More"
                             Clicked="NavButton_Clicked">
            </local:NavButton>
        </StackPanel>`;

function modeButton(name, tag) {
  return `<ToggleButton x:Name="${name}"
                                      Tag="${tag}"
                                      ToolTipService.ToolTip="{x:Bind ViewModel.ModeNormalTooltip, Mode=OneWay}"
                                      Padding="10,6">
                            <StackPanel Orientation="Horizontal" Spacing="6">
                                <Image Source="ms-appx:///Assets/ModeIcons/winhance-monitor.png"/>
                                <TextBlock Text="{x:Bind ViewModel.ModeNormalLabel, Mode=OneWay}"/>
                            </StackPanel>
                        </ToggleButton>`;
}

const MAIN = `<Grid x:Name="AppTitleBar" Height="48" Grid.Row="0">
${modeButton('NormalModeButton', 'Normal')}
${modeButton('BuilderModeButton', 'Builder')}
${modeButton('ConfigReviewModeButton', 'ConfigReview')}
            <StackPanel x:Name="TitleBarButtons" Grid.Column="5">
                <Button x:Name="DonateButton"
                        ToolTipService.ToolTip="{x:Bind ViewModel.DonateTooltip, Mode=OneWay}">
                    <StackPanel Orientation="Horizontal" Spacing="6">
                        <fluentIcons:FluentIcon Icon="Heart" IconVariant="Filled" FontSize="22" Foreground="#FFE74C3C"/>
                        <TextBlock x:Name="SupportButtonText" Text="{x:Bind ViewModel.SupportButtonText, Mode=OneWay}"/>
                    </StackPanel>
                </Button>
                <Button x:Name="WindowsFilterButton">
                    <fluentIcons:FluentIcon Icon="{x:Bind ViewModel.WindowsFilterIcon, Mode=OneWay}" IconVariant="Regular"/>
                </Button>
            </StackPanel>
        </Grid>`;

test('feature definitions resolve FeatureIds constants, in the order the app declares them', () => {
  const ids = parseFeatureIds(FEATURE_IDS);
  assert.deepEqual(ids, { Privacy: 'Privacy', Explorer: 'Explorer' });
  const defs = parseFeatureDefinitions(FEATURE_DEFS, ids);
  assert.deepEqual(defs.map((d) => [d.id, d.category, d.iconKey]), [['Explorer', 'Customize', 'ExplorerIconSymbol'], ['Privacy', 'Optimize', 'PrivacyIconSymbol']]);
  assert.throws(() => parseFeatureDefinitions('new(FeatureIds.Gone, "x", "y", "z"),', ids), /FeatureIds\.Gone/);
});

test('nav buttons come out in XAML order with their localized labels and resolved icons', () => {
  const icons = parseFeatureIcons(ICONS);
  const vmKeys = parseViewModelStringKeys(VM);
  const nav = parseNavSidebar(NAV, { icons, vmKeys, strings: STRINGS });
  assert.deepEqual(nav, {
    top: [{ tag: 'Optimize', label: 'Optimize', icon: 'Gauge' }],
    bottom: [{ tag: 'More', label: 'More', icon: 'ListBar' }],
  });
});

test('a nav label with no string in en.json fails instead of shipping blank', () => {
  const icons = parseFeatureIcons(ICONS);
  const vmKeys = parseViewModelStringKeys(VM);
  assert.throws(() => parseNavSidebar(NAV, { icons, vmKeys, strings: { Nav_More: 'More' } }), /Nav_Optimize/);
});

test('title bar: height, three modes, and buttons with Fluent icons', () => {
  const tb = parseTitleBar(MAIN, { vmKeys: parseViewModelStringKeys(VM), strings: STRINGS, vm: VM });
  assert.equal(tb.height, 48);
  assert.deepEqual(tb.modes.map((m) => m.id), ['Normal', 'Builder', 'ConfigReview']);
  assert.equal(tb.modes[0].image, 'winhance-monitor.png');
  assert.deepEqual(tb.buttons[0], { name: 'DonateButton', icon: 'HeartFilled', color: '#E74C3CFF', tooltip: 'Support Winhance', label: 'Support' });
  assert.equal(tb.buttons[1].icon, 'Filter');
});

test('app items: every ItemDefinition block, escaped quotes kept, flags and detection identity read', () => {
  const src = `Items = new List<ItemDefinition>
            {
                new ItemDefinition
                {
                    Id = "windows-app-a",
                    Name = "Say \\"hi\\"",
                    Description = "First",
                    WebsiteUrl = "https://a.example",
                    GroupName = "Tools",
                    AppxPackageName = ["Vendor.A", "Vendor.A2"],
                    HasInstabilityWarning = true,
                    CanBeReinstalled = false
                },
                new ItemDefinition
                {
                    Id = "capability-b",
                    Name = "Second",
                    GroupName = "Tools",
                    CapabilityName = "Cap.B",
                },
                new ItemDefinition
                {
                    Id = "external-app-c",
                    Name = "Third",
                    WinGetPackageId = ["Vendor.Third", "Other.Id"],
                    ChocoPackageId = "third",
                },
                new ItemDefinition
                {
                    Name = "No id",
                },
            }`;
  assert.throws(() => parseAppItems(src), /Id of No id/);
  const items = parseAppItems(src.replace(/\s+new ItemDefinition\s*\{\s*Name = "No id",\s*\},/, ''));
  assert.deepEqual(items, [
    { id: 'windows-app-a', name: 'Say \\"hi\\"', description: 'First', group: 'Tools', website: 'https://a.example', permanent: true, warning: true, appx: ['Vendor.A', 'Vendor.A2'] },
    { id: 'capability-b', name: 'Second', description: '', group: 'Tools', capability: 'Cap.B' },
    { id: 'external-app-c', name: 'Third', description: '', group: '', winget: 'Vendor.Third', choco: 'third' },
  ]);
});

test('repo icon keys follow RepoIconKey.cs: winget, then choco, then the id for external; detection name for Windows', () => {
  assert.equal(repoIconKey({ id: 'external-app-x', winget: 'Mozilla.Firefox', choco: 'firefox' }), 'external/mozilla.firefox.png');
  assert.equal(repoIconKey({ id: 'external-app-x', choco: 'Firefox' }), 'external/firefox.png');
  assert.equal(repoIconKey({ id: 'external-app-Some-App' }), 'external/some-app.png');
  assert.equal(repoIconKey({ id: 'windows-app-x', appx: ['Microsoft.Paint', 'Other'] }), 'windows/microsoft.paint.png');
  assert.equal(repoIconKey({ id: 'capability-x', capability: 'Browser.InternetExplorer' }), 'windows/browser.internetexplorer.png');
  assert.equal(repoIconKey({ id: 'feature-x', feature: 'NetFx3' }), 'windows/netfx3.png');
  assert.equal(repoIconKey({ id: 'windows-app-x' }), null);
  assert.equal(repoIconKey({ id: 'other' }), null);
  assert.throws(() => repoIconKeyGuard('"external-app-" WinGetPackageId'), /re-port repoIconKey/);
});

test('icon variant, page icon, item types and breakpoints read from source, fail when gone', () => {
  assert.equal(parseIconVariant('<fluentIcons:FluentIcon x:Name="I" IconVariant="Color" FontSize="20"/>', 'NavButton.xaml'), 'Color');
  assert.throws(() => parseIconVariant('<FontIcon/>', 'NavButton.xaml'), /IconVariant/);
  assert.equal(parsePageIcon('<local:SectionPageShell PageIcon="Gauge"/>', 'x'), 'Gauge');
  assert.equal(parsePageIcon('<c:PageHeader\n    Grid.Row="0"\n    Icon="Settings"\n    Title="t"/>', 'x'), 'Settings');
  assert.throws(() => parsePageIcon('<Grid/>', 'x'), /page header icon/);
  const types = parseItemTypes(`public string ItemTypeDescription => Definition.Kind switch
    {
        WindowsAppKind.AppxPackage => _localizationService.GetString("SoftwareApps_Type_AppxPackage"),
        WindowsAppKind.Capability => _localizationService.GetString("SoftwareApps_Type_LegacyCapability"),
        _ => string.Empty,
    };`);
  assert.deepEqual(types, { AppxPackage: 'SoftwareApps_Type_AppxPackage', Capability: 'SoftwareApps_Type_LegacyCapability' });
  assert.throws(() => parseItemTypes('nothing'), /ItemTypeDescription/);
  assert.deepEqual(parseBreakpoints('private const double CompactPaneBelowWidth = 1008;', '<x:Double x:Key="ShortWindowHeight">800</x:Double>'),
    { compactPaneBelowWidth: 1008, shortWindowHeight: 800 });
  assert.throws(() => parseBreakpoints('', ''), /CompactPaneBelowWidth/);
});

test('metrics are read from the app, and a missing one fails', () => {
  const m = parseMetrics({
    dimConverter: 'private const double Dim = 0.35;',
    settingTemplates: '<x:Double x:Key="SettingsCardSpacing">4</x:Double><x:Double x:Key="SettingsContentMaxWidth">1000</x:Double>',
    iconSizes: '<x:Double x:Key="TitleBarIconFontSize">20</x:Double>',
  });
  assert.deepEqual(m, { dimOpacity: 0.35, contentMaxWidth: 1000, cardSpacing: 4, titleBarIconSize: 20 });
  assert.throws(() => parseMetrics({ dimConverter: '', settingTemplates: '', iconSizes: '' }), /Dim opacity/);
});

test('spliceCounts rewrites data-gen text, escapes it, and rejects unknown keys', () => {
  const html = '<p><strong data-gen="settings">1</strong> and <span class="x" data-gen="nav">old</span></p>';
  assert.equal(spliceCounts(html, { settings: '455', nav: 'Software & Apps' }),
    '<p><strong data-gen="settings">455</strong> and <span class="x" data-gen="nav">Software &amp; Apps</span></p>');
  assert.throws(() => spliceCounts('<b data-gen="nope">x</b>', {}), /nope/);
});

test('spliceSprite inlines exactly the icons the page uses, and fails on one not vendored', () => {
  const icons = { 'Fluent/Star': { viewBox: '0 0 20 20', path: 'M1 1Z' }, 'Fluent/Unused': { viewBox: '0 0 20 20', path: 'M2 2Z' } };
  const html = '<body><!-- gen:icons -->stale<!-- /gen:icons --><svg><use href="#i-Star"/></svg></body>';
  assert.equal(spliceSprite(html, icons),
    '<body><!-- gen:icons --><svg class="sprite" aria-hidden="true"><symbol id="i-Star" viewBox="0 0 20 20"><path fill="currentColor" d="M1 1Z"/></symbol></svg><!-- /gen:icons --><svg><use href="#i-Star"/></svg></body>');
  assert.throws(() => spliceSprite(html.replace('#i-Star', '#i-Gone'), icons), /i-Gone/);
  assert.throws(() => spliceSprite('<p></p>', icons), /gen:icons/);
  const color = { 'Fluent/StarColor': { viewBox: '0 0 20 20', svg: '<path fill="url(#StarColor-0)" d="M1 1Z"/>' } };
  assert.match(spliceSprite(html.replace('#i-Star', '#i-StarColor'), color),
    /<symbol id="i-StarColor" viewBox="0 0 20 20"><path fill="url\(#StarColor-0\)" d="M1 1Z"\/><\/symbol>/);
});

test('area rows take the icon of the nav button their Open button opens, and fail on an unknown page', () => {
  const row = (tag, icon) => `<li class="area">\n<svg class="i area-icon"><use href="#i-${icon}"/></svg>\n<button data-open="${tag}">Open it</button>\n</li>`;
  const html = '<ol>' + row('Optimize', 'Gauge') + row('WimUtil', 'Gauge') + '</ol>';
  assert.equal(spliceAreaIcons(html, { Optimize: 'GaugeColor', WimUtil: 'WrenchScrewdriverColor' }),
    '<ol>' + row('Optimize', 'GaugeColor') + row('WimUtil', 'WrenchScrewdriverColor') + '</ol>');
  assert.throws(() => spliceAreaIcons(html, { Optimize: 'GaugeColor' }), /WimUtil/);
  assert.throws(() => spliceAreaIcons('<ol></ol>', {}), /no <li class="area">/);
});

test('More menu: XAML order, separators kept, labels via Tag -> view-model property -> en.json, version line format', () => {
  const xaml = `<MenuFlyout x:Name="MoreMenuFlyout" Placement="RightEdgeAlignedBottom">
                        <MenuFlyoutItem x:Name="VersionMenuItem" IsEnabled="False">
                            <MenuFlyoutItem.Icon>
                                <fluentIcons:FluentIcon Icon="Info" IconVariant="Regular" FontSize="20"/>
                            </MenuFlyoutItem.Icon>
                        </MenuFlyoutItem>
                        <MenuFlyoutSeparator/>
                        <MenuFlyoutItem x:Name="SupportWinhanceMenuItem" Click="MoreMenuItem_Click" Tag="SupportWinhance">
                            <MenuFlyoutItem.Icon>
                                <fluentIcons:FluentIcon Icon="Heart" IconVariant="Filled" FontSize="20" Foreground="#FFE74C3C"/>
                            </MenuFlyoutItem.Icon>
                        </MenuFlyoutItem>
                    </MenuFlyout>`;
  const code = '"SupportWinhance" => _moreMenuViewModel.MenuSupportWinhance,';
  const vm = `VersionInfo = $"Winhance {versionInfo.Version}";
    public string MenuSupportWinhance =>
        _localizationService.GetStringOrDefault("Menu_SupportWinhance", "Support Winhance");`;
  assert.deepEqual(parseMoreMenu(xaml, code, vm, STRINGS), [
    { icon: 'Info', version: 'Winhance ', disabled: true },
    { separator: true },
    { icon: 'HeartFilled', color: '#E74C3CFF', label: 'Support Winhance', tag: 'SupportWinhance' },
  ]);
  assert.throws(() => parseMoreMenu(xaml, '', vm, STRINGS), /SupportWinhance/);
});

test('parseMoreMenu: an icon colour named by StaticResource resolves through parseColors', () => {
  const styles = `<Color x:Key="SupportHeartColor">#FFE74C3C</Color>
    <SolidColorBrush x:Key="SupportHeartBrush" Color="{StaticResource SupportHeartColor}"/>`;
  const xaml = `<MenuFlyout x:Name="MoreMenuFlyout">
                        <MenuFlyoutItem x:Name="SupportWinhanceMenuItem" Click="MoreMenuItem_Click" Tag="SupportWinhance">
                            <MenuFlyoutItem.Icon>
                                <fluentIcons:FluentIcon Icon="Heart" IconVariant="Filled" FontSize="20" Foreground="{StaticResource SupportHeartBrush}"/>
                            </MenuFlyoutItem.Icon>
                        </MenuFlyoutItem>
                    </MenuFlyout>`;
  const code = '"SupportWinhance" => _moreMenuViewModel.MenuSupportWinhance,';
  const vm = `VersionInfo = $"Winhance {versionInfo.Version}";
    public string MenuSupportWinhance =>
        _localizationService.GetStringOrDefault("Menu_SupportWinhance", "Support Winhance");`;
  assert.equal(parseMoreMenu(xaml, code, vm, STRINGS, parseColors(styles))[0].color, '#E74C3CFF');
  assert.throws(() => parseMoreMenu(xaml, code, vm, STRINGS), /not a colour this generator can read/);
});

test('links: a view model method\'s launched URL, and the store URL without its ?ref= source', () => {
  const vm = `[RelayCommand]
    private async Task DocsAsync()
    {
        await Launcher.LaunchUriAsync(new Uri("https://winhance.net/docs/index.html"));
    }
    private async Task BugReportAsync() => await Launcher.LaunchUriAsync(new Uri("https://github.com/memstechtips/Winhance/issues"));`;
  assert.equal(launchedUrl(vm, 'DocsAsync', 'vm.cs'), 'https://winhance.net/docs/index.html');
  assert.equal(launchedUrl(vm, 'BugReportAsync', 'vm.cs'), 'https://github.com/memstechtips/Winhance/issues');
  assert.throws(() => launchedUrl(vm, 'OpenDocsAsync', 'vm.cs'), /vm\.cs: could not read OpenDocsAsync URL/);
  const helpCs = `private const string DocsRoot = "https://winhance.net/docs/";
    public static readonly Uri BugReport =
        new("https://github.com/memstechtips/Winhance/issues/new");
    internal static readonly IReadOnlyDictionary<string, string> DocsPageByTag = new Dictionary<string, string>
    {
        ["Optimize"] = "features/optimize.html",
    };
    public static Uri DocsFor(string? pageTag) =>
        new(DocsRoot + (pageTag is not null && DocsPageByTag.TryGetValue(pageTag, out var page) ? page : "index.html"));`;
  const help = parseHelpLinks(helpCs);
  assert.equal(help.bugReport, 'https://github.com/memstechtips/Winhance/issues/new');
  assert.equal(help.docsFor('Optimize'), 'https://winhance.net/docs/features/optimize.html');
  assert.equal(help.docsFor(null), 'https://winhance.net/docs/index.html');
  const helpVm = `private async Task BugReportAsync() { await Launcher.LaunchUriAsync(HelpLinks.BugReport); }
    private async Task DocsAsync(string? pageTag) { await Launcher.LaunchUriAsync(HelpLinks.DocsFor(pageTag)); }`;
  assert.equal(launchedUrl(helpVm, 'BugReportAsync', 'vm.cs', help), 'https://github.com/memstechtips/Winhance/issues/new');
  assert.equal(launchedUrl(helpVm, 'DocsAsync', 'vm.cs', help), 'https://winhance.net/docs/index.html');
  assert.throws(() => parseHelpLinks('class X {}'), /HelpLinks\.cs: could not read DocsRoot/);
  assert.equal(parseSupportUrl('private const string SupportUrl = "https://store.memstechtips.com/winhance/?ref=app";'), 'https://store.memstechtips.com/winhance/');
  assert.throws(() => parseSupportUrl('const string StoreUrl = "x";'), /SupportUrl/);
});

test('config: setting items from every Optimize and Customize feature, and the ticked apps by id', () => {
  const file = '\uFEFF' + JSON.stringify({
    WindowsApps: { Items: [{ Id: 'windows-app-a', IsSelected: true }, { Id: 'windows-app-b', IsSelected: false }] },
    ExternalApps: { Items: [{ Id: 'external-app-c', IsSelected: true }] },
    Optimize: { Features: { Power: { Items: [{ Id: 'p1', InputType: 1, SelectedIndex: 2 }] } } },
    Customize: { Features: { Taskbar: { Items: [{ Id: 't1', InputType: 0, IsSelected: true }] } } },
  });
  assert.deepEqual(parseConfig(file, 'rec.winhance'), {
    items: [{ Id: 'p1', InputType: 1, SelectedIndex: 2 }, { Id: 't1', InputType: 0, IsSelected: true }],
    windows: ['windows-app-a'],
    external: ['external-app-c'],
  });
  assert.throws(() => parseConfig('{', 'rec.winhance'), /rec\.winhance: not JSON/);
  assert.throws(() => parseConfig(JSON.stringify({ Optimize: { Features: {} } }), 'rec.winhance'), /Customize\.Features/);
});

test('Software & Apps View menu: icon, label, and items in order with the flags they bind', () => {
  const vm = `    public string ViewMenuText => _localizationService.GetString("View_Menu");
    public string ViewModeCardTooltip => _localizationService.GetString("ViewMode_Card");
    public string SortNameAscText => _localizationService.GetStringOrDefault("SoftwareApps_Sort_NameAZ", "Name A-Z");
    public string SortTableHintText => _localizationService.GetStringOrDefault("SoftwareApps_Sort_TableHint", "Sort with the column headers");
    public string FilterUpdatesText => _localizationService.GetString("SoftwareApps_ShowUpdatesOnly");
    public string ExportListText => _localizationService.GetString("SoftwareApps_ExportList");`;
  const strings = { View_Menu: 'View', ViewMode_Card: 'Card View', SoftwareApps_Sort_NameAZ: 'Name A-Z',
    SoftwareApps_Sort_TableHint: 'Sort with the column headers', SoftwareApps_ShowUpdatesOnly: 'Show apps with updates only',
    SoftwareApps_ExportList: 'Export list as CSV' };
  const xaml = (items) => `<DropDownButton x:Name="ViewMenuButton"
                            ToolTipService.ToolTip="{x:Bind ViewModel.ViewMenuText, Mode=OneWay}">
                <StackPanel Orientation="Horizontal" Spacing="8">
                    <fluentIcons:FluentIcon Icon="Eye" IconVariant="Regular" FontSize="{StaticResource ActionBarIconFontSize}"/>
                    <TextBlock x:Name="ViewMenuLabel" Text="{x:Bind ViewModel.ViewMenuText, Mode=OneWay}"/>
                </StackPanel>
                <DropDownButton.Flyout>
                    <MenuFlyout Placement="BottomEdgeAlignedRight">${items}
                    </MenuFlyout>
                </DropDownButton.Flyout>
            </DropDownButton>`;
  const items = `
                        <RadioMenuFlyoutItem GroupName="AppsViewMode"
                                             Text="{x:Bind ViewModel.ViewModeCardTooltip, Mode=OneWay}"
                                             IsChecked="{x:Bind ViewModel.IsCardView, Mode=OneWay}"
                                             Click="ViewCard_Click"/>
                        <MenuFlyoutSeparator/>
                        <RadioMenuFlyoutItem GroupName="AppsSortMode"
                                             Text="{x:Bind ViewModel.SortNameAscText, Mode=OneWay}"
                                             IsChecked="{x:Bind ViewModel.IsSortNameAsc, Mode=OneWay}"
                                             IsEnabled="{x:Bind ViewModel.IsSortEnabled, Mode=OneWay}"
                                             Click="SortNameAsc_Click"/>
                        <MenuFlyoutItem Text="{x:Bind ViewModel.SortTableHintText, Mode=OneWay}"
                                        IsEnabled="False"
                                        Visibility="{x:Bind ViewModel.IsTableView, Mode=OneWay, Converter={StaticResource BooleanToVisibilityConverter}}"/>
                        <RadioMenuFlyoutItem GroupName="AppsFilter"
                                             Text="{x:Bind ViewModel.FilterUpdatesText, Mode=OneWay}"
                                             IsChecked="{x:Bind ViewModel.IsFilterUpdates, Mode=OneWay}"
                                             Visibility="{x:Bind ViewModel.IsExternalAppsTabSelected, Mode=OneWay, Converter={StaticResource BooleanToVisibilityConverter}}"
                                             Click="FilterUpdates_Click"/>
                        <MenuFlyoutItem Text="{x:Bind ViewModel.ExportListText, Mode=OneWay}"
                                        Command="{x:Bind ViewModel.ExportListCommand}"/>`;
  assert.deepEqual(parseAppsViewMenu(xaml(items), vm, strings), {
    icon: 'Eye',
    label: 'View',
    items: [
      { label: 'Card View', group: 'AppsViewMode', checked: 'IsCardView' },
      { separator: true },
      { label: 'Name A-Z', group: 'AppsSortMode', checked: 'IsSortNameAsc', enabled: 'IsSortEnabled' },
      { label: 'Sort with the column headers', visible: 'IsTableView', disabled: true },
      { label: 'Show apps with updates only', visible: 'IsExternalAppsTabSelected', group: 'AppsFilter', checked: 'IsFilterUpdates' },
      { label: 'Export list as CSV', command: 'ExportListCommand' },
    ],
  });
  assert.throws(() => parseAppsViewMenu('<StackPanel/>', vm, strings), /no ViewMenuButton/);
  assert.throws(() => parseAppsViewMenu(xaml(items.replace('Command="{x:Bind ViewModel.ExportListCommand}"', 'Click="Export_Click"')), vm, strings), /not a view-model command/);
  assert.throws(() => parseAppsViewMenu(xaml(items + '<ToggleMenuFlyoutItem Text="x"/>'), vm, strings), /ToggleMenuFlyoutItem/);
  assert.throws(() => parseAppsViewMenu(xaml(items.replace('ViewModel.IsCardView', 'ViewModel.WindowsAppsViewModel.IsCardView')), vm, strings), /not a plain view-model flag/);
  assert.throws(() => parseAppsViewMenu(xaml(items), vm, { ...strings, ViewMode_Card: undefined }), /ViewMode_Card/);
});
