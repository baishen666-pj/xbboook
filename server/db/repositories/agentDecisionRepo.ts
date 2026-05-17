import { v4 as uuid } from 'uuid';
import { getDb } from '../database.js';

export interface AgentDecision {
  id: string;
  session_id: string;
  iteration: number;
  decision_type: 'plan' | 'draft_segment' | 'self_review' | 'revision' | 'accept' | 'reject';
  input_summary: string;
  output_summary: string;
  reasoning: string;
  token_usage: number;
  created_at: string;
}

export function create(
  sessionId: string,
  iteration: number,
  decisionType: AgentDecision['decision_type'],
  inputSummary: string,
  outputSummary: string,
  reasoning: string,
  tokenUsage = 0,
): AgentDecision {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO agent_decisions (id, session_id, iteration, decision_type, input_summary, output_summary, reasoning, token_usage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, sessionId, iteration, decisionType, inputSummary, outputSummary, reasoning, tokenUsage, now);
  return findById(id)!;
}

export function findById(id: string): AgentDecision | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM agent_decisions WHERE id = ?').get(id) as AgentDecision | undefined;
}

export function findBySession(sessionId: string): AgentDecision[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM agent_decisions WHERE session_id = ? ORDER BY iteration ASC, created_at ASC',
  ).all(sessionId) as AgentDecision[];
}

export function findBySessionIteration(sessionId: string, iteration: number): AgentDecision[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM agent_decisions WHERE session_id = ? AND iteration = ? ORDER BY created_at ASC',
  ).all(sessionId, iteration) as AgentDecision[];
}

export function deleteBySession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM agent_decisions WHERE session_id = ?').run(sessionId);
}
