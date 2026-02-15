import { getProvenanceLabel } from '@/lib/utils';

const provenanceColors: Record<string, string> = {
  'AFDB v6': 'bg-blue-100 text-blue-800',
  'AFDB v6 (HGD)': 'bg-blue-100 text-blue-800',
  'AF3 Tier 1': 'bg-green-100 text-green-800',
  'AF3 Tier 2': 'bg-yellow-100 text-yellow-800',
  'AF3 Tier 3': 'bg-orange-100 text-orange-800',
  'AF3 Gap': 'bg-purple-100 text-purple-800',
  'Prodigal': 'bg-teal-100 text-teal-800',
  'UniParc': 'bg-indigo-100 text-indigo-800',
  'AFDB': 'bg-blue-100 text-blue-800',
};

export default function ProvenanceBadge({
  source,
  cifFile,
}: {
  source: string;
  cifFile: string | null;
}) {
  const label = getProvenanceLabel(source, cifFile);
  const colorClass = provenanceColors[label] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
