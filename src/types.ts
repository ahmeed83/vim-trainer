export type VimMode = 'normal' | 'insert' | 'visual' | 'command';

export interface CursorPosition {
  line: number;
  col: number;
}

export interface Selection {
  start: CursorPosition;
  end: CursorPosition;
}

export interface EditorState {
  lines: string[];
  cursor: CursorPosition;
  mode: VimMode;
  selection: Selection | null;
  commandBuffer: string;
  registers: Record<string, string>;
  lastSearch: string;
  message: string;
}

export interface LessonStep {
  instruction: string;
  hint: string;
  validate: (state: EditorState, prevState: EditorState | null) => boolean;
  initialContent?: string[];
  initialCursor?: CursorPosition;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  keys: string;
  icon: string;
  steps: LessonStep[];
}

export interface ReferenceCommand {
  key: string;
  description: string;
}

export interface ReferenceCategory {
  title: string;
  commands: ReferenceCommand[];
}
