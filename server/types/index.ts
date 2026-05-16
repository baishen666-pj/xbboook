export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  writing_style: string | null;
  writing_mode: string;
  target_words: number | null;
  daily_target: number;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Volume {
  id: string;
  project_id: string;
  title: string;
  summary: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  project_id: string;
  volume_id: string | null;
  title: string;
  summary: string | null;
  word_count: number;
  file_path: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  nickname: string | null;
  role_type: string;
  gender: string | null;
  age: string | null;
  appearance: string | null;
  personality: string | null;
  background: string | null;
  abilities: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  speech_style: string | null;
  verbal_tics: string | null;
  vocabulary_level: string;
  sentence_length_pref: string;
  emotional_expressiveness: string;
  voice_examples: string | null;
}

export interface CharacterRelation {
  id: string;
  project_id: string;
  character_a_id: string;
  character_b_id: string;
  relation_type: string;
  description: string | null;
  created_at: string;
}

export interface Worldview {
  id: string;
  project_id: string;
  category: string;
  title: string;
  content: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Outline {
  id: string;
  project_id: string;
  level: number;
  parent_id: string | null;
  target_ref_id: string | null;
  title: string;
  content: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DailyStat {
  id: string;
  project_id: string;
  date: string;
  words_added: number;
  words_total: number;
  writing_time_ms: number;
  chapters_worked: number;
}

export interface ChapterVersion {
  id: string;
  chapter_id: string;
  project_id: string;
  version_number: number;
  content_hash: string;
  word_count: number;
  snapshot_type: 'auto' | 'manual' | 'rollback';
  label: string | null;
  created_at: string;
}

export interface TemplateNode {
  title: string;
  content?: string;
  level: number;
}

export interface OutlineTemplate {
  id: string;
  name: string;
  genre: string;
  description: string | null;
  is_builtin: number;
  source_project_id: string | null;
  structure: string;
  created_at: string;
  updated_at: string;
}

export interface Foreshadowing {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  plant_chapter_id: string | null;
  expected_harvest_chapter_id: string | null;
  actual_harvest_chapter_id: string | null;
  status: 'planted' | 'harvested' | 'forgotten';
  importance: 'critical' | 'important' | 'normal' | 'minor';
  created_at: string;
  updated_at: string;
}

export interface SnippetTemplate {
  id: number;
  project_id: string | null;
  name: string;
  category: string;
  content: string;
  is_builtin: number;
  sort_order: number;
  created_at: string;
}

export interface StoryArc {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_chapter: number | null;
  end_chapter: number | null;
  status: 'planned' | 'active' | 'completed' | 'abandoned';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlotThread {
  id: string;
  project_id: string;
  arc_id: string | null;
  name: string;
  description: string | null;
  status: 'open' | 'resolved' | 'dormant' | 'abandoned';
  priority: 'critical' | 'high' | 'normal' | 'low';
  sort_order: number;
  created_at: string;
  updated_at: string;
}
