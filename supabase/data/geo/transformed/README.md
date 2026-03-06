# GeoJSON Transformations

This directory contains simplified/smoothed versions of the original `countries.geojson` for testing different map rendering quality levels.

## Naming Convention

Transformation files follow this pattern:

```
{algorithm}_{percentage}[_{flags}].geojson
```

### Examples:

- `dp_5pct.geojson` - Douglas-Peucker at 5% tolerance
- `dp_5pct_keepshapes.geojson` - Douglas-Peucker at 5% with shape preservation
- `visvalingam_8pct_keepshapes_clean.geojson` - Visvalingam at 8% with shape preservation and cleaning
- `visvalingam-weighted_8pct_keepshapes_clean.geojson` - Weighted Visvalingam at 8% with flags

## Common Algorithms

- **dp** - Douglas-Peucker (fast, angular simplification)
- **visvalingam** - Visvalingam (preserves shape better, removes less significant points)
- **visvalingam-weighted** - Weighted Visvalingam (considers area and distance)

## Common Flags

- **keepshapes** - Prevent small polygons from disappearing
- **clean** - Remove invalid or duplicate points
- **planar** - Use planar (Euclidean) calculations instead of spherical

## Adding New Transformations

1. Generate your transformed GeoJSON and place it in this directory following the naming convention
2. Open `src/app/pages/world-map/world-map.component.ts`
3. Find the `loadAvailableTransforms()` method
4. Add your transformation name (without `.geojson` extension) to the `transforms` array:

```typescript
private async loadAvailableTransforms(): Promise<void> {
  const transforms = [
    'original',
    'dp_5pct',
    'dp_5pct_keepshapes',
    'visvalingam_8pct_keepshapes_clean',
    // Add your new transformation here
  ];
  this.availableTransforms.set(transforms);
}
```

5. Build and view in the map preview to compare results

## File Size Considerations

The original `countries.geojson` is ~14 MB. Aim for transformations that reduce this to a manageable size while preserving acceptable visual quality for your use case.
