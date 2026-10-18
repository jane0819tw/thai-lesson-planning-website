/**
 * 老師的 LINE 通知（Messaging API push）。金鑰只放「專案設定 → 指令碼屬性」：
 * LINE_CHANNEL_TOKEN（Messaging API 的 Channel access token，long-lived）、LINE_USER_ID（老師自己的 User ID，U 開頭）。
 * 沒設定或發送失敗都只記錄、不影響預約流程。
 */

function lineConfigured_() {
  const p = PropertiesService.getScriptProperties();
  return !!(p.getProperty('LINE_CHANNEL_TOKEN') && p.getProperty('LINE_USER_ID'));
}

function notifyTeacher_(text) {
  if (!lineConfigured_()) return;
  const p = PropertiesService.getScriptProperties();
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post', muteHttpExceptions: true, contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + p.getProperty('LINE_CHANNEL_TOKEN') },
      payload: JSON.stringify({ to: p.getProperty('LINE_USER_ID'), messages: [{ type: 'text', text: text }] }),
    });
    if (res.getResponseCode() !== 200) console.error('LINE 通知失敗 ' + res.getResponseCode() + '：' + res.getContentText());
  } catch (e) { console.error('LINE 通知失敗：' + e.message); }
}

/** 在 Apps Script 手動執行一次，確認金鑰與 User ID 正確（老師的 LINE 會收到測試訊息）。 */
function testLineNotify() {
  if (!lineConfigured_()) throw new Error('請先在指令碼屬性設定 LINE_CHANNEL_TOKEN 與 LINE_USER_ID');
  notifyTeacher_('泰時刻約課系統：LINE 通知測試成功');
}
