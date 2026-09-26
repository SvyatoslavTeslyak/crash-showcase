"""Brand roles: a dozen colours a brand is described with, and how every kit token derives
from them. A brand.json carries `roles` (and optional `overrides` for single tokens); the
generator turns them into the full colour set. Composer's look.js mirrors derive() for the
live preview, so a change here needs the same change there.
"""

ROLES = [
    ('surface', 'Surface', 'panels, controls and the cards on them'),
    ('onSurface', 'On surface', 'text and icons on surfaces'),
    ('primary', 'Primary', 'the play action, amounts and records'),
    ('onPrimary', 'On primary', 'text on the primary colour'),
    ('secondary', 'Secondary', 'the other controls: MIN, MAX, presets, difficulty and the Auto track'),
    ('onSecondary', 'On secondary', 'text on those controls'),
    ('tertiary', 'Tertiary', 'a second accent, used sparingly'),
    ('success', 'Success', 'the cash-out action, wins and switches that are on'),
    ('onSuccess', 'On success', 'text on success'),
    ('danger', 'Danger', 'errors and losses'),
    ('warning', 'Warning', 'cautions'),
    ('info', 'Info', 'multiplier, history pills and the focus ring'),
]
ROLE_KEYS = [r[0] for r in ROLES]

# What each derived token is for, in the player's terms: the Library lists them with this,
# and it is the only place that explains a token nobody sets by hand.
DERIVED = {
    'SURFACE': 'the panels themselves',
    'SURFACE_RAISED': 'modals, menus and the history pills that sit above a panel',
    'SURFACE_INSET': 'the record card and the stake field, sunk into a panel',
    'SURFACE_PRESSED': 'a surface while it is held down',
    'SURFACE_HOVER': 'a surface under the pointer',
    'BORDER': 'the outline around panels and cards',
    'BUTTON': 'MIN, MAX, the presets and the difficulty control',
    'ON_BUTTON': 'the labels on those buttons',
    'BUTTON_DISABLED': 'a control that cannot be used, still visible against the panel',
    'DISABLED': 'the label on a disabled control',
    'TEXT': 'ordinary text',
    'TEXT_MUTED': 'captions, hints and secondary lines',
    'KNOB': 'the knob of a switch that is off',
    'ACTION_GO': 'the PLAY button',
    'ON_GO': 'the PLAY label',
    'GOLD': 'amounts and records in the account card',
    'GLOSS': 'the sheen along the top of the play button',
    'ACTION_CASH': 'the CASH OUT button',
    'ON_CASH': 'the CASH OUT label',
    'CASH_SHADOW': 'the depth under the CASH OUT button',
    'SUCCESS': 'wins and anything that went right',
    'SWITCH_ON': 'the Auto track when it is on',
    'ON_SUCCESS': 'the label on a success colour',
    'DANGER': 'errors, losses and a bet that cannot be placed',
    'AVATAR_CORAL': 'one of the player avatar tints',
    'WARNING': 'cautions, such as a limit being reached',
    'FOCUS': 'the ring around whatever the keyboard is on',
    'CYAN': 'the live multiplier under 2x',
    'PURPLE': 'the second accent, used sparingly',
    'PILL_CYAN': 'a round in the history under 2x',
    'PILL_SUCCESS': 'a round in the history from 2x',
    'PILL_PURPLE': 'a round in the history from 5x',
    'PILL_GOLD': 'a round in the history from 10x',
    'SWITCH_OFF': 'the Auto track when it is off',
    'SWITCH_BORDER': 'the outline of a switch',
    'SHADOW': 'what every shadow and scrim is mixed from',
    'HIGHLIGHT': 'what every gloss and highlight is mixed from',
}


