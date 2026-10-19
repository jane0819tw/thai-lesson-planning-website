/**
 * Menu.gs — 試算表上方的「泰時刻」選單與觸發器安裝。
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('泰時刻')
    .addItem('立即同步 AmazingTalker 信件', 'syncNow')
    .addItem('安裝自動同步（只需做一次）', 'installTriggers')
    .addSeparator()
    .addItem('初始化分頁', 'setupSheets')
    .addToUi();
}

function setupSheets() {
  initSheets_();
  SpreadsheetApp.getActive().toast('分頁已建立：預約、學生、信件紀錄', '泰時刻', 5);
}

function syncNow() {
  var s = syncAll();
  if (!s) {
    SpreadsheetApp.getActive().toast('另一個同步正在執行，請稍後再試', '泰時刻', 5);
    return;
  }
  SpreadsheetApp.getActive().toast(
    '新請求 ' + s.newRequests + '、取消 ' + s.cancels + '、過期 ' + s.expired +
    '、需人工確認 ' + s.manual + '、無法解析 ' + s.unknown,
    '同步完成', 8
  );
}

/** 建立兩個觸發器：每 10 分鐘自動同步；「狀態」欄被修改時立即更新行事曆。 */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'syncAll' || fn === 'onBookingEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(SYNC_EVERY_MINUTES).create();
  ScriptApp.newTrigger('onBookingEdit').forSpreadsheet(getSpreadsheet_()).onEdit().create();
  SpreadsheetApp.getActive().toast('已安裝：每 ' + SYNC_EVERY_MINUTES + ' 分鐘自動同步，修改狀態會立即更新行事曆', '泰時刻', 8);
}
