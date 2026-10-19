/** 第一版設定。第二版會搬到「設定」分頁。 */
const CONFIG = {
  TZ: 'Asia/Taipei',
  GMAIL_LABEL: 'AmazingTalker',
  SYNC_EVERY_MINUTES: 10,
  SLOT_MINUTES: 30,
  ALLOWED_LENGTHS: [25, 50],
  REQUEST_VALID_HOURS: 24,      // 信裡抓不到過期時間時的備用值
  REMINDER_HOURS_BEFORE_EXPIRY: 4,
  IMPORT_AFTER: '2026-10-13',   // 只處理這天（含）之後收到的信，避免舊信被當成新請求；空白 = 全部
  CALENDAR_ID: '',              // 空白 = Jane 的預設行事曆
  ADMIN_URL: 'https://jane0819tw.github.io/thaiskr-course-reservation/admin.html', // 老師 LINE 通知附上的管理頁連結
  NOTIFY_EMAIL: '',             // 空白 = 執行者自己的 Email
  BOOKING_DAYS_AHEAD: 92,       // 預約頁顯示未來幾天（約三個月）
  MIN_NOTICE_HOURS: 12,         // 至少提前幾小時才能預約
  SHEETS: { BOOKINGS: '預約', STUDENTS: '學生', LOG: '信件紀錄', RULES: '開放時段' },
};

const STATUS = {
  PENDING: '待確認', CONFIRMED: '已確認', REJECTED: '已拒絕',
  EXPIRED: '已過期', CANCELLED: '已取消', MANUAL: '請人工確認',
};

const BOOKING_HEADERS = ['編號', '來源', '學生', '平台顯示名稱', '開始', '實際結束', '佔用結束', '課長',
  '狀態', 'Zoom連結', '行事曆事件編號', '信件編號', '請求過期時間', '提醒已寄', '取消原因', '備註', '建立時間', '會議編號', '確認信已寄'];
const STUDENT_HEADERS = ['姓名', '平台顯示名稱', 'Email', '備註', '預約代碼', '課程記錄表']; // 課程記錄表＝該學生那份記錄試算表的網址
const RULE_HEADERS = ['類型', '星期', '日期', '開始', '結束', '說明']; // 類型：每週＝常規；單次＝單日加開；限定＝單日只開放這段（覆蓋常規）；休假＝整天不開放（說明會顯示給學生）
const LOG_HEADERS = ['信件編號', '處理時間', '類型', '結果', '標題'];

/** 「開放時段」分頁完全是空的時，setup 會寫入這份預設的每週固定時間（週一=1 … 週日=7） */
const DEFAULT_WEEKLY = [
  { days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '12:00' },
  { days: [1, 2, 3, 4, 5, 6], start: '18:30', end: '23:00' },
  { days: [2, 5],             start: '14:00', end: '17:00' },
  { days: [6],                start: '13:00', end: '15:00' },
];
