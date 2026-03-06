/**
 * Shared utility functions for archaea_vis
 */

/**
 * Parse pagination params from URL search params.
 * Returns validated limit and offset.
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { limit: number; maxLimit: number } = { limit: 50, maxLimit: 500 }
): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get('limit') || String(defaults.limit))),
    defaults.maxLimit
  );
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
  return { limit, offset };
}

/**
 * Parse and validate a sort parameter against allowed columns.
 */
export function parseSort(
  searchParams: URLSearchParams,
  allowedColumns: string[],
  defaultSort: string = 'protein_id',
  defaultOrder: 'ASC' | 'DESC' = 'ASC'
): { sortColumn: string; sortOrder: 'ASC' | 'DESC' } {
  const sort = searchParams.get('sort') || defaultSort;
  const order = (searchParams.get('order') || defaultOrder).toUpperCase();

  const sortColumn = allowedColumns.includes(sort) ? sort : defaultSort;
  const sortOrder = order === 'DESC' ? 'DESC' : 'ASC';

  return { sortColumn, sortOrder };
}

/**
 * Format a number with locale-appropriate separators.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Determine the provenance label for a protein based on its source and cif_file path.
 */
export function getProvenanceLabel(source: string, cifFile: string | null): string {
  if (!cifFile) return source;

  if (cifFile.includes('dpam_afdb_batched')) return 'AFDB v6 (HGD)';
  if (cifFile.includes('dpam_tier1_batched')) return 'AF3 Tier 1';
  if (cifFile.includes('dpam_tier2_batched')) return 'AF3 Tier 2';
  if (cifFile.includes('dpam_tier3_batched')) return 'AF3 Tier 3';
  if (cifFile.includes('dpam_gap_batched')) return 'AF3 Gap';
  if (cifFile.includes('af3_tier1')) return 'AF3 Tier 1';
  if (source === 'AFDB') return 'AFDB v6';
  return source;
}

/**
 * Determine color class for a novelty category.
 */
export function noveltyColor(category: string): string {
  switch (category) {
    case 'dark': return 'bg-red-100 text-red-800';
    case 'sequence-orphan': return 'bg-orange-100 text-orange-800';
    case 'divergent': return 'bg-yellow-100 text-yellow-800';
    case 'known': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Determine color class for a curation status.
 */
export function statusColor(status: string): string {
  switch (status) {
    case 'pending': return 'bg-gray-100 text-gray-800';
    case 'in_review': return 'bg-blue-100 text-blue-800';
    case 'classified': return 'bg-green-100 text-green-800';
    case 'deferred': return 'bg-yellow-100 text-yellow-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'needs_reanalysis': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Determine color class for a quality category.
 */
export function qualityColor(category: string | null): string {
  switch (category) {
    case 'high_quality': return 'bg-green-100 text-green-800';
    case 'medium_quality': return 'bg-yellow-100 text-yellow-800';
    case 'low_quality': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Determine color for a judge category badge.
 */
export function judgeColor(judge: string | null): string {
  switch (judge) {
    case 'good_domain': return 'bg-green-100 text-green-800';
    case 'low_confidence': return 'bg-yellow-100 text-yellow-800';
    case 'partial_domain': return 'bg-orange-100 text-orange-800';
    case 'simple_topology': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Determine color for an LDDT classification tier badge.
 */
export function lddtClassColor(cls: string | null): string {
  switch (cls) {
    case 'NOVEL': return 'bg-purple-100 text-purple-800';
    case 'WEAK_SIMILARITY': return 'bg-orange-100 text-orange-800';
    case 'MODERATE_SIMILARITY': return 'bg-yellow-100 text-yellow-800';
    case 'ECOD_ASSIGNABLE': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Short display label for LDDT classification.
 */
export function lddtClassLabel(cls: string | null): string {
  switch (cls) {
    case 'NOVEL': return 'Novel';
    case 'WEAK_SIMILARITY': return 'Weak';
    case 'MODERATE_SIMILARITY': return 'Moderate';
    case 'ECOD_ASSIGNABLE': return 'Strong';
    default: return '-';
  }
}

/**
 * Determine color class for a dark matter classification badge.
 */
export function darkMatterClassColor(cls: string | null): string {
  switch (cls) {
    case 'GENUINE_DARK': return 'bg-red-100 text-red-800';
    case 'DARK_WITH_PFAM': return 'bg-orange-100 text-orange-800';
    case 'TOO_SHORT': return 'bg-gray-100 text-gray-500';
    case 'LOW_CONFIDENCE_STRUCTURE': return 'bg-gray-100 text-gray-500';
    case 'SUB_THRESHOLD': return 'bg-yellow-100 text-yellow-800';
    case 'RESCUE': return 'bg-green-100 text-green-800';
    case 'CLASSIFIED': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Short display label for dark matter classification.
 */
export function darkMatterClassLabel(cls: string | null): string {
  switch (cls) {
    case 'GENUINE_DARK': return 'Genuine Dark';
    case 'DARK_WITH_PFAM': return 'DUF/Pfam';
    case 'TOO_SHORT': return 'Too Short';
    case 'LOW_CONFIDENCE_STRUCTURE': return 'Low Quality';
    case 'SUB_THRESHOLD': return 'Sub-threshold';
    case 'RESCUE': return 'Rescue';
    case 'CLASSIFIED': return 'Classified';
    default: return '-';
  }
}

/**
 * DALI Z-score confidence tier label.
 */
export function daliZscoreLabel(z: number | null): string {
  if (z == null) return 'Not Searched';
  if (z >= 8) return 'Known Fold';
  if (z >= 4) return 'Partial Match';
  if (z >= 2) return 'Weak Match';
  return 'No Hits';
}

/**
 * DALI Z-score confidence tier color.
 */
export function daliZscoreColor(z: number | null): string {
  if (z == null) return 'bg-gray-100 text-gray-500';
  if (z >= 8) return 'bg-blue-100 text-blue-800';
  if (z >= 4) return 'bg-yellow-100 text-yellow-800';
  if (z >= 2) return 'bg-orange-100 text-orange-800';
  return 'bg-indigo-100 text-indigo-800';
}

/**
 * DALI filter category from Z-score.
 */
export function daliZscoreCategory(z: number | null): string {
  if (z == null) return 'not_searched';
  if (z >= 8) return 'strong';
  if (z >= 4) return 'moderate';
  if (z >= 2) return 'weak';
  return 'no_hits';
}
