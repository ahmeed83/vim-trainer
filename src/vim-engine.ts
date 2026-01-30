import { CursorPosition, EditorState, Selection } from './types';

export class VimEngine {
  private state: EditorState;
  private onStateChange: ((state: EditorState) => void) | null = null;
  private commandTimeout: number | null = null;
  private countBuffer: string = '';

  constructor(initialContent: string[] = ['']) {
    this.state = {
      lines: [...initialContent],
      cursor: { line: 0, col: 0 },
      mode: 'normal',
      selection: null,
      commandBuffer: '',
      registers: { '"': '' },
      lastSearch: '',
      message: '',
    };
  }

  getState(): EditorState {
    return { ...this.state };
  }

  setState(partial: Partial<EditorState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyChange();
  }

  setContent(lines: string[]): void {
    this.state.lines = [...lines];
    this.state.cursor = { line: 0, col: 0 };
    this.state.mode = 'normal';
    this.state.selection = null;
    this.state.commandBuffer = '';
    this.notifyChange();
  }

  setCursor(cursor: CursorPosition): void {
    this.state.cursor = this.clampCursor(cursor);
    this.notifyChange();
  }

  onChange(callback: (state: EditorState) => void): void {
    this.onStateChange = callback;
  }

  private notifyChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  private clampCursor(cursor: CursorPosition): CursorPosition {
    const line = Math.max(0, Math.min(cursor.line, this.state.lines.length - 1));
    const lineLength = this.state.lines[line]?.length || 0;
    const maxCol = this.state.mode === 'insert' ? lineLength : Math.max(0, lineLength - 1);
    const col = Math.max(0, Math.min(cursor.col, maxCol));
    return { line, col };
  }

  private getCurrentLine(): string {
    return this.state.lines[this.state.cursor.line] || '';
  }

  private setCurrentLine(text: string): void {
    this.state.lines[this.state.cursor.line] = text;
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    const key = e.key;
    const ctrl = e.ctrlKey;
    const shift = e.shiftKey;

    // Prevent browser defaults for vim keys
    if (this.state.mode !== 'insert' || e.key === 'Escape') {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Tab'].includes(key)) {
        e.preventDefault();
      }
    }

