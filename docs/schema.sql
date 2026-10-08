-- 未來把 data/lessons/*.json 搬進資料庫時的關聯式結構（Cloud SQL / PostgreSQL）。
-- 若選 Firestore：一課一份文件、子集合對應各表即可。目前階段不需要，JSON 即資料庫。
CREATE TABLE lesson (
  id TEXT PRIMARY KEY, number INT UNIQUE NOT NULL, title TEXT NOT NULL,
  summary TEXT, status TEXT NOT NULL DEFAULT 'draft'
);
CREATE TABLE rule (
  id TEXT PRIMARY KEY, lesson_id TEXT REFERENCES lesson(id), title TEXT, body TEXT, strokes JSONB
);
CREATE TABLE consonant (
  id TEXT PRIMARY KEY, lesson_id TEXT REFERENCES lesson(id), char TEXT, name TEXT, name_roman TEXT,
  name_zh TEXT, initial TEXT, final TEXT, class TEXT, audio_url TEXT
);
CREATE TABLE vowel (
  id TEXT PRIMARY KEY, lesson_id TEXT REFERENCES lesson(id), char TEXT, with_carrier TEXT, roman TEXT,
  length TEXT, position TEXT, example TEXT, audio_url TEXT
);
CREATE TABLE word (
  id TEXT PRIMARY KEY, thai TEXT NOT NULL, roman TEXT, zh TEXT, tone TEXT, note TEXT, audio_url TEXT
);
-- 單字可跨課重複出現：用關聯表
CREATE TABLE lesson_word (lesson_id TEXT REFERENCES lesson(id), word_id TEXT REFERENCES word(id), PRIMARY KEY (lesson_id, word_id));
CREATE TABLE sentence (
  id TEXT PRIMARY KEY, lesson_id TEXT REFERENCES lesson(id), segments JSONB, roman TEXT, zh TEXT, audio_url TEXT
);
CREATE TABLE meme (lesson_id TEXT PRIMARY KEY REFERENCES lesson(id), idea TEXT, caption TEXT, image_url TEXT);
