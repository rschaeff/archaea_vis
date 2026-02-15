const colorClasses: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  green: { bg: 'bg-green-50 border-green-200', text: 'text-green-700' },
  purple: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  orange: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
  red: { bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  gray: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700' },
};

export default function StatCard({
  title,
  value,
  subtitle,
  color = 'blue',
}: {
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`rounded-lg border p-6 ${colors.bg}`}>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className={`text-3xl font-bold mt-1 ${colors.text}`}>{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
