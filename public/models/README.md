# Kenney City Kit Models

Place .glb building files here. The game loads them at startup and falls back to
primitive box meshes for any file that is missing.

## Where to download

Both packs are CC0 (public domain):

- **City Kit (Commercial):** https://kenney.nl/assets/city-kit-commercial
- **City Kit (Suburban):**   https://kenney.nl/assets/city-kit-suburban

## Required filenames

After downloading, extract the zip and rename/copy the .glb files to match:

| Filename               | Used for                        |
|------------------------|---------------------------------|
| building-small-a.glb   | Mei's Apartment                 |
| building-small-b.glb   | Luna's Townhouse                |
| building-tall-a.glb    | Sora's Building                 |
| building-tall-b.glb    | Quinn's Apartment               |
| skyscraper-a.glb       | Twin Tower (Dante's lobby)      |
| shop-a.glb             | Kit's Supply Shop               |
| shop-b.glb             | Nao's Café                      |
| shop-c.glb             | Yuna's Flower Shop              |
| restaurant-a.glb       | Marco's Restaurant              |
| office-a.glb           | Harper's News Office            |
| office-b.glb           | Kenji's Office                  |
| office-c.glb           | The School                      |
| house-a.glb            | Tomas's Cottage                 |
| cabin-a.glb            | Kai's Dock Shack                |
| warehouse-a.glb        | Taro's Factory                  |
| warehouse-b.glb        | Workshop Property               |
| warehouse-c.glb        | Gus's Dock Office               |
| warehouse-d.glb        | Shipping Yard                   |

## Notes

- Models are automatically desaturated to gray on load (matching the game's color system).
- Color is restored gradually as district/NPC relationship levels rise.
- Any missing file is silently skipped — the primitive box stays visible.
