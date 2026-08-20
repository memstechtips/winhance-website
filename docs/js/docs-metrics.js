/* Measures the Technical Details panel's real monospace advance and narrows --mx-char-w to it.
 *
 * Every column in a matrix is `<fixed>px + <chars> * var(--mx-char-w)` (render-card.mjs), and the
 * CSS default for that token is 7.5px -- the advance of the fallback face a visitor WITHOUT Consolas
 * gets. On Windows, where the app's own font resolves, Consolas at 12px advances 6.6px, so every
 * table was carrying about 12% of width it never used. On security-uac-level that is ~140px of
 * padding shoved into a horizontal scroller.
 *
 * The token is deliberately only ever narrowed, never widened: the build-time deficit passes
 * (widenForPaths / widenForChips / widenForNotes) bake their extra room in as literal px against the
 * 7.5px assumption, so a smaller runtime advance leaves those passes generous, which is the safe
 * direction. A wider one would not, hence the clamp.
 */
(function () {
    'use strict';

    var CSS_DEFAULT = 7.5;
    // Long enough that a fractional per-glyph rounding error averages out, and mixed enough that a
    // face which is NOT actually monospace measures wide rather than short.
    var SAMPLE = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion 0123456789';

    function advanceOf(el) {
        var cs = getComputedStyle(el);
        var probe = document.createElement('span');
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.whiteSpace = 'pre';
        probe.style.left = '-9999px';
        probe.style.top = '0';
        probe.style.fontFamily = cs.fontFamily;
        probe.style.fontSize = cs.fontSize;
        probe.style.fontWeight = cs.fontWeight;
        probe.style.fontStyle = cs.fontStyle;
        probe.style.fontStretch = cs.fontStretch;
        probe.style.letterSpacing = cs.letterSpacing;
        probe.textContent = SAMPLE;
        document.body.appendChild(probe);
        var width = probe.getBoundingClientRect().width;
        probe.remove();
        return width / SAMPLE.length;
    }

    function apply() {
        // Any option label will do -- they all render TechDetail.Table.OptionLabel, the face
        // --mx-char-w was calibrated against.
        var label = document.querySelector('.mx-option code');
        if (!label) return;

        // 2% of headroom on top of the measured advance. A column is `<chars> * var(--mx-char-w)`
        // wide and its text is `<chars> * <real advance>`, so setting the token to exactly the
        // measured advance leaves a nowrap label filling its cell to the last sub-pixel -- and
        // per-glyph hinting means a particular string can round a fraction wider than the average
        // this sample measures. The old hard-coded 7.5px carried that slack by accident (it was the
        // fallback face's advance, not Consolas'); this keeps it on purpose.
        var advance = advanceOf(label) * 1.02;
        // A zero (display:none ancestor, measurement raced the layout) or anything wider than the
        // CSS default means "don't touch it" -- the stylesheet value already renders correctly.
        if (!(advance > 1) || advance >= CSS_DEFAULT) return;

        document.documentElement.style.setProperty('--mx-char-w', advance.toFixed(3) + 'px');
    }

    function run() {
        // JetBrains Mono is the webfont fallback for visitors without Consolas, so measuring before
        // it arrives measures the wrong face. document.fonts.ready settles immediately when the
        // local font wins, which is the Windows case.
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
        else apply();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
})();
