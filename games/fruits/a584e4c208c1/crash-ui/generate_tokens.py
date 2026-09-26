"""Generate browser tokens from the Godot design-system source (ui/design_tokens.gd).

Outputs web/tokens.css (custom properties), web/tokens.js (window.CrashTokens) and
web/ui.css (ui.source.css with breakpoint placeholders resolved). Run with --check to
verify the generated files are current.
"""
from pathlib import Path
import json
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand_roles import colors_of, theme_colors, ROLE_KEYS  # noqa: E402

root = Path(__file__).resolve().parents[1]

# --- Read the GDScript constants -------------------------------------------------
values = {}
source_gd = (root / 'ui/design_tokens.gd').read_text()
for name, expr in re.findall(r'^const (\w+) := ([^\n]+)', source_gd, re.M):
    expr = expr.strip()
    if color := re.fullmatch(r'Color\("([0-9a-fA-F]+)"\)', expr):
        values[name] = '#' + color[1].lower()
    elif re.fullmatch(r'-?\d+(\.\d+)?', expr):
        values[name] = float(expr) if '.' in expr else int(expr)
    elif expr in values:
        values[name] = values[expr]
    elif (m := re.fullmatch(r'-(\w+)', expr)) and m[1] in values:
        values[name] = -values[m[1]]
    elif (m := re.fullmatch(r'(\w+) - (\w+)', expr)) and all(k in values for k in m.groups()):
        values[name] = values[m[1]] - values[m[2]]


# --- Brands: each overrides the semantic colours and the faces ----------------------
BRANDABLE = [k for k, v in values.items() if isinstance(v, str) and v.startswith('#')]
brands = {}
for brand_file in sorted((root / 'brands').glob('*/brand.json')):
    brand = json.loads(brand_file.read_text())
    name = brand_file.parent.name
    try:
        brand['colors'] = colors_of(brand)
    except ValueError as error:
        raise SystemExit(f'brands/{name}/brand.json: {error}')
    missing = sorted(set(BRANDABLE) - set(brand['colors']))
    extra = sorted(set(brand['colors']) - set(BRANDABLE))
    if missing or extra:
        raise SystemExit(f'brands/{name}/brand.json: missing {missing} extra {extra}')
    for role in ('body', 'numbers'):
        face = brand['fonts'][role]
        # A brand's own faces live in assets/fonts/<brand>/; the faces every brand shares live in assets/fonts/.
        for folder in (name + '/', 'uploads/', ''):
            if (root / 'assets/fonts' / folder / face['file']).is_file():
                face['folder'] = 'assets/fonts/' + folder
                break
        else:
            raise SystemExit(f'brands/{name}: font {role} {face["file"]} is in none of assets/fonts/{name}/, assets/fonts/uploads/ or assets/fonts/')
    brands[name] = brand
if 'default' not in brands:
    raise SystemExit('brands/default/brand.json is required')
# --- Themes: seasonal overlays that belong to a brand (brands/<id>/themes/<theme>.json) ----
themes = {}
for name, brand in brands.items():
    themes[name] = {}
    for theme_file in sorted((root / 'brands' / name / 'themes').glob('*.json')):
        theme = json.loads(theme_file.read_text())
        try:
            theme['colors'] = theme_colors(brand, theme)
        except ValueError as error:
            raise SystemExit(f'brands/{name}/themes/{theme_file.name}: {error}')
        themes[name][theme_file.stem] = theme

# brands/default is the web's opening palette (Lotomobil); ui/design_tokens.gd stays the native one.


def css_name(key):
    return '--' + key.lower().replace('_', '-')


def px(value):
    return f'{value:g}px'


def alpha_hex(color, alpha):
    return color + f'{round(alpha * 255):02x}'


