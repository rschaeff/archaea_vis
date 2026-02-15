/**
 * GET /api/proteins/:id/domains
 *
 * Returns all DPAM domains for a protein with their Pfam hits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { Domain, DomainPfamHit, DomainWithPfam } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proteinId } = await params;

    const [domainsResult, pfamResult] = await Promise.all([
      query<Domain>(`
        SELECT
          id, protein_id, domain_num, range,
          t_group, judge,
          dpam_prob, hh_prob
        FROM archaea.domains
        WHERE protein_id = $1
        ORDER BY domain_num
      `, [proteinId]),

      query<DomainPfamHit & { domain_id: number }>(`
        SELECT
          dph.domain_id,
          dph.pfam_acc,
          dph.sequence_evalue AS e_value,
          dph.sequence_score AS bit_score,
          dph.ali_from AS query_start,
          dph.ali_to AS query_end
        FROM archaea.domain_pfam_hits dph
        JOIN archaea.domains d ON dph.domain_id = d.id
        WHERE d.protein_id = $1
        ORDER BY d.domain_num, dph.sequence_evalue
      `, [proteinId]),
    ]);

    const pfamByDomain = new Map<number, DomainPfamHit[]>();
    for (const hit of pfamResult.rows) {
      const existing = pfamByDomain.get(hit.domain_id) || [];
      existing.push({
        domain_id: hit.domain_id,
        pfam_acc: hit.pfam_acc,
        e_value: hit.e_value,
        bit_score: hit.bit_score,
        query_start: hit.query_start,
        query_end: hit.query_end,
      });
      pfamByDomain.set(hit.domain_id, existing);
    }

    const domains: DomainWithPfam[] = domainsResult.rows.map(d => ({
      ...d,
      pfam_hits: pfamByDomain.get(d.id) || [],
    }));

    return NextResponse.json({
      protein_id: proteinId,
      domains,
      total: domains.length,
    });
  } catch (error) {
    console.error('Protein domains API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch protein domains',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
