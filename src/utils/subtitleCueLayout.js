export function resolveSecondaryCueOffset(primaryRects = [], secondaryRects = []) {
  const normalizedPrimaryRects = normalizeRects(primaryRects);
  const normalizedSecondaryRects = normalizeRects(secondaryRects);

  if (normalizedPrimaryRects.length === 0 || normalizedSecondaryRects.length === 0) {
    return 0;
  }

  const primaryTop = normalizedPrimaryRects.reduce(
    (lowestTop, rect) => Math.min(lowestTop, rect.top),
    Number.POSITIVE_INFINITY
  );
  const secondaryBottom = normalizedSecondaryRects.reduce(
    (highestBottom, rect) => Math.max(highestBottom, rect.bottom),
    Number.NEGATIVE_INFINITY
  );
  const gap = primaryTop - secondaryBottom;

  return Number.isFinite(gap) && gap > 0 ? gap : 0;
}

function normalizeRects(rects) {
  if (!Array.isArray(rects)) {
    return [];
  }

  return rects.filter((rect) => Number.isFinite(rect?.top) && Number.isFinite(rect?.bottom));
}
