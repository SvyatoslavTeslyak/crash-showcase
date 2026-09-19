# Crash Showcase

The browser builds of the crash games on PixiJS, behind the Composer's Layout controls:
pick a game, size the viewport, show or hide the panels a player sees. View only — there
is no sign-in, Math Lab or Sound Studio here; that work stays in the local Composer.

Live at https://svyatoslavteslyak.github.io/crash-showcase/ (add `#game=fuel` to open on a game).

`main` holds only the workflow. The site itself is on `gh-pages`, written by
`.github/workflows/build.yml`: it checks out the five `*-pixi` repositories and the shared
kit, builds each port (`npm run build`, which also converts the art and audio for the
browser), assembles the site with `crash-ui-kit/tools/showcase.py` and force-pushes it.
It runs nightly, on demand from the Actions tab, and on a `port-updated` dispatch.

The same can be done from a machine that has the repositories side by side:

```sh
python3 crash-ui-kit/tools/showcase.py --deploy
```
