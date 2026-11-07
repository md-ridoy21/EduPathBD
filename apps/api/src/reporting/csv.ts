type AnalyticsDataset = {
  overview: Record<string, number>;
  applicationStatuses: Array<{ label: string; value: number }>;
  reportStatuses: Array<{ label: string; value: number }>;
  topRatedInstitutions: Array<{ label: string; value: number; count: number }>;
  activity: Record<string, number>;
};

function cell(value: unknown) {
  const raw = String(value ?? "");
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(rows: Array<Record<string, unknown>>) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\r\n");
}

export function analyticsToCsv(dataset: AnalyticsDataset) {
  const generatedAt = new Date().toISOString();
  const rows: Array<Record<string, unknown>> = [
    ...Object.entries(dataset.overview).map(([metric, value]) => ({ section: "overview", metric, value, count: "", generatedAt })),
    ...dataset.applicationStatuses.map((item) => ({ section: "application_status", metric: item.label, value: item.value, count: item.value, generatedAt })),
    ...dataset.reportStatuses.map((item) => ({ section: "report_status", metric: item.label, value: item.value, count: item.value, generatedAt })),
    ...dataset.topRatedInstitutions.map((item) => ({ section: "top_rating", metric: item.label, value: item.value, count: item.count, generatedAt })),
    ...Object.entries(dataset.activity).map(([metric, value]) => ({ section: "activity", metric, value, count: value, generatedAt }))
  ];
  return rowsToCsv(rows);
}

export function moderationToCsv(reports: Array<Record<string, unknown>>) {
  return rowsToCsv(reports.length ? reports : [{ id: "", reporterUsername: "", targetType: "", targetId: "", reason: "", status: "", createdAt: "" }]);
}