    switch (this.state.mode) {
      case 'normal':
        return this.handleNormalMode(key, ctrl, shift, e);
      case 'insert':
        return this.handleInsertMode(key, ctrl, e);
      case 'visual':
        return this.handleVisualMode(key, ctrl, shift, e);
      case 'command':
        return this.handleCommandMode(key, e);
    }
  }

  private handleNormalMode(key: string, _ctrl: boolean, _shift: boolean, _e: KeyboardEvent): boolean {
    // Clear command buffer timeout
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
      this.commandTimeout = null;
    }

    // Handle count prefix
    if (/^[1-9]$/.test(key) || (this.countBuffer && /^[0-9]$/.test(key))) {
      this.countBuffer += key;
      this.state.commandBuffer = this.countBuffer;
      this.notifyChange();
      return true;
    }

    const count = parseInt(this.countBuffer) || 1;
    this.countBuffer = '';

    // Handle multi-char commands
    const buffer = this.state.commandBuffer + key;

    // Two-char commands
    if (buffer === 'dd') {
      this.deleteLine(count);
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    if (buffer === 'yy') {
      this.yankLine(count);
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    if (buffer === 'cc') {
      this.changeLine();
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    if (buffer === 'gg') {
      this.state.cursor = { line: 0, col: 0 };
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    if (buffer === 'dw') {
      this.deleteWord(count);
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    if (buffer === 'cw') {
      this.changeWord();
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    if (buffer === 'di"' || buffer === 'di\'') {
      this.deleteInQuotes(buffer[2]);
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    if (buffer === 'ci"' || buffer === 'ci\'') {
      this.changeInQuotes(buffer[2]);
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    // Waiting for second char
    if (['d', 'c', 'y', 'g', 'f', 'F', 't', 'T', 'r'].includes(key) && buffer === key) {
      this.state.commandBuffer = key;
      this.commandTimeout = window.setTimeout(() => {
        this.state.commandBuffer = '';
        this.notifyChange();
      }, 1000);
      this.notifyChange();
      return true;
    }

    // Handle 'r' replace
    if (this.state.commandBuffer === 'r' && key.length === 1) {
      const line = this.getCurrentLine();
      const col = this.state.cursor.col;
      this.setCurrentLine(line.substring(0, col) + key + line.substring(col + 1));
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    // Handle 'f' find char
    if (this.state.commandBuffer === 'f' && key.length === 1) {
      const line = this.getCurrentLine();
      const idx = line.indexOf(key, this.state.cursor.col + 1);
      if (idx !== -1) {
        this.state.cursor.col = idx;
      }
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    // Handle 'F' find char backwards
    if (this.state.commandBuffer === 'F' && key.length === 1) {
      const line = this.getCurrentLine();
      const idx = line.lastIndexOf(key, this.state.cursor.col - 1);
      if (idx !== -1) {
        this.state.cursor.col = idx;
      }
      this.state.commandBuffer = '';
      this.notifyChange();
      return true;
    }

    this.state.commandBuffer = '';

    // Single char commands
    switch (key) {
      // Movement
      case 'h':
      case 'ArrowLeft':
        for (let i = 0; i < count; i++) {
          this.state.cursor.col = Math.max(0, this.state.cursor.col - 1);
        }
        break;

      case 'j':
      case 'ArrowDown':
        for (let i = 0; i < count; i++) {
          this.state.cursor.line = Math.min(this.state.lines.length - 1, this.state.cursor.line + 1);
        }
        this.state.cursor = this.clampCursor(this.state.cursor);
        break;

      case 'k':
      case 'ArrowUp':
        for (let i = 0; i < count; i++) {
          this.state.cursor.line = Math.max(0, this.state.cursor.line - 1);
        }
        this.state.cursor = this.clampCursor(this.state.cursor);
        break;

      case 'l':
      case 'ArrowRight':
        for (let i = 0; i < count; i++) {
          const maxCol = Math.max(0, this.getCurrentLine().length - 1);
          this.state.cursor.col = Math.min(maxCol, this.state.cursor.col + 1);
        }
        break;

      case 'w':
        for (let i = 0; i < count; i++) {
          this.moveWordForward();
        }
        break;

      case 'b':
        for (let i = 0; i < count; i++) {
          this.moveWordBackward();
        }
        break;

      case 'e':
        for (let i = 0; i < count; i++) {
          this.moveToEndOfWord();
        }
        break;

      case '0':
        this.state.cursor.col = 0;
        break;

      case '$':
        this.state.cursor.col = Math.max(0, this.getCurrentLine().length - 1);
        break;

      case '^':
        const firstNonSpace = this.getCurrentLine().search(/\S/);
        this.state.cursor.col = firstNonSpace === -1 ? 0 : firstNonSpace;
        break;

      case 'G':
        this.state.cursor.line = this.state.lines.length - 1;
        this.state.cursor = this.clampCursor(this.state.cursor);
        break;

      // Insert mode
      case 'i':
        this.state.mode = 'insert';
        break;

      case 'a':
        this.state.mode = 'insert';
        this.state.cursor.col = Math.min(this.getCurrentLine().length, this.state.cursor.col + 1);
        break;

      case 'A':
        this.state.mode = 'insert';
        this.state.cursor.col = this.getCurrentLine().length;
        break;

      case 'I':
        this.state.mode = 'insert';
        const firstChar = this.getCurrentLine().search(/\S/);
        this.state.cursor.col = firstChar === -1 ? 0 : firstChar;
        break;

      case 'o':
        this.state.lines.splice(this.state.cursor.line + 1, 0, '');
        this.state.cursor.line++;
        this.state.cursor.col = 0;
        this.state.mode = 'insert';
        break;

      case 'O':
        this.state.lines.splice(this.state.cursor.line, 0, '');
        this.state.cursor.col = 0;
        this.state.mode = 'insert';
        break;

      // Visual mode
      case 'v':
        this.state.mode = 'visual';
        this.state.selection = {
          start: { ...this.state.cursor },
          end: { ...this.state.cursor },
        };
        break;

      case 'V':
        this.state.mode = 'visual';
        this.state.selection = {
          start: { line: this.state.cursor.line, col: 0 },
          end: { line: this.state.cursor.line, col: this.getCurrentLine().length },
        };
        break;

      // Editing
      case 'x':
        for (let i = 0; i < count; i++) {
          this.deleteChar();
        }
        break;

      case 'X':
        for (let i = 0; i < count; i++) {
          this.deleteCharBefore();
        }
        break;

      case 's':
        this.deleteChar();
        this.state.mode = 'insert';
        break;

      case 'S':
        this.setCurrentLine('');
        this.state.cursor.col = 0;
        this.state.mode = 'insert';
        break;

      case 'D':
        this.deleteToEnd();
        break;

      case 'C':
        this.deleteToEnd();
        this.state.mode = 'insert';
        break;

      case 'p':
        this.paste('after');
        break;

      case 'P':
        this.paste('before');
        break;

      case 'u':
        // Undo not implemented - would need history stack
        this.state.message = 'Undo not available in this trainer';
        break;

      case 'J':
        this.joinLines();
        break;

      // Command mode
      case ':':
        this.state.mode = 'command';
        this.state.commandBuffer = ':';
        break;

      // Search
      case '/':
        this.state.mode = 'command';
        this.state.commandBuffer = '/';
        break;

      case 'n':
        this.searchNext();
        break;

      case 'N':
        this.searchPrev();
        break;

      case '*':
        this.searchWordUnderCursor();
        break;

      case 'Escape':
        this.state.selection = null;
        this.state.commandBuffer = '';
        break;

      default:
        return false;
    }

    this.notifyChange();
    return true;
  }

  private handleInsertMode(key: string, ctrl: boolean, e: KeyboardEvent): boolean {
    switch (key) {
      case 'Escape':
        this.state.mode = 'normal';
        this.state.cursor.col = Math.max(0, this.state.cursor.col - 1);
        break;

      case 'Backspace':
        e.preventDefault();
        this.backspace();
        break;

      case 'Delete':
        this.deleteChar();
        break;

      case 'Enter':
        e.preventDefault();
        this.insertNewline();
        break;

      case 'Tab':
        e.preventDefault();
        this.insertText('  ');
        break;

      case 'ArrowLeft':
        this.state.cursor.col = Math.max(0, this.state.cursor.col - 1);
        break;

      case 'ArrowRight':
        this.state.cursor.col = Math.min(this.getCurrentLine().length, this.state.cursor.col + 1);
        break;

      case 'ArrowUp':
        this.state.cursor.line = Math.max(0, this.state.cursor.line - 1);
        this.state.cursor = this.clampCursor(this.state.cursor);
        break;

      case 'ArrowDown':
        this.state.cursor.line = Math.min(this.state.lines.length - 1, this.state.cursor.line + 1);
        this.state.cursor = this.clampCursor(this.state.cursor);
        break;

      default:
        if (key.length === 1 && !ctrl) {
          e.preventDefault();
          this.insertText(key);
        } else {
          return false;
        }
    }

    this.notifyChange();
    return true;
  }

  private handleVisualMode(key: string, _ctrl: boolean, _shift: boolean, _e: KeyboardEvent): boolean {
    switch (key) {
      case 'Escape':
        this.state.mode = 'normal';
        this.state.selection = null;
        break;

      case 'h':
      case 'ArrowLeft':
        this.state.cursor.col = Math.max(0, this.state.cursor.col - 1);
        this.updateSelection();
        break;

      case 'j':
      case 'ArrowDown':
        this.state.cursor.line = Math.min(this.state.lines.length - 1, this.state.cursor.line + 1);
        this.state.cursor = this.clampCursor(this.state.cursor);
        this.updateSelection();
        break;

      case 'k':
      case 'ArrowUp':
        this.state.cursor.line = Math.max(0, this.state.cursor.line - 1);
        this.state.cursor = this.clampCursor(this.state.cursor);
        this.updateSelection();
        break;

      case 'l':
      case 'ArrowRight':
        const maxCol = this.getCurrentLine().length;
        this.state.cursor.col = Math.min(maxCol, this.state.cursor.col + 1);
        this.updateSelection();
        break;

      case 'w':
        this.moveWordForward();
        this.updateSelection();
        break;

      case 'b':
        this.moveWordBackward();
        this.updateSelection();
        break;

      case 'e':
        this.moveToEndOfWord();
        this.updateSelection();
        break;

      case '0':
        this.state.cursor.col = 0;
        this.updateSelection();
        break;

      case '$':
        this.state.cursor.col = this.getCurrentLine().length;
        this.updateSelection();
        break;

      case 'd':
      case 'x':
        this.deleteSelection();
        this.state.mode = 'normal';
        break;

      case 'y':
        this.yankSelection();
        this.state.mode = 'normal';
        this.state.selection = null;
        break;

      case 'c':
        this.deleteSelection();
        this.state.mode = 'insert';
        break;

      default:
        return false;
    }

    this.notifyChange();
    return true;
  }

  private handleCommandMode(key: string, e: KeyboardEvent): boolean {
    switch (key) {
      case 'Escape':
        this.state.mode = 'normal';
        this.state.commandBuffer = '';
        break;

      case 'Enter':
        e.preventDefault();
        this.executeCommand();
        break;

      case 'Backspace':
        e.preventDefault();
        if (this.state.commandBuffer.length > 1) {
          this.state.commandBuffer = this.state.commandBuffer.slice(0, -1);
        } else {
          this.state.mode = 'normal';
          this.state.commandBuffer = '';
        }
        break;

      default:
        if (key.length === 1) {
          e.preventDefault();
          this.state.commandBuffer += key;
        }
    }

    this.notifyChange();
    return true;
  }

  private executeCommand(): void {
    const cmd = this.state.commandBuffer;

    if (cmd.startsWith('/')) {
      // Search
      const pattern = cmd.slice(1);
      if (pattern) {
        this.state.lastSearch = pattern;
        this.searchNext();
      }
    } else if (cmd.startsWith(':')) {
      const command = cmd.slice(1);

      // Handle :w, :q, :wq
      if (command === 'w' || command === 'write') {
        this.state.message = 'File saved (simulated)';
      } else if (command === 'q' || command === 'quit') {
        this.state.message = 'Would quit (simulated)';
      } else if (command === 'wq' || command === 'x') {
        this.state.message = 'Saved and quit (simulated)';
      } else if (/^\d+$/.test(command)) {
        // Go to line
        const lineNum = parseInt(command) - 1;
        this.state.cursor.line = Math.max(0, Math.min(lineNum, this.state.lines.length - 1));
        this.state.cursor = this.clampCursor(this.state.cursor);
      } else if (command.startsWith('s/')) {
        // Substitution
        this.executeSubstitution(command);
      }
    }

    this.state.mode = 'normal';
    this.state.commandBuffer = '';
  }

  private executeSubstitution(cmd: string): void {
    const parts = cmd.split('/');
    if (parts.length >= 3) {
      const search = parts[1];
      const replace = parts[2];
      const flags = parts[3] || '';

      const line = this.getCurrentLine();
      if (flags.includes('g')) {
        this.setCurrentLine(line.split(search).join(replace));
      } else {
        this.setCurrentLine(line.replace(search, replace));
      }
    }
  }

  private moveWordForward(): void {
    const line = this.getCurrentLine();
    let col = this.state.cursor.col;

    // Skip current word
    while (col < line.length && /\w/.test(line[col])) {
      col++;
    }
    // Skip whitespace
    while (col < line.length && /\s/.test(line[col])) {
      col++;
    }

    if (col >= line.length && this.state.cursor.line < this.state.lines.length - 1) {
      this.state.cursor.line++;
      this.state.cursor.col = 0;
      // Skip leading whitespace on new line
      const newLine = this.getCurrentLine();
      while (this.state.cursor.col < newLine.length && /\s/.test(newLine[this.state.cursor.col])) {
        this.state.cursor.col++;
      }
    } else {
      this.state.cursor.col = Math.min(col, Math.max(0, line.length - 1));
    }
  }

  private moveWordBackward(): void {
    const line = this.getCurrentLine();
    let col = this.state.cursor.col;

    // Move back if at start of word
    if (col > 0) col--;

    // Skip whitespace
    while (col > 0 && /\s/.test(line[col])) {
      col--;
    }
    // Skip to start of word
    while (col > 0 && /\w/.test(line[col - 1])) {
      col--;
    }

    this.state.cursor.col = col;
  }

  private moveToEndOfWord(): void {
    const line = this.getCurrentLine();
    let col = this.state.cursor.col;

    // Move forward if at end of word
    if (col < line.length - 1) col++;

    // Skip whitespace
    while (col < line.length && /\s/.test(line[col])) {
      col++;
    }
    // Move to end of word
    while (col < line.length - 1 && /\w/.test(line[col + 1])) {
      col++;
    }

    this.state.cursor.col = Math.min(col, Math.max(0, line.length - 1));
  }

  private insertText(text: string): void {
    const line = this.getCurrentLine();
    const col = this.state.cursor.col;
    this.setCurrentLine(line.substring(0, col) + text + line.substring(col));
    this.state.cursor.col += text.length;
  }

  private insertNewline(): void {
    const line = this.getCurrentLine();
    const col = this.state.cursor.col;

    this.setCurrentLine(line.substring(0, col));
    this.state.lines.splice(this.state.cursor.line + 1, 0, line.substring(col));
    this.state.cursor.line++;
    this.state.cursor.col = 0;
  }

  private backspace(): void {
    const col = this.state.cursor.col;

    if (col > 0) {
      const line = this.getCurrentLine();
      this.setCurrentLine(line.substring(0, col - 1) + line.substring(col));
      this.state.cursor.col--;
    } else if (this.state.cursor.line > 0) {
      const currentLine = this.getCurrentLine();
      const prevLine = this.state.lines[this.state.cursor.line - 1];
      this.state.lines.splice(this.state.cursor.line, 1);
      this.state.cursor.line--;
      this.state.cursor.col = prevLine.length;
      this.setCurrentLine(prevLine + currentLine);
    }
  }

  private deleteChar(): void {
    const line = this.getCurrentLine();
    const col = this.state.cursor.col;

    if (col < line.length) {
      this.state.registers['"'] = line[col];
      this.setCurrentLine(line.substring(0, col) + line.substring(col + 1));
      this.state.cursor = this.clampCursor(this.state.cursor);
    }
  }

  private deleteCharBefore(): void {
    const col = this.state.cursor.col;

    if (col > 0) {
      const line = this.getCurrentLine();
      this.state.registers['"'] = line[col - 1];
      this.setCurrentLine(line.substring(0, col - 1) + line.substring(col));
      this.state.cursor.col--;
    }
  }

  private deleteLine(count: number = 1): void {
    const startLine = this.state.cursor.line;
    const endLine = Math.min(startLine + count, this.state.lines.length);
    const deleted = this.state.lines.splice(startLine, endLine - startLine);
    this.state.registers['"'] = deleted.join('\n') + '\n';

    if (this.state.lines.length === 0) {
      this.state.lines = [''];
    }

    this.state.cursor.line = Math.min(this.state.cursor.line, this.state.lines.length - 1);
    this.state.cursor = this.clampCursor(this.state.cursor);
  }

  private yankLine(count: number = 1): void {
    const startLine = this.state.cursor.line;
    const endLine = Math.min(startLine + count, this.state.lines.length);
    const yanked = this.state.lines.slice(startLine, endLine);
    this.state.registers['"'] = yanked.join('\n') + '\n';
    this.state.message = `${count} line(s) yanked`;
  }

  private changeLine(): void {
    this.setCurrentLine('');
    this.state.cursor.col = 0;
    this.state.mode = 'insert';
  }

  private deleteWord(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      const line = this.getCurrentLine();
      const startCol = this.state.cursor.col;
      let endCol = startCol;

      // Find word boundary
      while (endCol < line.length && /\w/.test(line[endCol])) {
        endCol++;
      }
      // Include trailing whitespace
      while (endCol < line.length && /\s/.test(line[endCol])) {
        endCol++;
      }

      if (endCol > startCol) {
        this.state.registers['"'] = line.substring(startCol, endCol);
        this.setCurrentLine(line.substring(0, startCol) + line.substring(endCol));
      }
    }
    this.state.cursor = this.clampCursor(this.state.cursor);
  }

  private changeWord(): void {
    const line = this.getCurrentLine();
    const startCol = this.state.cursor.col;
    let endCol = startCol;

    while (endCol < line.length && /\w/.test(line[endCol])) {
      endCol++;
    }

    this.state.registers['"'] = line.substring(startCol, endCol);
    this.setCurrentLine(line.substring(0, startCol) + line.substring(endCol));
    this.state.mode = 'insert';
  }

  private deleteToEnd(): void {
    const line = this.getCurrentLine();
    const col = this.state.cursor.col;
    this.state.registers['"'] = line.substring(col);
    this.setCurrentLine(line.substring(0, col));
    this.state.cursor = this.clampCursor(this.state.cursor);
  }

  private deleteInQuotes(quote: string): void {
    const line = this.getCurrentLine();
    const col = this.state.cursor.col;

    let start = line.lastIndexOf(quote, col);
    let end = line.indexOf(quote, col + 1);

    if (start === -1 || end === -1) {
      start = line.indexOf(quote);
      end = line.indexOf(quote, start + 1);
    }

    if (start !== -1 && end !== -1 && start < end) {
      this.state.registers['"'] = line.substring(start + 1, end);
      this.setCurrentLine(line.substring(0, start + 1) + line.substring(end));
      this.state.cursor.col = start + 1;
    }
  }

  private changeInQuotes(quote: string): void {
    this.deleteInQuotes(quote);
    this.state.mode = 'insert';
  }

  private paste(position: 'before' | 'after'): void {
    const text = this.state.registers['"'];
    if (!text) return;

    if (text.endsWith('\n')) {
      // Line paste
      const lines = text.slice(0, -1).split('\n');
      const insertLine = position === 'after' ? this.state.cursor.line + 1 : this.state.cursor.line;
      this.state.lines.splice(insertLine, 0, ...lines);
      this.state.cursor.line = insertLine;
      this.state.cursor.col = 0;
    } else {
      // Character paste
      const line = this.getCurrentLine();
      const col = position === 'after' ? this.state.cursor.col + 1 : this.state.cursor.col;
      this.setCurrentLine(line.substring(0, col) + text + line.substring(col));
      this.state.cursor.col = col + text.length - 1;
    }
  }

  private joinLines(): void {
    if (this.state.cursor.line < this.state.lines.length - 1) {
      const currentLine = this.getCurrentLine();
      const nextLine = this.state.lines[this.state.cursor.line + 1].trimStart();
      this.setCurrentLine(currentLine + ' ' + nextLine);
      this.state.lines.splice(this.state.cursor.line + 1, 1);
    }
  }

  private updateSelection(): void {
    if (this.state.selection) {
      this.state.selection.end = { ...this.state.cursor };
    }
  }

  private deleteSelection(): void {
    if (!this.state.selection) return;

    const { start, end } = this.normalizeSelection(this.state.selection);

    if (start.line === end.line) {
      const line = this.state.lines[start.line];
      this.state.registers['"'] = line.substring(start.col, end.col + 1);
      this.state.lines[start.line] = line.substring(0, start.col) + line.substring(end.col + 1);
    } else {
      const startLine = this.state.lines[start.line];
      const endLine = this.state.lines[end.line];

      let yanked = startLine.substring(start.col);
      for (let i = start.line + 1; i < end.line; i++) {
        yanked += '\n' + this.state.lines[i];
      }
      yanked += '\n' + endLine.substring(0, end.col + 1);
      this.state.registers['"'] = yanked;

      this.state.lines[start.line] = startLine.substring(0, start.col) + endLine.substring(end.col + 1);
      this.state.lines.splice(start.line + 1, end.line - start.line);
    }

    this.state.cursor = { ...start };
    this.state.selection = null;
    this.state.cursor = this.clampCursor(this.state.cursor);
  }

  private yankSelection(): void {
    if (!this.state.selection) return;

    const { start, end } = this.normalizeSelection(this.state.selection);

    if (start.line === end.line) {
      const line = this.state.lines[start.line];
      this.state.registers['"'] = line.substring(start.col, end.col + 1);
    } else {
      const startLine = this.state.lines[start.line];
      const endLine = this.state.lines[end.line];

      let yanked = startLine.substring(start.col);
      for (let i = start.line + 1; i < end.line; i++) {
        yanked += '\n' + this.state.lines[i];
      }
      yanked += '\n' + endLine.substring(0, end.col + 1);
      this.state.registers['"'] = yanked;
    }
  }

  private normalizeSelection(sel: Selection): Selection {
    if (sel.start.line > sel.end.line ||
        (sel.start.line === sel.end.line && sel.start.col > sel.end.col)) {
      return { start: sel.end, end: sel.start };
    }
    return sel;
  }

  private searchNext(): void {
    if (!this.state.lastSearch) return;

    const pattern = this.state.lastSearch.toLowerCase();
    let startLine = this.state.cursor.line;
    let startCol = this.state.cursor.col + 1;

    for (let i = 0; i < this.state.lines.length; i++) {
      const lineIdx = (startLine + i) % this.state.lines.length;
      const line = this.state.lines[lineIdx].toLowerCase();
      const searchStart = i === 0 ? startCol : 0;
      const idx = line.indexOf(pattern, searchStart);

      if (idx !== -1) {
        this.state.cursor = { line: lineIdx, col: idx };
        return;
      }
    }
  }

  private searchPrev(): void {
    if (!this.state.lastSearch) return;

    const pattern = this.state.lastSearch.toLowerCase();
    let startLine = this.state.cursor.line;
    let startCol = this.state.cursor.col - 1;

    for (let i = 0; i < this.state.lines.length; i++) {
      const lineIdx = (startLine - i + this.state.lines.length) % this.state.lines.length;
      const line = this.state.lines[lineIdx].toLowerCase();
      const searchEnd = i === 0 ? startCol : line.length;
      const idx = line.lastIndexOf(pattern, searchEnd);

      if (idx !== -1) {
        this.state.cursor = { line: lineIdx, col: idx };
        return;
      }
    }
  }

  private searchWordUnderCursor(): void {
    const line = this.getCurrentLine();
    const col = this.state.cursor.col;

    let start = col;
    let end = col;

    while (start > 0 && /\w/.test(line[start - 1])) start--;
    while (end < line.length && /\w/.test(line[end])) end++;

    const word = line.substring(start, end);
    if (word) {
      this.state.lastSearch = word;
      this.searchNext();
    }
  }
}
