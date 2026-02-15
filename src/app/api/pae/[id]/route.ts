/**
 * GET /api/pae/:id
 *
 * Serves PAE (Predicted Aligned Error) JSON files from disk.
 * Path resolved from target_proteins.pae_file column.
 *
 * PAE files come in two formats:
 *   - AFDB v6: {"predicted_aligned_error": [[...]], ...} (full matrix)
 *   - AF3: confidences.json with "pae" key
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proteinId } = await params;

    if (!proteinId) {
      return NextResponse.json(
        { error: 'Protein ID is required' },
        { status: 400 }
      );
    }

    const result = await query<{ pae_file: string; has_pae: boolean }>(`
      SELECT pae_file, has_pae
      FROM archaea.target_proteins
      WHERE protein_id = $1
    `, [proteinId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Protein not found', protein_id: proteinId },
        { status: 404 }
      );
    }

    const { pae_file, has_pae } = result.rows[0];

    if (!has_pae || !pae_file) {
      return NextResponse.json(
        { error: 'No PAE data available', protein_id: proteinId },
        { status: 404 }
      );
    }

    try {
      await fs.access(pae_file);
    } catch {
      return NextResponse.json(
        { error: 'PAE file not found on disk', protein_id: proteinId },
        { status: 404 }
      );
    }

    const content = await fs.readFile(pae_file, 'utf-8');
    const raw = JSON.parse(content);

    // Normalize to a consistent format: { pae: number[][] }
    let paeMatrix: number[][] | null = null;

    if (Array.isArray(raw.pae)) {
      // AF3 confidences.json format: { "pae": [[...]], ... }
      paeMatrix = raw.pae;
    } else if (Array.isArray(raw.predicted_aligned_error)) {
      // AFDB v6 format: { "predicted_aligned_error": [[...]] }
      paeMatrix = raw.predicted_aligned_error;
    } else if (Array.isArray(raw) && raw.length > 0) {
      // Some AFDB files: [{"predicted_aligned_error": [[...]]}]
      if (raw[0].predicted_aligned_error) {
        paeMatrix = raw[0].predicted_aligned_error;
      }
    }

    if (!paeMatrix) {
      return NextResponse.json(
        { error: 'Unrecognized PAE format', protein_id: proteinId },
        { status: 500 }
      );
    }

    return NextResponse.json({
      protein_id: proteinId,
      size: paeMatrix.length,
      pae: paeMatrix,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('PAE API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch PAE data',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
