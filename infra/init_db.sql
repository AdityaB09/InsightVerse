CREATE EXTENSION IF NOT EXISTS vector;

-- documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL,         -- filename or user label
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  token_count INT DEFAULT 0
);

-- chunks (each vectorized)
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  text TEXT NOT NULL,
  embedding vector(1536) NOT NULL
);

-- chat history (optional memory per thread)
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,           -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- graph nodes & edges (very simple derived structure)
CREATE TABLE IF NOT EXISTS graph_nodes (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  weight REAL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id UUID PRIMARY KEY,
  src UUID REFERENCES graph_nodes(id) ON DELETE CASCADE,
  dst UUID REFERENCES graph_nodes(id) ON DELETE CASCADE,
  weight REAL DEFAULT 1.0
);

-- basic ANN index on chunks
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
