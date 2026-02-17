# Archaea Protein Atlas

Web application for exploring structural characterization and novel fold discovery across 124,000+ archaeal proteins from 65 target genomes spanning 21 phyla.

## Overview

This app provides interactive visualization of the archaeal protein dataset, including:

- **Dashboard** — protein coverage, clustering insights, ECOD novelty breakdown
- **Clustering Analysis** — 4-dimension clustering (protein sequence, protein structure, domain sequence, domain structure) with cross-comparison showing proteins "rescued" by structural similarity
- **Novel Fold Discovery** — two-tier novelty analysis: Tier 1 (dark proteins with no ECOD homology) and Tier 2 (orphan domains from DPAM classification)
- **Organism Browser** — per-genome views with pipeline coverage, novel fold counts, and domain landscapes
- **Protein Detail** — 3Dmol.js structure viewer, PAE heatmaps, domain architecture, Pfam annotations
- **Domain Landscape** — T-group and Pfam distributions across the dataset

## Tech Stack

- **Next.js 15** with App Router
- **React 18** + TypeScript
- **Tailwind CSS** for styling
- **3Dmol.js** for protein structure visualization
- **pg** for direct PostgreSQL queries

## Database

Queries the `archaea` schema in a PostgreSQL database containing:

| Table | Records |
|-------|---------|
| `target_classes` | 65 genomes |
| `target_proteins` | 124,427 proteins |
| `domains` | 185,171 DPAM domains |
| `domain_pfam_hits` | 65,000+ Pfam annotations |
| `novel_fold_clusters` | 21 Tier 1 clusters (dark proteins) |
| `novel_domain_clusters` | 3,650 Tier 2 clusters (orphan domains) |
| `protein_seq_clusters` | 76,856 MMseqs2 clusters |
| `protein_struct_clusters` | 24,727 Foldseek clusters |

## Setup

```bash
npm install
```

Configure database connection via environment variables (see `src/lib/db.ts`).

## Development

```bash
# Local development
npm run dev

# Network-accessible (all interfaces)
npm run dev:network

# On leda cluster (port 4002)
npm run dev:leda
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with stats and clustering insights |
| `/clustering` | 4-dimension clustering analysis |
| `/novel-folds` | Two-tier novel fold browser |
| `/organisms` | Genome browser with detail pages |
| `/proteins/[id]` | Protein detail with structure viewer |
| `/domains` | Domain landscape analysis |
| `/clusters` | Legacy structural cluster browser |

## API Routes

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Core dataset statistics |
| `GET /api/clustering` | Clustering summaries, cross-comparison, ECOD novelty |
| `GET /api/proteins/[id]` | Protein detail with domains |
| `GET /api/organisms` | Organism list with aggregated stats |
| `GET /api/organisms/[id]` | Per-organism protein data |
| `GET /api/novel-folds` | Novel fold cluster data |
| `GET /api/domains` | Domain landscape aggregations |
| `GET /api/structure/[id]` | CIF file serving |
| `GET /api/pae/[id]` | PAE matrix data |
