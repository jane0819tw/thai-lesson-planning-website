/**
 * Zoom（Server-to-Server OAuth）。金鑰只放在「專案設定 → 指令碼屬性」：
 * ZOOM_ACCOUNT_ID、ZOOM_CLIENT_ID、ZOOM_CLIENT_SECRET。不出現在程式碼、試算表或網頁。
 * 應用程式需要的權限：meeting:write:meeting:admin、meeting:delete:meeting:admin（或 meeting:write / meeting:delete）。
 */

function zoomConfigured_() {
  const p = PropertiesService.getScriptProperties();
  return !!(p.getProperty('ZOOM_ACCOUNT_ID') && p.getProperty('ZOOM_CLIENT_ID') && p.getProperty('ZOOM_CLIENT_SECRET'));
}

function zoomToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('zoom_token');
  if (cached) return cached;
  const p = PropertiesService.getScriptProperties();
  const res = UrlFetchApp.fetch('https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + encodeURIComponent(p.getProperty('ZOOM_ACCOUNT_ID')), {
    method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(p.getProperty('ZOOM_CLIENT_ID') + ':' + p.getProperty('ZOOM_CLIENT_SECRET')) },
  });
  const j = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200 || !j.access_token) throw new Error('Zoom 授權失敗：' + (j.reason || j.error || res.getResponseCode()));
  cache.put('zoom_token', j.access_token, 3000);
  return j.access_token;
}

function zoomApi_(method, path, body) {
  const res = UrlFetchApp.fetch('https://api.zoom.us/v2' + path, {
    method: method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + zoomToken_() }, payload: body ? JSON.stringify(body) : undefined,
  });
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code >= 300) { let m = text; try { m = JSON.parse(text).message; } catch (e) {} throw new Error('Zoom API ' + code + '：' + m); }
  return text ? JSON.parse(text) : {};
}

/** @return {{id:string, joinUrl:string}} 時間與長度同預約（實際上課長度，不是佔用長度） */
function zoomCreateMeeting_(topic, startStr, minutes) {
  const m = zoomApi_('post', '/users/me/meetings', {
    topic: topic, type: 2, start_time: startStr.replace(' ', 'T') + ':00', timezone: CONFIG.TZ, duration: minutes,
    settings: { join_before_host: true, waiting_room: false, host_video: true, participant_video: true },
  });
  return { id: String(m.id), joinUrl: m.join_url };
}

function zoomDeleteMeeting_(id) { zoomApi_('delete', '/meetings/' + id); }

function zoomPatchMeeting_(id, startStr, minutes) {
  zoomApi_('patch', '/meetings/' + id, { start_time: startStr.replace(' ', 'T') + ':00', timezone: CONFIG.TZ, duration: minutes });
}

/** 設定完金鑰後手動執行一次：成功會在「執行記錄」印出測試會議的連結，並立刻刪掉那場會議。 */
function testZoom() {
  if (!zoomConfigured_()) throw new Error('還沒設定 ZOOM_ACCOUNT_ID、ZOOM_CLIENT_ID、ZOOM_CLIENT_SECRET');
  const m = zoomCreateMeeting_('泰時刻 Zoom 測試', toLocalStr_(new Date(Date.now() + 86400000)), 25);
  Logger.log('建立成功：' + m.joinUrl);
  zoomDeleteMeeting_(m.id);
  Logger.log('已刪除測試會議，Zoom 設定完成');
}