def shade(color, amount):
    """Lighten (amount > 0) or darken (amount < 0) a hex colour, as raised_button.gd does."""
    raw = color.lstrip('#')
    channels = [int(raw[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    result = [c + (1 - c) * amount if amount >= 0 else c * (1 + amount) for c in channels]
    return '#' + ''.join(f'{round(c * 255):02x}' for c in result)


def spoken(color, saturation=0.82, lightness=0.44):
    """
    The same hue, said out loud: a role colour chosen for text is usually pale, and a bar or
    a light needs it saturated and dark enough to read as itself. Mixing toward black only
    greys it, so this works in HSL and keeps the hue the brand chose.
    """
    import colorsys
    raw = color.lstrip('#')
    r, g, b = (int(raw[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, _, saturation_now = colorsys.rgb_to_hls(r, g, b)
    # A brand may choose a grey for a role; saying a grey out loud would invent a hue it never
    # asked for, so an almost colourless one is only taken down to the same weight.
    if saturation_now < 0.12:
        return shade(color, -(1 - lightness / max(colorsys.rgb_to_hls(r, g, b)[1], 0.001)) if colorsys.rgb_to_hls(r, g, b)[1] > lightness else 0)
    r, g, b = colorsys.hls_to_rgb(hue, lightness, max(saturation, saturation_now))
    return '#' + ''.join(f'{round(c * 255):02x}' for c in (r, g, b))


def contrast(one, other):
    """WCAG contrast between two opaque colours, for deciding whether one shows on the other."""
    def luminance(color):
        raw = color.lstrip('#')
        channels = [int(raw[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        channels = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    high, low = sorted((luminance(one), luminance(other)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def alarm_on(face, danger):
    """
    The colour the round's clock turns when the seconds run out, on a given button face.

    A brand is free to paint GO in the same red the danger role uses, and an alarm the
    colour of the button under it says nothing at all. The hue the brand chose for danger
    is kept; only its lightness moves, up or down, to whichever side reads better against
    that face. A face the spoken danger colour already separates from is left alone.
    """
    import colorsys
    said = spoken(danger)
    if contrast(said, face) >= 2.2:
        return said
    raw = said.lstrip('#')
    hue, lightness, saturation = colorsys.rgb_to_hls(*(int(raw[i:i + 2], 16) / 255 for i in (0, 2, 4)))
    best = said
    for direction in (1, -1):
        level = lightness
        for _ in range(12):
            level = min(0.94, max(0.08, level + direction * 0.06))
            candidate = '#' + ''.join(f'{round(c * 255):02x}' for c in colorsys.hls_to_rgb(hue, level, saturation))
            if contrast(candidate, face) > contrast(best, face):
                best = candidate
            if contrast(best, face) >= 2.2:
                return best
            if level in (0.94, 0.08):
                break
    return best


# --- Which constants become CSS custom properties ----------------------------------
PX_PREFIXES = ('SPACE_', 'RADIUS_', 'TYPE_', 'STROKE_', 'WEB_')
PX_KEYS = {'BODY_TYPE_PX', 'TAP_MIN', 'TAP_COMFORT', 'MODAL_MAX_WIDTH_PX', 'HUD_MAX_WIDTH_PX', 'WINS_CARD_WIDTH_PX'}
UNITLESS_PREFIXES = ('ALPHA_', 'LEADING_')
MS_PREFIXES = ('MOTION_',)
BREAKPOINT_KEYS = {
    'CRASH_MEDIUM_BREAKPOINT', 'CRASH_LAPTOP_BREAKPOINT', 'CRASH_DESKTOP_BREAKPOINT',
    'WEB_COMPACT_ACTION_BREAKPOINT', 'MODAL_PHONE_BREAKPOINT', 'WEB_SHORT_PHONE_MAX_HEIGHT', 'WEB_SHORT_VIEWPORT_MAX_HEIGHT',
}
MS_KEYS = {'WEB_WIN_COIN_DURATION_MS', 'WEB_WIN_COIN_STAGGER_MS'}
COUNT_KEYS = {'WEB_WIN_COIN_COUNT'}

lines = []
for key, value in values.items():
    if key in BREAKPOINT_KEYS:
        continue
    if key in MS_KEYS or key.startswith(MS_PREFIXES):
        lines.append(f'{css_name(key)}:{value:g}ms')
    elif key in COUNT_KEYS or key.startswith(UNITLESS_PREFIXES):
        lines.append(f'{css_name(key)}:{value:g}')
    elif key.startswith(PX_PREFIXES) or key in PX_KEYS:
        lines.append(f'{css_name(key)}:{px(value)}')
    # colours are emitted per brand by palette_lines()

def palette_lines(colors, partial=False, base=None):
    """Colour tokens plus everything derived from them, for one brand (or a theme's partial overlay)."""
    out = [f'{css_name(k)}:{v}' for k, v in colors.items()]
    # A theme overlays part of a brand, so anything derived from two roles at once has to be
    # able to see the half the overlay left alone.
    look = lambda key: colors.get(key, (base or {}).get(key))
    # SURFACE_RAISED and GOLD join the button faces: the header's controls and the level pill
    # are pressed like buttons, so they need the same ramp. `side` is the wall under a button:
    # dark enough to read as a shadow, light enough to stay visible where a true shadow would
    # land on a panel of almost its own colour.
    # A colour that has to carry across a lit button needs its hue said out loud, not the
    # tone the same role uses for a line of text or a face in a gradient.
    for token in ('DANGER', 'ACTION_CASH', 'ACTION_GO', 'GOLD'):
        if partial and token not in colors:
            continue
        out.append(f'{css_name(token)}-strong:{spoken(colors[token])}')
    for token in ('BUTTON', 'ACTION_GO', 'ACTION_CASH', 'SURFACE_RAISED', 'GOLD', 'DANGER'):
        if partial and token not in colors:
            continue
        face = colors[token]
        raw = face.lstrip('#')
        channels = [int(raw[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        vivid = (channels[0] > 0.8 and channels[1] > 0.5) or channels[1] > 0.7
        for suffix, amount in (('top', 0.20 if vivid else 0.08), ('bottom', -0.14 if vivid else -0.09), ('edge', 0.45), ('shadow', -0.55), ('side', -0.32)):
            out.append(f'{css_name(token)}-{suffix}:{shade(face, amount)}')

    # The clock inside an action button turns to the danger colour as it runs out, and the
    # button it sits on is the brand's to choose - a red GO would swallow a red alarm.
    for token in ('ACTION_GO', 'ACTION_CASH'):
        face, danger = look(token), look('DANGER')
        if not face or not danger or (partial and token not in colors and 'DANGER' not in colors):
            continue
        out.append(f'{css_name(token)}-urgent:{alarm_on(face, danger)}')

    # Overlays: translucent inks composed from a surface colour and the alpha scale.
    overlays = {
        'shadow-soft': ('SHADOW', 'ALPHA_SOFT'),
        'shadow-medium': ('SHADOW', 'ALPHA_MEDIUM'),
        'shadow-strong': ('SHADOW', 'ALPHA_STRONG'),
        'scrim': ('SHADOW', 'ALPHA_SCRIM'),
        'surface-scrim': ('SURFACE', 'ALPHA_SCRIM'),
        'gloss-ink': ('GLOSS', 'ALPHA_STRONG'),
        'surface-hover-soft': ('SURFACE_HOVER', 'ALPHA_SOFT'),
        'surface-hover-medium': ('SURFACE_HOVER', 'ALPHA_MEDIUM'),
    }
    for name, (color, alpha) in overlays.items():
        if partial and color not in colors:
            continue
        out.append(f'--{name}:{alpha_hex(colors[color], values[alpha])}')

    if partial:
        return out
    # Elevation: one shadow per surface class.
    for name in ('panel', 'sheet', 'modal'):
        y = values[f'WEB_ELEVATION_{name.upper()}_Y']
        blur = values[f'WEB_ELEVATION_{name.upper()}_BLUR']
        out.append(f'--elevation-{name}:0 {px(y)} {px(blur)} var(--shadow-medium)')
        out.append(f'--elevation-{name}-up:0 {px(-y)} {px(blur)} var(--shadow-medium)')

    return out


def font_lines(name, brand):
    family = lambda role: 'Crash' + role.capitalize() + ('' if name == 'default' else '-' + name)
    faces = ''.join(f"@font-face{{font-family:{family(role)};src:url('{face['folder']}{face['file']}');font-weight:{face['weight']};font-style:{face.get('style', 'normal')}}}\n" for role, face in brand['fonts'].items())
    tokens = [f'--font-{role}:{family(role)}' for role in brand['fonts']]
    return faces, tokens


faces, font_tokens = font_lines('default', brands['default'])
css = '/* Generated by web/generate_tokens.py; edit ui/design_tokens.gd and brands/. */\n' + faces
css += ':root{\n' + ';\n'.join(lines + font_tokens + palette_lines(brands['default']['colors'])) + ';\n}\n'
for name, brand in brands.items():
    if name == 'default':
        continue
    brand_faces, brand_font_tokens = font_lines(name, brand)
    css += f'/* {brand["title"]} */\n' + brand_faces
    css += f':root[data-brand="{name}"]{{\n' + ';\n'.join(brand_font_tokens + palette_lines(brand['colors'])) + ';\n}\n'
for brand_name, brand_themes in themes.items():
    scope = ':root:not([data-brand])' if brand_name == 'default' else f':root[data-brand="{brand_name}"]'
    for theme_name, theme in brand_themes.items():
        if not theme['colors']:
            continue
        css += f'/* {brands[brand_name]["title"]} · {theme["title"]} */\n{scope}[data-theme="{theme_name}"]{{\n' + ';\n'.join(palette_lines(theme['colors'], partial=True, base=brands[brand_name]['colors'])) + ';\n}\n'
values['BRANDS'] = {name: brand['title'] for name, brand in brands.items()}
values['ROLE_KEYS'] = ROLE_KEYS
values['THEMES'] = {brand_name: {t: theme['title'] for t, theme in brand_themes.items()} for brand_name, brand_themes in themes.items()}
values['BRAND_SWATCHES'] = {name: (brand.get('roles') or {}).get('primary', brand['colors']['ACTION_GO']) for name, brand in brands.items()}
values['THEME_SWATCHES'] = {brand_name: {t: (theme.get('roles') or {}).get('primary', brands[brand_name]['roles']['primary']) for t, theme in brand_themes.items()} for brand_name, brand_themes in themes.items()}

# --- Resolve breakpoint placeholders in the hand-written stylesheet -----------------
ui = (root / 'web/ui.source.css').read_text()
for key in BREAKPOINT_KEYS:
    ui = ui.replace(f'__{key}__', f'{values[key]:g}')
ui = ui.replace('__PHONE_MAX__', f'{values["MODAL_PHONE_BREAKPOINT"] - 1:g}')
if unresolved := re.findall(r'__[A-Z_]+__', ui):
    raise SystemExit(f'Unknown placeholders in ui.source.css: {sorted(set(unresolved))}')

outputs = {
    'tokens.css': css,
    'ui.css': ui,
    'tokens.js': 'window.CrashTokens=' + json.dumps(values) + ';\n',
}
for name, content in outputs.items():
    path = root / 'web' / name
    if '--check' in sys.argv:
        if not path.exists() or path.read_text() != content:
            raise SystemExit(f'Regenerate {name}: python3 web/generate_tokens.py')
    else:
        path.write_text(content)
print('WEB TOKENS: PASS')
