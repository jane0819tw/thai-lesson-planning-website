/**
 * Config.gs — 全部可調整的設定集中在這裡。
 * 金鑰（之後的 Zoom）不要寫在這個檔案，要放在「專案設定 → 指令碼屬性」。
 */
var TZ = 'Asia/Taipei';
var LABEL_NAME = 'AmazingTalker';        // Gmail 標籤名稱（由篩選條件自動套用）
var LOOKBACK_DAYS = 30;                  // 每次往前看幾天內的信（已處理過的信不會重複處理）
var CALENDAR_NAME = '泰時刻課表';          // 專用行事曆名稱；不存在時會自動建立
var REMIND_HOURS_BEFORE_EXPIRY = 4;      // 請求過期前幾小時寄提醒信
var SYNC_EVERY_MINUTES = 10;             // 自動同步的間隔
var SOURCE_AT = 'AmazingTalker';         // 「來源」欄位的值
