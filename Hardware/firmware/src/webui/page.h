#pragma once
// ============================================================
// FireGuard — Full single-page WebUI (PROGMEM, ~4 kB)
// Auto-refreshes via /api/status JSON.
// Pages: Status | Config | Modbus | Alarms | OTA
// Auth: mutating endpoints require X-Admin-Token header
//       (set by login form, stored in sessionStorage).
// ============================================================
#include <Arduino.h>

static const char FIREGUARD_PAGE[] PROGMEM = R"rawhtml(
<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FireGuard Gateway</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:monospace;background:#0f172a;color:#cbd5e1;min-height:100vh}
header{background:#1e293b;padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;border-bottom:1px solid #334155}
h1{color:#f97316;font-size:1.1rem}
.badge{font-size:.7rem;background:#0f172a;padding:.2rem .5rem;border-radius:4px}
nav{display:flex;gap:1px;background:#0f172a;padding:0 1rem}
nav button{background:#1e293b;color:#94a3b8;border:none;padding:.5rem 1rem;cursor:pointer;font-family:monospace;font-size:.85rem;border-bottom:2px solid transparent}
nav button.active{color:#f97316;border-bottom-color:#f97316}
#content{padding:1rem;max-width:900px}
.card{background:#1e293b;border:1px solid #334155;border-radius:6px;padding:1rem;margin-bottom:1rem}
.card h2{color:#f97316;font-size:.9rem;margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em}
table{width:100%;border-collapse:collapse;font-size:.85rem}
td,th{border:1px solid #334155;padding:.3rem .6rem;text-align:left}
th{background:#0f172a;color:#94a3b8}
.ok{color:#22c55e}.bad{color:#ef4444}.warn{color:#f59e0b}
input,select{background:#0f172a;color:#cbd5e1;border:1px solid #475569;padding:.35rem .5rem;border-radius:4px;font-family:monospace;font-size:.85rem;width:100%}
label{font-size:.8rem;color:#94a3b8;display:block;margin:.4rem 0 .15rem}
.row{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem}
btn,button.act{background:#f97316;color:#0f172a;border:none;padding:.4rem .9rem;border-radius:4px;cursor:pointer;font-family:monospace;font-size:.85rem;font-weight:bold}
button.act:hover{background:#fb923c}
button.sec{background:#334155;color:#cbd5e1}
button.sec:hover{background:#475569}
button.danger{background:#dc2626;color:#fff}
#toast{position:fixed;bottom:1rem;right:1rem;background:#1e293b;border:1px solid #475569;padding:.6rem 1rem;border-radius:6px;display:none;font-size:.85rem;z-index:99}
.spinner{display:inline-block;width:.8rem;height:.8rem;border:2px solid #475569;border-top-color:#f97316;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-left:.3rem}
@keyframes spin{to{transform:rotate(360deg)}}
#loginBanner{background:#7c3aed22;border:1px solid #7c3aed;border-radius:6px;padding:.75rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:.75rem}
</style>
</head>
<body>
<header>
  <span style="font-size:1.4rem">&#x1F525;</span>
  <h1>FireGuard Gateway</h1>
  <span class="badge" id="fwBadge">v?</span>
  <span class="badge" id="uplinkBadge">-</span>
  <span style="margin-left:auto;font-size:.75rem;color:#64748b" id="tsLabel"></span>
</header>
<nav>
  <button class="active" onclick="tab('status',this)">Status</button>
  <button onclick="tab('config',this)">Config</button>
  <button onclick="tab('modbus',this)">Modbus</button>
  <button onclick="tab('alarms',this)">Alarms</button>
  <button onclick="tab('ota',this)">OTA</button>
</nav>
<div id="content">
  <div id="loginBanner" style="display:none">
    <span>Admin password required for write operations</span>
    <input id="pwInput" type="password" placeholder="Admin password" style="width:160px" onkeydown="if(event.key==='Enter')login()">
    <button class="act" onclick="login()">Unlock</button>
  </div>
  <div id="status"></div>
  <div id="config" style="display:none"></div>
  <div id="modbus" style="display:none"></div>
  <div id="alarms" style="display:none"></div>
  <div id="ota"    style="display:none"></div>
</div>
<div id="toast"></div>
<script>
var _tok='',_tab='status',_si=null,_pwRequired=true;

// FIX 3: Query server on load; if no admin password is set, auto-unlock
function initAuth(){
  fetch('/api/authinfo').then(function(r){return r.json();}).then(function(d){
    _pwRequired=!!d.passwordSet;
    if(!_pwRequired){_tok='__open__';document.getElementById('loginBanner').style.display='none';}
  }).catch(function(){/* server unreachable — keep banner */});
}
function login(){var p=document.getElementById('pwInput');if(p.value){_tok=p.value;document.getElementById('loginBanner').style.display='none';toast('Unlocked','ok');}}
function checkAuth(){if(!_tok){document.getElementById('loginBanner').style.display='flex';return false;}return true;}
function toast(msg,cls){var t=document.getElementById('toast');t.textContent=msg;t.style.color=cls==='ok'?'#22c55e':cls==='warn'?'#f59e0b':'#ef4444';t.style.display='block';setTimeout(function(){t.style.display='none';},3500);}
function tab(name,btn){_tab=name;['status','config','modbus','alarms','ota'].forEach(function(n){document.getElementById(n).style.display=n===name?'':'none';});document.querySelectorAll('nav button').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');if(name==='config')loadConfig();if(name==='alarms')loadAlarms();if(name==='ota')loadOta();}

function h(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function sc(v){return v?'<span class="ok">'+h(v)+'</span>':'<span class="bad">-</span>';}
function stc(v,ok,warn){var c=v===ok?'ok':v===warn?'warn':'bad';return '<span class="'+c+'">'+h(v)+'</span>';}

// ---- STATUS TAB ----
function loadStatus(){
  fetch('/api/status').then(function(r){return r.json();}).then(function(d){
    document.getElementById('fwBadge').textContent='v'+d.fw;
    var ub=document.getElementById('uplinkBadge');
    ub.textContent=d.uplink;ub.style.color=d.uplink==='none'?'#ef4444':'#22c55e';
    document.getElementById('tsLabel').textContent=new Date().toLocaleTimeString();
    var rows=[
      ['Firmware',d.fw],['HW',d.hw],['Product',d.pid],
      ['Uptime (s)',d.uptime],['Free Heap',d.heap+' B'],['Min Heap',d.minHeap+' B'],
      ['Uplink',d.uplink],['4G Signal',d.signal4g+' dBm'],['LAN Link',d.signalLan?'yes':'no'],
      ['MQTT Reconnects',d.mqttReconns],['MB Timeouts',d.mbTimeouts],
      ['Active Alarms',d.alarmsActive],['Reset Reason',d.reset]
    ];
    var html='<div class="card"><h2>System Status</h2><table><tr><th>Key</th><th>Value</th></tr>';
    rows.forEach(function(r){html+='<tr><td>'+h(r[0])+'</td><td>'+h(r[1])+'</td></tr>';});
    html+='</table></div>';
    document.getElementById('status').innerHTML=html;
  }).catch(function(){document.getElementById('status').innerHTML='<div class="card"><span class="bad">Cannot reach /api/status</span></div>';});
}

// ---- CONFIG TAB ----
function loadConfig(){
  fetch('/api/config').then(function(r){return r.json();}).then(function(d){
    document.getElementById('config').innerHTML=buildConfigForm(d);
  });
}
function buildConfigForm(d){
  return '<div class="card"><h2>Provisioning</h2>'+
  '<div class="row"><div><label>Environment</label><select id="cEnv"><option value="dev"'+(d.env==='dev'?' selected':'')+'>dev</option><option value="prod"'+(d.env==='prod'?' selected':'')+'>prod</option></select></div>'+
  '<div><label>Site ID</label><input id="cSite" value="'+h(d.siteId||'')+'"></div></div>'+
  '<div class="row"><div><label>Gateway ID</label><input id="cGw" value="'+h(d.gatewayId||'')+'"></div>'+
  '<div><label>APN (blank=auto)</label><input id="cApn" value="'+h(d.apn||'')+'"></div></div>'+
  '<div class="row"><div style="display:flex;flex-direction:column;gap:.35rem"><label>LTE-only mode — turn ON for JIO SIM (auto for Airtel/VI/BSNL)<input id="cLteOnly" type="checkbox"'+(d.lteOnly?' checked':'')+' style="width:auto;margin-left:.4rem"></label></div><div></div></div>'+
  '<div class="row"><div><label>MQTT Host</label><input id="cMqttH" value="'+h(d.mqttHost||'')+'"></div>'+
  '<div><label>MQTT Port</label><input id="cMqttP" value="'+h(d.mqttPort||1883)+'" type="number"></div></div>'+
  '<div class="row"><div><label>MQTT User</label><input id="cMqttU" value="'+h(d.mqttUser||'')+'"></div>'+
  '<div><label>MQTT Pass</label><input id="cMqttPw" type="password" placeholder="(unchanged)"></div></div>'+
  '<div class="row"><div><label>API Host</label><input id="cApiH" value="'+h(d.apiHost||'')+'"></div>'+
  '<div><label>WiFi STA SSID</label><input id="cWifiS" value="'+h(d.wifiSsid||'')+'"></div></div>'+
  '<div class="row"><div><label>WiFi STA Pass</label><input id="cWifiP" type="password" placeholder="(unchanged)"></div>'+
  '<div><label>Admin Password</label><input id="cAdminPw" type="password" placeholder="(unchanged)"></div></div>'+
  '<div class="row"><div><label>SMS Alert Numbers (comma-separated E.164)</label><input id="cSmsNums" value="'+h(d.smsNumbers||'')+'" placeholder="+91XXXXXXXXXX,+91XXXXXXXXXX"></div>'+
  '<div style="display:flex;flex-direction:column;gap:.35rem"><label>SMS Enabled<input id="cSmsEn" type="checkbox"'+(d.smsEnabled?' checked':'')+' style="width:auto;margin-left:.4rem"></label>'+
  '<button class="act sec" style="margin-top:.35rem" onclick="testSms()">Send Test SMS</button></div></div>'+
  '<div style="margin-top:.75rem;display:flex;gap:.5rem">'+
  '<button class="act" onclick="saveConfig()">Save &amp; Reboot</button>'+
  '<button class="act sec" onclick="exportConfig()">Export JSON</button>'+
  '<button class="danger act" onclick="factoryReset()">Factory Reset</button></div>'+
  '</div>'+
  '<div class="card"><h2>Device Token</h2><p style="font-size:.8rem;color:#94a3b8">Shown once — used for VPS API auth (X-Gateway-Token)</p>'+
  '<p style="font-size:.85rem;word-break:break-all;color:#22c55e">'+h(d.token||'(not available)')+'</p></div>';
}
function saveConfig(){
  if(!checkAuth())return;
  var body={env:document.getElementById('cEnv').value,siteId:document.getElementById('cSite').value,gatewayId:document.getElementById('cGw').value,apn:document.getElementById('cApn').value,mqttHost:document.getElementById('cMqttH').value,mqttPort:parseInt(document.getElementById('cMqttP').value),mqttUser:document.getElementById('cMqttU').value,apiHost:document.getElementById('cApiH').value,wifiSsid:document.getElementById('cWifiS').value,smsNumbers:document.getElementById('cSmsNums').value,smsEnabled:document.getElementById('cSmsEn').checked,lteOnly:document.getElementById('cLteOnly').checked};
  var p=document.getElementById('cMqttPw').value;if(p)body.mqttPass=p;
  var wp=document.getElementById('cWifiP').value;if(wp)body.wifiPass=wp;
  var ap=document.getElementById('cAdminPw').value;if(ap)body.adminPass=ap;
  fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':_tok},body:JSON.stringify(body)}).then(function(r){if(r.ok)toast('Saved — rebooting','ok');else r.text().then(function(t){toast('Error: '+t,'bad');});}).catch(function(e){toast('Error: '+e,'bad');});
}
function testSms(){
  if(!checkAuth())return;
  fetch('/api/sms/test',{method:'POST',headers:{'X-Admin-Token':_tok}}).then(function(r){return r.json();}).then(function(d){if(d.ok)toast('Test SMS sent','ok');else toast('SMS failed: '+(d.error||'unknown'),'bad');}).catch(function(e){toast('Error: '+e,'bad');});
}
function exportConfig(){
  fetch('/api/config/export').then(function(r){return r.json();}).then(function(d){
    var a=document.createElement('a');a.href='data:application/json,'+encodeURIComponent(JSON.stringify(d,null,2));a.download='fireguard-config.json';a.click();
  });
}
function factoryReset(){
  if(!checkAuth())return;
  if(!confirm('Factory reset? All config lost!'))return;
  fetch('/api/factory-reset',{method:'POST',headers:{'X-Admin-Token':_tok}}).then(function(){toast('Reset — rebooting','warn');});
}

// ---- MODBUS TAB ----
function loadModbus(){
  document.getElementById('modbus').innerHTML=
  '<div class="card"><h2>RS485 Scan</h2>'+
  '<div class="row3"><div><label>Slave range 1–</label><input id="mbMax" type="number" value="16" min="1" max="247"></div>'+
  '<div><label>FC</label><select id="mbFc"><option value="3">FC03 Holding</option><option value="4">FC04 Input</option></select></div>'+
  '<div style="align-self:end"><button class="act" onclick="doScan()">Scan</button></div></div>'+
  '<div id="scanRes" style="margin-top:.75rem"></div></div>'+
  '<div class="card"><h2>Read Register</h2>'+
  '<div class="row3"><div><label>Slave</label><input id="rSlave" type="number" value="1" min="1" max="247"></div>'+
  '<div><label>FC</label><select id="rFc"><option value="3">FC03</option><option value="4">FC04</option></select></div>'+
  '<div><label>Address</label><input id="rAddr" type="number" value="0" min="0" max="65535"></div></div>'+
  '<div class="row3"><div><label>Count</label><input id="rCount" type="number" value="1" min="1" max="4"></div>'+
  '<div style="align-self:end"><button class="act" onclick="doRead()">Read</button></div></div>'+
  '<div id="readRes" style="margin-top:.75rem"></div></div>';
}
function doScan(){
  document.getElementById('scanRes').innerHTML='<span>Scanning<span class="spinner"></span></span>';
  var max=document.getElementById('mbMax').value;
  fetch('/api/modbus/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({maxSlave:parseInt(max)})}).then(function(r){return r.json();}).then(function(d){
    if(d.found&&d.found.length){var html='<table><tr><th>Slave</th><th>Status</th></tr>';d.found.forEach(function(s){html+='<tr><td>'+s+'</td><td class="ok">Responding</td></tr>';});document.getElementById('scanRes').innerHTML=html+'</table>';}else{document.getElementById('scanRes').innerHTML='<span class="warn">No devices found</span>';}
  }).catch(function(){document.getElementById('scanRes').innerHTML='<span class="bad">Scan failed</span>';});
}
function doRead(){
  document.getElementById('readRes').innerHTML='<span>Reading<span class="spinner"></span></span>';
  var body={slave:parseInt(document.getElementById('rSlave').value),fc:parseInt(document.getElementById('rFc').value),addr:parseInt(document.getElementById('rAddr').value),count:parseInt(document.getElementById('rCount').value)};
  fetch('/api/modbus/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(d){
    document.getElementById('readRes').innerHTML='<table><tr><th>Key</th><th>Value</th></tr>'+
    '<tr><td>raw[]</td><td>'+JSON.stringify(d.raw)+'</td></tr>'+
    '<tr><td>value</td><td>'+d.value+'</td></tr>'+
    '<tr><td>ok</td><td class="'+(d.ok?'ok':'bad')+'">'+(d.ok?'yes':'no')+'</td></tr></table>';
  }).catch(function(){document.getElementById('readRes').innerHTML='<span class="bad">Read failed</span>';});
}

// ---- ALARMS TAB ----
function loadAlarms(){
  fetch('/api/alarms').then(function(r){return r.json();}).then(function(d){
    if(!d.length){document.getElementById('alarms').innerHTML='<div class="card"><h2>Active Alarms</h2><p class="ok">No active alarms</p></div>';return;}
    var html='<div class="card"><h2>Active Alarms ('+d.length+')</h2><table><tr><th>ID</th><th>Tag</th><th>Param</th><th>Value</th><th>Sev</th><th>Ack</th><th></th></tr>';
    d.forEach(function(a){html+='<tr><td>'+h(a.alarmId)+'</td><td>'+h(a.tag)+'</td><td>'+h(a.parameter)+'</td><td>'+h(a.value)+'</td><td class="'+(a.severity==='critical'?'bad':'warn')+'">'+h(a.severity)+'</td><td>'+(a.acknowledged?'<span class="ok">yes</span>':'no')+'</td><td>'+(a.acknowledged?'':'<button class="act" onclick="ackAlarm(\''+h(a.tag)+'\')">Ack</button>')+'</td></tr>';});
    document.getElementById('alarms').innerHTML=html+'</table></div>';
  });
}
function ackAlarm(tag){
  if(!checkAuth())return;
  fetch('/api/alarms/ack',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':_tok},body:JSON.stringify({alarmId:tag})}).then(function(r){if(r.ok){toast('Acknowledged','ok');loadAlarms();}else toast('Error','bad');});
}

// ---- OTA TAB ----
function loadOta(){
  fetch('/api/ota/status').then(function(r){return r.json();}).then(function(d){
    document.getElementById('ota').innerHTML=
    '<div class="card"><h2>OTA Status</h2><table>'+
    '<tr><td>Current FW</td><td>'+h(d.fw)+'</td></tr>'+
    '<tr><td>Pending Update</td><td>'+(d.updateAvail?('<span class="warn">'+h(d.pendingVer)+'</span>'):'<span class="ok">none</span>')+'</td></tr>'+
    '</table></div>'+
    '<div class="card"><h2>VPS OTA</h2>'+
    '<div style="display:flex;gap:.5rem;flex-wrap:wrap">'+
    '<button class="act" onclick="otaCheck()">Check Manifest</button>'+
    '<button class="act" onclick="otaUpdate()">Apply Update</button>'+
    '</div><div id="otaRes" style="margin-top:.75rem"></div></div>'+
    '<div class="card"><h2>Local Upload (.bin)</h2>'+
    '<label><input type="checkbox" id="skipBk"> Skip backup gate (offline emergency)</label>'+
    '<p style="margin-top:.5rem"><a href="/update" style="color:#f97316">Open ElegantOTA Upload Page</a></p>'+
    '<p style="font-size:.75rem;color:#94a3b8;margin-top:.25rem">The ElegantOTA page performs pre-OTA backup by default. Check "skip" above before navigating to /update to bypass it.</p>'+
    '</div>';
  });
}
function otaCheck(){
  document.getElementById('otaRes').innerHTML='<span>Checking<span class="spinner"></span></span>';
  fetch('/api/ota/check',{method:'POST',headers:{'X-Admin-Token':_tok}}).then(function(r){return r.json();}).then(function(d){
    document.getElementById('otaRes').innerHTML=d.updateAvailable?('<span class="warn">Update available: '+h(d.version)+'</span>'):('<span class="ok">Firmware up to date</span>');
    loadOta();
  }).catch(function(){document.getElementById('otaRes').innerHTML='<span class="bad">Check failed</span>';});
}
function otaUpdate(){
  if(!checkAuth())return;
  if(!confirm('Apply OTA update? Device will reboot.'))return;
  document.getElementById('otaRes').innerHTML='<span>Downloading<span class="spinner"></span></span>';
  fetch('/api/ota/update',{method:'POST',headers:{'X-Admin-Token':_tok}}).then(function(r){return r.json();}).then(function(d){
    document.getElementById('otaRes').innerHTML=d.ok?'<span class="ok">OTA applied — rebooting</span>':'<span class="bad">OTA failed: '+h(d.error)+'</span>';
  }).catch(function(){document.getElementById('otaRes').innerHTML='<span class="bad">Request failed</span>';});
}

// ---- Boot ----
initAuth();loadStatus();loadModbus();
_si=setInterval(function(){if(_tab==='status')loadStatus();if(_tab==='alarms')loadAlarms();},10000);
</script>
</body></html>
)rawhtml";
