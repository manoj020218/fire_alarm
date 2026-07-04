import { useState } from 'react';
import { MdAssessment, MdDownload, MdAdd, MdPictureAsPdf, MdTableChart, MdInsertDriveFile } from 'react-icons/md';
import { MOCK_REPORTS } from '@/data/mockAlarms';
import { formatDateTime } from '@/utils/formatters';

const FORMAT_ICON = {
  pdf: <MdPictureAsPdf className="text-red-500" />,
  excel: <MdTableChart className="text-green-600" />,
  csv: <MdInsertDriveFile className="text-blue-500" />,
};

export function ReportsPage() {
  const [generating, setGenerating] = useState(false);
  const [type, setType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-xl text-purple-700 text-2xl"><MdAssessment /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-500">Generate and download site reports</p>
        </div>
      </div>

      {/* Generate report */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Generate Report</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Report Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input-field w-40">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="input-field w-32">
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary flex items-center gap-2">
            <MdAdd /> {generating ? 'Generating…' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Report list */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Previous Reports</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Name</th>
                <th className="table-cell">Type</th>
                <th className="table-cell">Format</th>
                <th className="table-cell">Generated</th>
                <th className="table-cell">By</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_REPORTS.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-medium">{r.name}</td>
                  <td className="table-cell capitalize">{r.type}</td>
                  <td className="table-cell">
                    <span className="flex items-center gap-1">{FORMAT_ICON[r.format]} {r.format.toUpperCase()}</span>
                  </td>
                  <td className="table-cell text-xs text-slate-400">{formatDateTime(r.generatedAt)}</td>
                  <td className="table-cell text-xs text-slate-500">{r.generatedBy.split('@')[0]}</td>
                  <td className="table-cell">
                    <button className="flex items-center gap-1 text-brand-blue text-xs hover:underline">
                      <MdDownload /> Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
