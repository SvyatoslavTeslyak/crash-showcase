# SpriteCook art — first integration

Imported existing owned assets on 2026-09-13. No new generation.

- Goat idle: f7f1503d-f5ab-4a2a-b86b-6d1df63e3377 (8 frames)
- Goat jump: e4d9307d-117a-453f-af5f-c18404eb588e (8 frames)
- Goat flatten: 272354f8-d3d0-43d2-9110-234fb6b7a82f (16 frames)
- Tap-Tap cutout: 96d8916d-697f-521b-93af-68da379fd8cc

Animated WebP frames decoded to transparent PNG, downsampled to a maximum of
256 px with shared original frame canvases. SpriteFrames contains explicit
idle/jump/hit timing. Jump matches the 0.22 second lane movement; hit completes
in 0.06 seconds, then holds until the existing round reset. Vehicle rendering
uses the existing data.size and direction so collision geometry is unchanged.

The other vehicle types and road still use prototype artwork. The preview in
docs/previews/first-art-pass.png stages two Tap-Taps to show both directions;
normal gameplay retains the original mixed traffic spawning.

## Batch 02 — 2026-09-13

Generated and integrated taxi, pickup, motorcycle, barrier, asphalt and sidewalk
through SpriteCook using the Tap-Tap as style reference. Full prompts and source
and cutout asset IDs are recorded in generation-batch-02.json. Cost: 54 generation
credits plus 4 background-removal credits. Images were alpha-trimmed and resized
for runtime (sprites at most 640 px, road textures 512 px). Goat visual scale
increased from 0.48 to 0.56 (+16.7%); gameplay collision dimensions unchanged.

Barrier fades/drops into position on the incoming traffic side. Road textures
repeat beneath existing lane marks, arrows and multiplier labels. Start/safe
previews in docs/previews/art-batch2-*.png stage representative traffic without
changing normal gameplay spawn weights. Smoke and low-FPS collision tests pass.

## Batch 03 — Haitian dirt road

Generated two environment textures through SpriteCook (18 credits). Full prompts
and asset IDs: generation-batch-03.json. Dirt includes potholes, ruts and gravel;
sidewalk includes palm foliage, Haitian flags, fruit crates, umbrella and drains.
These are decorative surface art, not additional collision obstacles. Dirt spans
two adjacent lane widths at consistent scale. Existing lane guides remain faded.
Vehicles increased approximately 40% in both dimensions through VehicleData.size,
which also controls their collision and safe stopping geometry. Smoke, safe-wait
(all four types/both directions), and low-FPS collision tests passed with new sizes.
Inspected start and safe-step GUI screenshots in docs/previews/haitian-road-*.png.