def _rgb(hex_):
    raw = hex_.lstrip('#')
    return [int(raw[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def _hex(rgb):
    return '#' + ''.join(f'{round(max(0, min(1, c)) * 255):02x}' for c in rgb)


import colorsys


def lighten(hex_, amount):
    """Raise lightness in HSL, keeping hue and saturation, so a navy surface stays navy."""
    h, l, s = colorsys.rgb_to_hls(*_rgb(hex_))
    # Lighter tints of a dark surface read less saturated, as a designer would pick them.
    return _hex(colorsys.hls_to_rgb(h, min(1, l + amount), max(0, s - amount * 1.35)))


def darken(hex_, amount):
    h, l, s = colorsys.rgb_to_hls(*_rgb(hex_))
    return _hex(colorsys.hls_to_rgb(h, max(0, l - amount), s))


def mix(a, b, weight):
    """weight of a over b."""
    ra, rb = _rgb(a), _rgb(b)
    return _hex([x * weight + y * (1 - weight) for x, y in zip(ra, rb)])


def _lum(hex_):
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = [f(c) for c in _rgb(hex_)]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def readable(hex_, surface, minimum):
    """Lighten (on a dark surface) or darken the colour in HSL until it reads at the ratio."""
    h, l, s = colorsys.rgb_to_hls(*_rgb(hex_))
    up = _lum(surface) < 0.5
    for _ in range(40):
        if contrast(_hex(colorsys.hls_to_rgb(h, l, s)), surface) >= minimum:
            break
        l = min(1, l + 0.02) if up else max(0, l - 0.02)
    return _hex(colorsys.hls_to_rgb(h, l, s))


def derive(roles):
    r = roles
    # A disabled control still has to read as a control: its face keeps a little separation
    # from the panel, and its ink keeps enough of that face to be legible.
    button_disabled = readable(mix(r['secondary'], r['surface'], 0.7), r['surface'], 1.5)
    disabled_ink = readable(mix(r['onSurface'], r['surface'], 0.45), button_disabled, 3)
    return {
        'SURFACE': r['surface'],
        'SURFACE_RAISED': lighten(r['surface'], 0.09),
        'SURFACE_INSET': lighten(r['surface'], 0.04),
        'SURFACE_PRESSED': darken(r['surface'], 0.02),
        'SURFACE_HOVER': lighten(r['surface'], 0.14),
        'BORDER': lighten(r['surface'], 0.19),
        'BUTTON': r['secondary'],
        'ON_BUTTON': r['onSecondary'],
        'BUTTON_DISABLED': button_disabled,
        'DISABLED': disabled_ink,
        'TEXT': r['onSurface'],
        'TEXT_MUTED': mix(r['onSurface'], r['surface'], 0.70),
        'KNOB': lighten(r['onSurface'], 0.30),
        'ACTION_GO': r['primary'],
        'ON_GO': r['onPrimary'],
        # Amounts are text on the inset card: a tint of the primary that reads there, while the button keeps the exact primary.
        'GOLD': readable(r['primary'], lighten(r['surface'], 0.04), 4.5),
        'GLOSS': lighten(r['primary'], 0.40),
        'ACTION_CASH': r['success'],
        'ON_CASH': r['onSuccess'],
        'CASH_SHADOW': darken(r['success'], 0.28),
        'SUCCESS': r['success'],
        'SWITCH_ON': r['success'],
        'ON_SUCCESS': r['onSuccess'],
        'DANGER': r['danger'],
        'AVATAR_CORAL': r['danger'],
        'WARNING': r['warning'],
        'FOCUS': r['info'],
        'CYAN': r['info'],
        'PURPLE': r['tertiary'],
        # A round in the history is coloured by the multiplier it reached. The pills sit on the
        # raised surface, lighter than the panel, so each tier is lifted to read exactly there.
        'PILL_CYAN': readable(r['info'], lighten(r['surface'], 0.09), 4.5),
        'PILL_SUCCESS': readable(r['success'], lighten(r['surface'], 0.09), 4.5),
        'PILL_PURPLE': readable(r['tertiary'], lighten(r['surface'], 0.09), 4.5),
        'PILL_GOLD': readable(r['primary'], lighten(r['surface'], 0.09), 4.5),
        'SWITCH_OFF': lighten(r['secondary'], 0.06),
        'SWITCH_BORDER': lighten(r['secondary'], 0.18),
        'SHADOW': '#000000',
        'HIGHLIGHT': '#ffffff',
    }


def with_defaults(roles):
    """Roles a brand may leave out take their Material default: secondary is a tint of the surface."""
    roles = dict(roles)
    roles.setdefault('secondary', lighten(roles['surface'], 0.09))
    roles.setdefault('onSecondary', roles['onSurface'])
    return roles


def colors_of(brand):
    """The full colour set of a brand: derived from its roles, then single overrides."""
    if 'roles' not in brand:
        return dict(brand['colors'])
    brand['roles'] = with_defaults(brand['roles'])
    missing = [k for k in ROLE_KEYS if k not in brand['roles']]
    if missing:
        raise ValueError('roles missing: ' + ', '.join(missing))
    colors = derive(brand['roles'])
    colors.update(brand.get('overrides') or {})
    return colors


def theme_colors(brand, theme):
    """A theme is partial roles (and optional overrides) over its brand; only what differs is emitted."""
    unknown = [k for k in theme.get('roles', {}) if k not in ROLE_KEYS]
    if unknown:
        raise ValueError('theme roles unknown: ' + ', '.join(unknown))
    roles = with_defaults(brand['roles'])
    roles.update(theme.get('roles') or {})
    colors = derive(roles)
    colors.update(brand.get('overrides') or {})
    colors.update(theme.get('overrides') or {})
    base = colors_of(brand)
    return {k: v for k, v in colors.items() if base.get(k) != v}
