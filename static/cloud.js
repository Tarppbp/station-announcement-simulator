'use strict';
// Store a directory handle in this browser; Google Drive for desktop performs the sync.
let cloudFolder = null;
const cloudMessage = text => toast(text);
function cloudDB() {
 return new Promise((resolve, reject) => {
  const req = indexedDB.open('station-sim-cloud', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('settings');
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
 });
}
async function cloudStore(value, write) {
 const db = await cloudDB();
 try { return await new Promise((resolve, reject) => {
  const tx = db.transaction('settings', write ? 'readwrite' : 'readonly');
  const req = write ? tx.objectStore('settings').put(value, 'folder') : tx.objectStore('settings').get('folder');
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
 }) } finally { db.close() }
}
async function chooseCloudFolder(force = false) {
 if (!window.showDirectoryPicker) throw Error('请用 Chrome 或 Edge 打开网页，并在电脑上使用云盘按钮。');
 if (!force && !cloudFolder) { try { cloudFolder = await cloudStore(null, false) } catch (_) {} }
 if (!force && cloudFolder) {
  const opt = {mode: 'readwrite'};
  if (await cloudFolder.queryPermission(opt) === 'granted' || await cloudFolder.requestPermission(opt) === 'granted') return cloudFolder;
  throw Error('未获得文件夹写入权限。');
 }
 const chosen = await window.showDirectoryPicker({mode: 'readwrite', id: 'station-sim-drive'});
 if (chosen.name !== '报站模拟器录音') throw Error('请选择 Google Drive 中名为“报站模拟器录音”的文件夹。');
 cloudFolder = chosen;
 try { await cloudStore(chosen, true) } catch (_) { /* valid for this page until it closes */ }
 return chosen;
}
function safeRecordingName(name) { return String(name || '报站').replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ').trim().slice(0, 60) || '报站' }
async function uploadRecording(url, name, button) {
 if (!/^\/data\/[0-9a-f]{32}\/(?:saved-[0-9a-f]{24}|result-[0-9a-f]{32})\.wav(?:\?.*)?$/.test(url || '')) return;
 button.disabled = true;
 try {
  const statusResponse = await fetch('/api/cloud/status');
  const status = statusResponse.ok ? await statusResponse.json() : {available: false};
  if (status.available) {
   cloudMessage('正在保存到云盘同步文件夹……');
   const response = await fetch('/api/cloud/upload', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url, name})});
   const result = await response.json();
   if (!response.ok) throw Error(result.detail || '无法保存录音');
   cloudMessage('已放入云盘同步文件夹。请等待 Google Drive 桌面版同步完成，再在其他设备打开。');
   return;
  }
  const folder = await chooseCloudFolder();
  cloudMessage('正在保存到云盘同步文件夹……');
  const res = await fetch(url); if (!res.ok) throw Error('找不到这段本地录音，请重新生成。');
  const blob = await res.blob(); if (!blob.size) throw Error('录音文件为空，请重新生成。');
  const stamp = new Date().toLocaleString('sv-SE').replace(/[: ]/g, '-');
  const filename = `${safeRecordingName(name)}-${stamp}-${Math.random().toString(36).slice(2, 6)}.wav`;
  const file = await folder.getFileHandle(filename, {create: true});
  const out = await file.createWritable();
  try { await out.write(blob); await out.close() } catch (err) { try { await out.abort() } catch (_) {} throw err }
  cloudMessage('已放入云盘同步文件夹。请等待 Google Drive 桌面版同步完成，再在其他设备打开。');
 } catch (e) {
  cloudMessage(e.name === 'AbortError' ? '已取消选择文件夹，没有上传。' : (e.message || '保存失败，请检查云盘文件夹和权限。'));
 } finally { button.disabled = false }
}
