import { useState } from 'react';
import { MdLink, MdCopyAll, MdRefresh, MdCode } from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';
import { MdShield } from 'react-icons/md';

const DEMO_TOKEN = 'fg_live_k8s9x2mQwErTy4Pu6Vn1Az3Bc7Dh0Jl';

const MQTT_TOPICS = [
  { topic: 'fireguard/SITE001/JNX-FG-AB12/telemetry', desc: 'Live equipment telemetry (every 10s)' },
  { topic: 'fireguard/SITE001/JNX-FG-AB12/status',    desc: 'Gateway health status (every 60s)' },
  { topic: 'fireguard/SITE001/JNX-FG-AB12/alarm',     desc: 'Alarm events (immediate)' },
  { topic: 'fireguard/SITE001/JNX-FG-AB12/config/set',desc: 'Update gateway configuration' },
  { topic: 'fireguard/SITE001/JNX-FG-AB12/command',   desc: 'Send commands to gateway' },
];

const REST_ENDPOINTS = [
  { method: 'GET',  path: '/api/sites',                     desc: 'List all sites' },
  { method: 'GET',  path: '/api/sites/:siteId/dashboard',   desc: 'Dashboard snapshot' },
  { method: 'GET',  path: '/api/sites/:siteId/alarms',      desc: 'Alarm history' },
  { method: 'POST', path: '/api/alarms/:id/ack',            desc: 'Acknowledge alarm' },
  { method: 'POST', path: '/api/ingest/telemetry',          desc: 'Ingest telemetry (device)' },
  { method: 'GET',  path: '/api/sites/:siteId/trends',      desc: 'Trend data' },
];

export function APIIntegrationPage() {
  const { canAccessAPI } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!canAccessAPI) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <MdShield className="text-5xl mb-3" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">API Integration requires VENDOR_ADMIN or JENIX_SUPER_ADMIN role.</p>
      </div>
    );
  }

  function copyToken() {
    navigator.clipboard.writeText(DEMO_TOKEN).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-teal-100 rounded-xl text-teal-700 text-2xl"><MdLink /></div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">API Integration</h1>
          <p className="text-sm text-slate-500">Tokens, MQTT topics, and REST endpoints for third-party integration</p>
        </div>
      </div>

      {/* API Token */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">API Token</h2>
        <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
          <code className="flex-1 font-mono text-sm text-slate-700 break-all">{DEMO_TOKEN}</code>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={copyToken} className="btn-ghost flex items-center gap-1 py-1.5">
              <MdCopyAll /> {copied ? 'Copied!' : 'Copy'}
            </button>
            <button className="btn-ghost flex items-center gap-1 py-1.5">
              <MdRefresh /> Rotate
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Include as: <code className="font-mono">Authorization: Bearer &lt;token&gt;</code></p>
      </div>

      {/* MQTT Topics */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <MdCode /> MQTT Topics
        </h2>
        <div className="space-y-2">
          {MQTT_TOPICS.map((t) => (
            <div key={t.topic} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 border-b border-slate-50 last:border-0">
              <code className="font-mono text-xs text-brand-blue bg-blue-50 px-2 py-1 rounded flex-1">{t.topic}</code>
              <span className="text-xs text-slate-500">{t.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* REST Endpoints */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">REST Endpoints</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="table-head">
              <tr>
                <th className="table-cell">Method</th>
                <th className="table-cell">Path</th>
                <th className="table-cell">Description</th>
              </tr>
            </thead>
            <tbody>
              {REST_ENDPOINTS.map((e) => (
                <tr key={e.path + e.method} className="table-row">
                  <td className="table-cell">
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      e.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>{e.method}</span>
                  </td>
                  <td className="table-cell font-mono text-xs text-slate-700">{e.path}</td>
                  <td className="table-cell text-slate-500 text-xs">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
