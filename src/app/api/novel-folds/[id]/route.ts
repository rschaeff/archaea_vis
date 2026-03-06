/**
 * GET /api/novel-folds/:id
 *
 * Returns full detail for a novel fold cluster.
 * Tier 1 (T1_CXXXX): Dark proteins — queries novel_fold_clusters/edges
 * Tier 2 (T2_CXXXX): Orphan domains — queries novel_domain_clusters/edges
 * Both tiers include cross-tier hits when available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clusterId } = await params;

    if (!clusterId || !/^T[12]_C\d+$/.test(clusterId)) {
      return NextResponse.json(
        { error: 'Invalid cluster ID format. Expected T1_CXXXX or T2_CXXXX.' },
        { status: 400 }
      );
    }

    const tier = clusterId.startsWith('T1_') ? 1 : 2;

    if (tier === 1) {
      return handleTier1(clusterId);
    } else {
      return handleTier2(clusterId);
    }
  } catch (error) {
    console.error('Novel fold detail API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cluster details',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function handleTier1(clusterId: string) {
  const [clusterResult, membersResult, edgesResult, phylumResult, crossTierResult, darkMatterResult, ssResult, daliResult] =
    await Promise.all([
      // Cluster summary from view
      query(`
        SELECT * FROM archaea.v_novel_fold_cluster_summary
        WHERE cluster_id = $1
      `, [clusterId]),

      // Members
      query(`
        SELECT
          c.protein_id,
          c.db_protein_id,
          c.mean_plddt,
          c.seq_length,
          c.phylum,
          c.major_group,
          c.organism,
          c.genome_accession
        FROM archaea.novel_fold_clusters c
        WHERE c.cluster_id = $1
        ORDER BY c.mean_plddt DESC
      `, [clusterId]),

      // Foldseek edges within cluster
      query(`
        SELECT
          e.query_protein_id AS query,
          e.target_protein_id AS target,
          e.fident,
          e.alnlen,
          e.evalue,
          e.bits,
          e.lddt,
          e.prob
        FROM archaea.novel_fold_edges e
        WHERE e.query_protein_id IN (
          SELECT protein_id FROM archaea.novel_fold_clusters WHERE cluster_id = $1
        )
        AND e.target_protein_id IN (
          SELECT protein_id FROM archaea.novel_fold_clusters WHERE cluster_id = $1
        )
        ORDER BY e.evalue ASC
      `, [clusterId]),

      // Phylum distribution
      query<{ phylum: string; count: string }>(`
        SELECT phylum, COUNT(*) AS count
        FROM archaea.novel_fold_clusters
        WHERE cluster_id = $1
        GROUP BY phylum
        ORDER BY count DESC
      `, [clusterId]),

      // Cross-tier hits: find Tier 2 domains structurally similar to this cluster's proteins
      query(`
        SELECT
          ct.tier1_protein_id,
          ct.tier2_protein_id,
          ct.tier2_domain_num,
          ndc.cluster_id AS tier2_cluster_id,
          ndc.cluster_size AS tier2_cluster_size,
          ct.fident,
          ct.alnlen,
          ct.evalue,
          ct.alntmscore
        FROM archaea.novel_cross_tier_hits ct
        JOIN archaea.novel_domain_clusters ndc
          ON ct.tier2_protein_id = ndc.protein_id
          AND ct.tier2_domain_num = ndc.domain_num
        WHERE ct.tier1_protein_id IN (
          SELECT protein_id FROM archaea.novel_fold_clusters WHERE cluster_id = $1
        )
        ORDER BY ct.alntmscore DESC
      `, [clusterId]),

      // Dark matter class: map T1 cluster → member PXC → most novel class
      query<{ dark_matter_class: string }>(`
        SELECT
          CASE MIN(CASE dm.dark_matter_class
            WHEN 'GENUINE_DARK' THEN 1
            WHEN 'TOO_SHORT' THEN 2
            WHEN 'LOW_CONFIDENCE_STRUCTURE' THEN 3
            WHEN 'SUB_THRESHOLD' THEN 4
            WHEN 'RESCUE' THEN 5
            WHEN 'CLASSIFIED' THEN 6
            ELSE 1
          END)
            WHEN 1 THEN 'GENUINE_DARK'
            WHEN 2 THEN 'TOO_SHORT'
            WHEN 3 THEN 'LOW_CONFIDENCE_STRUCTURE'
            WHEN 4 THEN 'SUB_THRESHOLD'
            WHEN 5 THEN 'RESCUE'
            WHEN 6 THEN 'CLASSIFIED'
          END AS dark_matter_class
        FROM archaea.novel_fold_clusters nfc
        LEFT JOIN archaea.protein_struct_clusters psc ON psc.protein_id = nfc.protein_id
        LEFT JOIN archaea.v_pxc_dark_matter_class dm ON dm.cluster_id = psc.cluster_id
        WHERE nfc.cluster_id = $1
      `, [clusterId]),

      // Secondary structure: is this cluster a single extended helix?
      // Uses helix_fraction >= 0.70 AND extended Rg to distinguish single helices from helix bundles
      query<{ all_helix: boolean; max_helix_fraction: string }>(`
        SELECT
          BOOL_AND(sqm.helix_fraction >= 0.70 AND sqm.rg_category = 'extended') AS all_helix,
          MAX(sqm.helix_fraction) AS max_helix_fraction
        FROM archaea.novel_fold_clusters nfc
        JOIN archaea.structure_quality_metrics sqm ON sqm.protein_id = nfc.db_protein_id
        WHERE nfc.cluster_id = $1
      `, [clusterId]),

      // DALI search results via dali_job_mapping, with ECOD classification for domain hits
      query(`
        SELECT
          djm.library_type,
          djm.protein_id AS query_protein_id,
          j.status AS job_status,
          j.id AS job_id,
          r.hit_cd2,
          r.zscore,
          r.rmsd,
          r.nblock,
          r.round,
          ds.h_group_id AS ecod_h_group,
          c.name AS ecod_x_group_name
        FROM archaea.dali_job_mapping djm
        JOIN rustdali.jobs j ON j.id = djm.dali_job_id
        LEFT JOIN rustdali.results r ON r.job_id = j.id
        LEFT JOIN ecod_commons.domain_summary ds ON ds.domain_id = r.hit_cd2
        LEFT JOIN ecod_rep.cluster c ON c.id = SPLIT_PART(ds.h_group_id, '.', 1)
        WHERE djm.cluster_id = $1
        ORDER BY r.zscore DESC NULLS LAST
      `, [clusterId]),
    ]);

  if (clusterResult.rows.length === 0) {
    return NextResponse.json(
      { error: 'Cluster not found' },
      { status: 404 }
    );
  }

  const cluster = clusterResult.rows[0];
  const dmClass = darkMatterResult.rows[0]?.dark_matter_class || null;
  const allHelix = ssResult.rows[0]?.all_helix ?? false;

  return NextResponse.json({
    tier: 1,
    cluster: {
      ...cluster,
      avg_plddt: cluster.avg_plddt ? parseFloat(String(cluster.avg_plddt)) : null,
      min_plddt: cluster.min_plddt ? parseFloat(String(cluster.min_plddt)) : null,
      max_plddt: cluster.max_plddt ? parseFloat(String(cluster.max_plddt)) : null,
      dark_matter_class: dmClass,
      all_helix: allHelix,
    },
    members: membersResult.rows.map(m => ({
      ...m,
      mean_plddt: m.mean_plddt ? parseFloat(String(m.mean_plddt)) : null,
    })),
    edges: edgesResult.rows.map(e => ({
      ...e,
      fident: e.fident ? parseFloat(String(e.fident)) : null,
      evalue: e.evalue ? parseFloat(String(e.evalue)) : null,
      lddt: e.lddt ? parseFloat(String(e.lddt)) : null,
      prob: e.prob ? parseFloat(String(e.prob)) : null,
    })),
    phylum_distribution: phylumResult.rows.map(r => ({
      phylum: r.phylum,
      count: parseInt(r.count),
    })),
    cross_tier_hits: crossTierResult.rows.map(r => ({
      ...r,
      fident: r.fident ? parseFloat(String(r.fident)) : null,
      evalue: r.evalue ? parseFloat(String(r.evalue)) : null,
      alntmscore: r.alntmscore ? parseFloat(String(r.alntmscore)) : null,
    })),
    dali_searches: buildDaliSearches(daliResult.rows),
  });
}

interface DaliRow {
  library_type: string;
  query_protein_id: string;
  job_status: string;
  job_id: string;
  hit_cd2: string | null;
  zscore: number | null;
  rmsd: number | null;
  nblock: number | null;
  round: number | null;
  ecod_h_group: string | null;
  ecod_x_group_name: string | null;
}

function buildDaliSearches(rows: DaliRow[]) {
  // Group by job_id to handle multiple results per job
  const jobMap = new Map<string, {
    job_id: string;
    library_type: string;
    query_protein_id: string;
    status: string;
    hits: {
      hit_cd2: string;
      zscore: number;
      rmsd: number | null;
      nblock: number | null;
      round: number | null;
      ecod_h_group: string | null;
      ecod_x_group_name: string | null;
    }[];
  }>();

  for (const r of rows) {
    if (!jobMap.has(r.job_id)) {
      jobMap.set(r.job_id, {
        job_id: r.job_id,
        library_type: r.library_type,
        query_protein_id: r.query_protein_id,
        status: r.job_status,
        hits: [],
      });
    }
    if (r.hit_cd2 && r.zscore != null) {
      jobMap.get(r.job_id)!.hits.push({
        hit_cd2: r.hit_cd2,
        zscore: parseFloat(String(r.zscore)),
        rmsd: r.rmsd ? parseFloat(String(r.rmsd)) : null,
        nblock: r.nblock,
        round: r.round,
        ecod_h_group: r.ecod_h_group || null,
        ecod_x_group_name: r.ecod_x_group_name || null,
      });
    }
  }

  return Array.from(jobMap.values());
}

async function handleTier2(clusterId: string) {
  // Get members with LDDT data joined
  const membersResult = await query(`
    SELECT
      ndc.protein_id,
      ndc.domain_num,
      ndc.domain_id,
      ndc.domain_range,
      ndc.dpam_prob,
      ndc.dali_zscore,
      ndc.mean_plddt,
      ndc.phylum,
      ndc.genome_accession,
      ndc.cluster_size,
      deh.best_lddt,
      deh.ecod_xgroup AS lddt_xgroup,
      deh.ecod_tgroup AS lddt_tgroup,
      deh.lddt_class,
      deh.ecod_domain_id AS lddt_ecod_domain
    FROM archaea.novel_domain_clusters ndc
    LEFT JOIN archaea.domain_ecod_hits deh ON deh.domain_id = ndc.domain_id
    WHERE ndc.cluster_id = $1
    ORDER BY ndc.mean_plddt DESC
  `, [clusterId]);

  if (membersResult.rows.length === 0) {
    return NextResponse.json(
      { error: 'Cluster not found' },
      { status: 404 }
    );
  }

  // Build domain IDs for edge query — edges use foldseek filesystem format
  // (pipes replaced with underscores): ENA_ACC_SEQ_nD1
  const domainIds = membersResult.rows.map(m =>
    `${String(m.protein_id).replace(/\|/g, '_')}_${m.domain_num}`
  );
  const proteinIds = membersResult.rows.map(m => m.protein_id);

  // Build cluster summary inline
  const firstRow = membersResult.rows[0];
  const clusterSize = firstRow.cluster_size;

  const phylumSet = new Set<string>();
  const genomeSet = new Set<string>();
  const proteinSet = new Set<string>();
  let plddtSum = 0;
  let plddtCount = 0;
  let dpamSum = 0;
  let dpamCount = 0;
  let daliSum = 0;
  let daliCount = 0;
  let lddtSum = 0;
  let lddtCount = 0;

  for (const m of membersResult.rows) {
    if (m.phylum) phylumSet.add(m.phylum);
    if (m.genome_accession) genomeSet.add(m.genome_accession);
    proteinSet.add(m.protein_id);
    if (m.mean_plddt != null) {
      plddtSum += parseFloat(String(m.mean_plddt));
      plddtCount++;
    }
    if (m.dpam_prob != null) {
      dpamSum += parseFloat(String(m.dpam_prob));
      dpamCount++;
    }
    if (m.dali_zscore != null) {
      daliSum += parseFloat(String(m.dali_zscore));
      daliCount++;
    }
    if (m.best_lddt != null) {
      lddtSum += parseFloat(String(m.best_lddt));
      lddtCount++;
    }
  }

  const avgLddt = lddtCount > 0 ? lddtSum / lddtCount : null;
  const lddtClassification = avgLddt == null || avgLddt < 0.3 ? 'NOVEL'
    : avgLddt < 0.5 ? 'WEAK_SIMILARITY'
    : avgLddt < 0.7 ? 'MODERATE_SIMILARITY'
    : 'ECOD_ASSIGNABLE';

  const cluster = {
    cluster_id: clusterId,
    cluster_size: clusterSize,
    cross_phylum: phylumSet.size > 1,
    phylum_count: phylumSet.size,
    genome_count: genomeSet.size,
    protein_count: proteinSet.size,
    domain_count: membersResult.rows.length,
    avg_plddt: plddtCount > 0 ? plddtSum / plddtCount : null,
    avg_dpam_prob: dpamCount > 0 ? dpamSum / dpamCount : null,
    avg_dali_zscore: daliCount > 0 ? daliSum / daliCount : null,
    phyla: Array.from(phylumSet).sort().join(', '),
    avg_best_lddt: avgLddt,
    lddt_classification: lddtCount > 0 ? lddtClassification : null,
  };

  // Build parameterized query for edge lookup
  const domainPlaceholders = domainIds.map((_, i) => `$${i + 1}`).join(', ');

  const [edgesResult, phylumResult, crossTierResult, lddtDistResult, xgroupSuggestResult] = await Promise.all([
    domainIds.length > 0
      ? query(`
          SELECT
            e.query_domain AS query,
            e.target_domain AS target,
            e.fident,
            e.alnlen,
            e.evalue,
            e.bits,
            e.alntmscore,
            e.qtmscore,
            e.ttmscore
          FROM archaea.novel_domain_edges e
          WHERE e.query_domain IN (${domainPlaceholders})
            AND e.target_domain IN (${domainPlaceholders})
          ORDER BY e.evalue ASC
        `, domainIds)
      : Promise.resolve({ rows: [] }),

    // Phylum distribution
    query<{ phylum: string; count: string }>(`
      SELECT phylum, COUNT(*) AS count
      FROM archaea.novel_domain_clusters
      WHERE cluster_id = $1
      GROUP BY phylum
      ORDER BY count DESC
    `, [clusterId]),

    // Cross-tier hits (Tier 2 -> Tier 1)
    proteinIds.length > 0
      ? query(`
          SELECT
            ct.tier1_protein_id,
            ct.tier2_protein_id,
            ct.tier2_domain_num,
            nfc.cluster_id AS tier1_cluster_id,
            nfc.cluster_size AS tier1_cluster_size,
            ct.fident,
            ct.alnlen,
            ct.evalue,
            ct.alntmscore
          FROM archaea.novel_cross_tier_hits ct
          JOIN archaea.novel_fold_clusters nfc
            ON ct.tier1_protein_id = nfc.protein_id
          WHERE ct.tier2_protein_id IN (${proteinIds.map((_, i) => `$${i + 1}`).join(', ')})
          ORDER BY ct.alntmscore DESC
        `, proteinIds)
      : Promise.resolve({ rows: [] }),

    // LDDT distribution: bucket counts for this cluster
    query<{ bucket: string; count: string }>(`
      SELECT
        CASE
          WHEN deh.best_lddt IS NULL THEN 'no_hit'
          WHEN deh.best_lddt < 0.3 THEN '0.0-0.3'
          WHEN deh.best_lddt < 0.5 THEN '0.3-0.5'
          WHEN deh.best_lddt < 0.7 THEN '0.5-0.7'
          ELSE '0.7+'
        END AS bucket,
        COUNT(*) AS count
      FROM archaea.novel_domain_clusters ndc
      LEFT JOIN archaea.domain_ecod_hits deh ON deh.domain_id = ndc.domain_id
      WHERE ndc.cluster_id = $1
      GROUP BY bucket
    `, [clusterId]),

    // X-group suggestions from LDDT hits
    query<{ xgroup: string; n_hits: string; avg_lddt: string; max_lddt: string }>(`
      SELECT
        deh.ecod_xgroup AS xgroup,
        COUNT(*) AS n_hits,
        AVG(deh.best_lddt) AS avg_lddt,
        MAX(deh.best_lddt) AS max_lddt
      FROM archaea.novel_domain_clusters ndc
      JOIN archaea.domain_ecod_hits deh ON deh.domain_id = ndc.domain_id
      WHERE ndc.cluster_id = $1
        AND deh.ecod_xgroup IS NOT NULL
      GROUP BY deh.ecod_xgroup
      ORDER BY n_hits DESC, avg_lddt DESC
    `, [clusterId]),
  ]);

  return NextResponse.json({
    tier: 2,
    cluster,
    members: membersResult.rows.map(m => ({
      ...m,
      mean_plddt: m.mean_plddt ? parseFloat(String(m.mean_plddt)) : null,
      dpam_prob: m.dpam_prob ? parseFloat(String(m.dpam_prob)) : null,
      dali_zscore: m.dali_zscore ? parseFloat(String(m.dali_zscore)) : null,
      best_lddt: m.best_lddt ? parseFloat(String(m.best_lddt)) : null,
    })),
    edges: edgesResult.rows.map(e => ({
      ...e,
      fident: e.fident ? parseFloat(String(e.fident)) : null,
      evalue: e.evalue ? parseFloat(String(e.evalue)) : null,
      alntmscore: e.alntmscore ? parseFloat(String(e.alntmscore)) : null,
      qtmscore: e.qtmscore ? parseFloat(String(e.qtmscore)) : null,
      ttmscore: e.ttmscore ? parseFloat(String(e.ttmscore)) : null,
    })),
    phylum_distribution: phylumResult.rows.map(r => ({
      phylum: r.phylum,
      count: parseInt(r.count),
    })),
    cross_tier_hits: crossTierResult.rows.map(r => ({
      ...r,
      fident: r.fident ? parseFloat(String(r.fident)) : null,
      evalue: r.evalue ? parseFloat(String(r.evalue)) : null,
      alntmscore: r.alntmscore ? parseFloat(String(r.alntmscore)) : null,
    })),
    lddt_distribution: lddtDistResult.rows.map(r => ({
      bucket: r.bucket,
      count: parseInt(r.count),
    })),
    xgroup_suggestions: xgroupSuggestResult.rows.map(r => ({
      xgroup: r.xgroup,
      n_hits: parseInt(r.n_hits),
      avg_lddt: parseFloat(r.avg_lddt),
      max_lddt: parseFloat(r.max_lddt),
    })),
  });
}
