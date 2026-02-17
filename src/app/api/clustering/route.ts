/**
 * GET /api/clustering
 *
 * Returns clustering analysis across 4 dimensions:
 * protein sequence, protein structure, domain sequence, domain structure.
 * Includes summary stats, size distributions, cross-comparison, and top clusters.
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface SummaryRow {
  clusters: string;
  members: string;
  singletons: string;
  largest: string;
}

interface DistRow {
  bin: string;
  clusters: string;
  members: string;
}

interface CrossRow {
  both_clustered: string;
  rescued_by_structure: string;
  both_singleton: string;
  seq_only: string;
}

interface NoveltyRow {
  has_ecod: string;
  novel: string;
}

interface TopClusterRow {
  cluster_id: string;
  cluster_size: number;
  cluster_rep: string;
  n_classes: string;
  classes: string;
}

const SIZE_BIN_SQL = `
  CASE WHEN cluster_size = 1 THEN '1'
       WHEN cluster_size <= 5 THEN '2-5'
       WHEN cluster_size <= 20 THEN '6-20'
       WHEN cluster_size <= 100 THEN '21-100'
       ELSE '100+' END
`;

function summaryQuery(table: string) {
  return query<SummaryRow>(`
    SELECT COUNT(DISTINCT cluster_id) AS clusters,
           COUNT(*) AS members,
           COUNT(*) FILTER (WHERE cluster_size = 1) AS singletons,
           MAX(cluster_size) AS largest
    FROM archaea.${table}
  `);
}

function distQuery(table: string) {
  return query<DistRow>(`
    SELECT
      ${SIZE_BIN_SQL} AS bin,
      COUNT(DISTINCT cluster_id) AS clusters,
      COUNT(*) AS members
    FROM archaea.${table}
    GROUP BY bin
  `);
}

export async function GET() {
  try {
    const [
      protSeqSummary,
      protStructSummary,
      domSeqSummary,
      protSeqDist,
      protStructDist,
      domSeqDist,
      crossResult,
      noveltyResult,
      topClusters,
    ] = await Promise.all([
      summaryQuery('protein_seq_clusters'),
      summaryQuery('protein_struct_clusters'),
      summaryQuery('domain_seq_clusters'),
      distQuery('protein_seq_clusters'),
      distQuery('protein_struct_clusters'),
      distQuery('domain_seq_clusters'),
      query<CrossRow>(`
        SELECT
          COUNT(*) FILTER (WHERE psc.cluster_size > 1 AND pxc.cluster_size > 1) AS both_clustered,
          COUNT(*) FILTER (WHERE psc.cluster_size = 1 AND pxc.cluster_size > 1) AS rescued_by_structure,
          COUNT(*) FILTER (WHERE psc.cluster_size = 1 AND pxc.cluster_size = 1) AS both_singleton,
          COUNT(*) FILTER (WHERE psc.cluster_size > 1 AND pxc.cluster_size = 1) AS seq_only
        FROM archaea.protein_seq_clusters psc
        JOIN archaea.protein_struct_clusters pxc ON psc.protein_id = pxc.protein_id
      `),
      query<NoveltyRow>(`
        SELECT
          COUNT(*) FILTER (WHERE has_ecod_member) AS has_ecod,
          COUNT(*) FILTER (WHERE NOT has_ecod_member) AS novel
        FROM archaea.protein_seq_clusters
      `),
      query<TopClusterRow>(`
        SELECT pxc.cluster_id, pxc.cluster_size, pxc.cluster_rep,
               COUNT(DISTINCT tc.id) AS n_classes,
               STRING_AGG(DISTINCT tc.class_name, ', ' ORDER BY tc.class_name) AS classes
        FROM archaea.protein_struct_clusters pxc
        JOIN archaea.target_proteins tp ON tp.protein_id = pxc.protein_id
        JOIN archaea.target_classes tc ON tc.id = tp.target_class_id
        GROUP BY pxc.cluster_id, pxc.cluster_size, pxc.cluster_rep
        ORDER BY pxc.cluster_size DESC
        LIMIT 20
      `),
    ]);

    const parseSummary = (r: SummaryRow) => ({
      clusters: parseInt(r.clusters),
      members: parseInt(r.members),
      singletons: parseInt(r.singletons),
      largest: parseInt(r.largest),
    });

    const parseDist = (rows: DistRow[]) =>
      rows.map(r => ({
        bin: r.bin,
        clusters: parseInt(r.clusters),
        members: parseInt(r.members),
      }));

    const ps = parseSummary(protSeqSummary.rows[0]);
    const px = parseSummary(protStructSummary.rows[0]);
    const ds = parseSummary(domSeqSummary.rows[0]);

    const cross = crossResult.rows[0];
    const crossParsed = {
      both_clustered: parseInt(cross.both_clustered),
      rescued_by_structure: parseInt(cross.rescued_by_structure),
      both_singleton: parseInt(cross.both_singleton),
      seq_only: parseInt(cross.seq_only),
      total: parseInt(cross.both_clustered) + parseInt(cross.rescued_by_structure) +
             parseInt(cross.both_singleton) + parseInt(cross.seq_only),
    };

    const nov = noveltyResult.rows[0];

    return NextResponse.json({
      summary: [
        { type: 'protein_seq', label: 'Protein Sequence', method: 'MMseqs2', ...ps },
        { type: 'protein_struct', label: 'Protein Structure', method: 'Foldseek', ...px },
        { type: 'domain_seq', label: 'Domain Sequence', method: 'MMseqs2', ...ds },
        { type: 'domain_struct', label: 'Domain Structure', method: 'Foldseek', clusters: 0, members: 0, singletons: 0, largest: 0, pending: true },
      ],
      size_distributions: {
        protein_seq: parseDist(protSeqDist.rows),
        protein_struct: parseDist(protStructDist.rows),
        domain_seq: parseDist(domSeqDist.rows),
      },
      cross_comparison: crossParsed,
      ecod_novelty: {
        has_ecod: parseInt(nov.has_ecod),
        novel: parseInt(nov.novel),
      },
      top_structural_clusters: topClusters.rows.map(r => ({
        cluster_id: r.cluster_id,
        cluster_size: r.cluster_size,
        cluster_rep: r.cluster_rep,
        n_classes: parseInt(r.n_classes),
        classes: r.classes,
      })),
    });
  } catch (error) {
    console.error('Clustering API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch clustering data',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
