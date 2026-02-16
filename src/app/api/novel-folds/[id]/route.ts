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
  const [clusterResult, membersResult, edgesResult, phylumResult, crossTierResult] =
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
    ]);

  if (clusterResult.rows.length === 0) {
    return NextResponse.json(
      { error: 'Cluster not found' },
      { status: 404 }
    );
  }

  const cluster = clusterResult.rows[0];

  return NextResponse.json({
    tier: 1,
    cluster: {
      ...cluster,
      avg_plddt: cluster.avg_plddt ? parseFloat(String(cluster.avg_plddt)) : null,
      min_plddt: cluster.min_plddt ? parseFloat(String(cluster.min_plddt)) : null,
      max_plddt: cluster.max_plddt ? parseFloat(String(cluster.max_plddt)) : null,
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
  });
}

async function handleTier2(clusterId: string) {
  // Get members first to build domain ID list for edge query
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
      ndc.cluster_size
    FROM archaea.novel_domain_clusters ndc
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
  }

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
  };

  // Build parameterized query for edge lookup
  const domainPlaceholders = domainIds.map((_, i) => `$${i + 1}`).join(', ');

  const [edgesResult, phylumResult, crossTierResult] = await Promise.all([
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
  ]);

  return NextResponse.json({
    tier: 2,
    cluster,
    members: membersResult.rows.map(m => ({
      ...m,
      mean_plddt: m.mean_plddt ? parseFloat(String(m.mean_plddt)) : null,
      dpam_prob: m.dpam_prob ? parseFloat(String(m.dpam_prob)) : null,
      dali_zscore: m.dali_zscore ? parseFloat(String(m.dali_zscore)) : null,
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
  });
}
