-- VRLMCraft Online - schema (SQLite / sql.js)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  pass_hash TEXT NOT NULL,
  character_id INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_seen INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Mundos salvos pelo jogador (cenarios que ele criou)
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  seed INTEGER NOT NULL,
  is_shared INTEGER DEFAULT 0,
  data TEXT,            -- JSON: blocos modificados, spawn, etc.
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Cenarios padrao gerados pelo "diretor" procedural (IA) a partir da jogabilidade
CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seed INTEGER NOT NULL,
  params TEXT NOT NULL, -- JSON com parametros do bioma/estruturas
  origin TEXT,          -- como foi gerado (director/base)
  plays INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Estatisticas agregadas de jogabilidade (alimentam o diretor de cenarios)
CREATE TABLE IF NOT EXISTS play_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  blocks_broken INTEGER DEFAULT 0,
  blocks_placed INTEGER DEFAULT 0,
  depth_reached INTEGER DEFAULT 0,
  water_used INTEGER DEFAULT 0,
  wood_used INTEGER DEFAULT 0,
  stone_used INTEGER DEFAULT 0,
  torches_used INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Salas / lobbies multiplayer online
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  world_id TEXT,
  name TEXT,
  invite_code TEXT UNIQUE,
  created_at INTEGER NOT NULL
);

-- Presentes do evento
CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,     -- tipo do presente
  amount INTEGER DEFAULT 1,
  from_event INTEGER DEFAULT 1,
  stolen_from TEXT,       -- se foi "pego" de outro jogador no evento
  created_at INTEGER NOT NULL,
  consumed INTEGER DEFAULT 0
);

-- Registro de eventos (historico)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  scenario_id TEXT,
  status TEXT DEFAULT 'scheduled'
);
