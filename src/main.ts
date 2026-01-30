import { VimEngine } from './vim-engine';
import { lessons, referenceCategories } from './lessons';
import { EditorState, Lesson } from './types';

class VimTrainerApp {
  private lessonEngine: VimEngine;
  private sandboxEngine: VimEngine;
  private currentLesson: Lesson | null = null;
  private currentStepIndex: number = 0;
  private completedLessons: Set<string> = new Set();
  private prevState: EditorState | null = null;
  private isPremium: boolean = false;
  private freeLesonLimit: number = 3;

  // DOM Elements
  private lessonListEl!: HTMLElement;
  private lessonTitleEl!: HTMLElement;
  private lessonDescEl!: HTMLElement;
  private editorEl!: HTMLElement;
  private lineNumbersEl!: HTMLElement;
  private modeIndicatorEl!: HTMLElement;
  private commandDisplayEl!: HTMLElement;
  private keyHintEl!: HTMLElement;
  private cursorPosEl!: HTMLElement;
  private taskInstructionEl!: HTMLElement;
  private taskStepEl!: HTMLElement;
  private progressFillEl!: HTMLElement;
  private progressTextEl!: HTMLElement;
  private successModal!: HTMLElement;
  private modalMessageEl!: HTMLElement;

  // Sandbox elements
  private sandboxEditorEl!: HTMLElement;
  private sandboxLineNumbersEl!: HTMLElement;
  private sandboxModeIndicatorEl!: HTMLElement;
  private sandboxCommandDisplayEl!: HTMLElement;
  private sandboxCursorPosEl!: HTMLElement;

  constructor() {
    this.lessonEngine = new VimEngine(['Welcome to Vim Trainer!', '', 'Select a lesson from the sidebar to begin.']);
    this.sandboxEngine = new VimEngine([
      '// Sandbox Mode - Practice freely!',
      '',
      'function greet(name) {',
      '  return `Hello, ${name}!`;',
      '}',
      '',
      'const message = greet("Vim User");',
      'console.log(message);',
      '',
      '// Try any Vim commands here...',
    ]);

    this.loadProgress();
    this.checkPremiumStatus();
  }

  init(): void {
    this.cacheElements();
    this.setupEventListeners();
    this.renderLessonList();
    this.renderReference();
    this.updateProgress();

    this.lessonEngine.onChange((state) => this.renderEditor(state, 'lesson'));
    this.sandboxEngine.onChange((state) => this.renderEditor(state, 'sandbox'));

    // Initial render
    this.renderEditor(this.lessonEngine.getState(), 'lesson');
    this.renderEditor(this.sandboxEngine.getState(), 'sandbox');
  }

  private cacheElements(): void {
    this.lessonListEl = document.getElementById('lesson-list')!;
    this.lessonTitleEl = document.getElementById('lesson-title')!;
    this.lessonDescEl = document.getElementById('lesson-description')!;
    this.editorEl = document.getElementById('editor')!;
    this.lineNumbersEl = document.getElementById('line-numbers')!;
    this.modeIndicatorEl = document.getElementById('mode-indicator')!;
    this.commandDisplayEl = document.getElementById('command-display')!;
    this.keyHintEl = document.getElementById('key-hint')!;
    this.cursorPosEl = document.getElementById('cursor-pos')!;
    this.taskInstructionEl = document.getElementById('task-instruction')!;
    this.taskStepEl = document.getElementById('task-step')!;
    this.progressFillEl = document.getElementById('progress-fill')!;
    this.progressTextEl = document.getElementById('progress-text')!;
    this.successModal = document.getElementById('success-modal')!;
    this.modalMessageEl = document.getElementById('modal-message')!;

    this.sandboxEditorEl = document.getElementById('sandbox-editor')!;
    this.sandboxLineNumbersEl = document.getElementById('sandbox-line-numbers')!;
    this.sandboxModeIndicatorEl = document.getElementById('sandbox-mode-indicator')!;
    this.sandboxCommandDisplayEl = document.getElementById('sandbox-command-display')!;
    this.sandboxCursorPosEl = document.getElementById('sandbox-cursor-pos')!;
  }

  private setupEventListeners(): void {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const view = target.dataset.view;
        this.switchView(view!);
      });
    });

    // Editor focus and keyboard
    this.editorEl.addEventListener('keydown', (e) => this.handleKeyDown(e, this.lessonEngine, 'lesson'));
    this.sandboxEditorEl.addEventListener('keydown', (e) => this.handleKeyDown(e, this.sandboxEngine, 'sandbox'));

    // Prevent default on editor to avoid issues
    [this.editorEl, this.sandboxEditorEl].forEach((el) => {
      el.addEventListener('click', () => el.focus());
    });

    // Hint button
    document.getElementById('btn-hint')?.addEventListener('click', () => this.showHint());

    // Next lesson button
    document.getElementById('next-lesson-btn')?.addEventListener('click', () => this.nextLesson());

    // Close modal on click outside
    this.successModal.addEventListener('click', (e) => {
      if (e.target === this.successModal) {
        this.successModal.classList.remove('active');
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent, engine: VimEngine, type: 'lesson' | 'sandbox'): void {
    this.prevState = engine.getState();

    if (engine.handleKeyDown(e)) {
      e.preventDefault();

      if (type === 'lesson' && this.currentLesson) {
        this.checkStepCompletion();
      }
    }
  }

  private switchView(view: string): void {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });

    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.id === `${view}-view`);
    });

    // Focus appropriate editor
    if (view === 'lessons') {
      setTimeout(() => this.editorEl.focus(), 100);
    } else if (view === 'sandbox') {
      setTimeout(() => this.sandboxEditorEl.focus(), 100);
    }
  }

  private renderLessonList(): void {
    this.lessonListEl.innerHTML = lessons
      .map((lesson, index) => {
        const isCompleted = this.completedLessons.has(lesson.id);
        const isLocked = !this.isPremium && index >= this.freeLesonLimit;

        return `
          <div class="lesson-item ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}"
               data-lesson-id="${lesson.id}"
               data-index="${index}">
            <div class="lesson-icon">${isLocked ? '🔒' : (isCompleted ? '✓' : lesson.icon)}</div>
            <div class="lesson-info">
              <div class="lesson-name">${lesson.title}${isLocked ? ' (Premium)' : ''}</div>
              <div class="lesson-keys">${lesson.keys}</div>
            </div>
          </div>
        `;
      })
      .join('');

    this.lessonListEl.querySelectorAll('.lesson-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const lessonId = target.dataset.lessonId;
        const index = parseInt(target.dataset.index || '0');

        if (!this.isPremium && index >= this.freeLesonLimit) {
          this.showPremiumModal();
          return;
        }

        this.selectLesson(lessonId!);
      });
    });
  }

  private selectLesson(lessonId: string): void {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    this.currentLesson = lesson;
    this.currentStepIndex = 0;

    // Update UI
    this.lessonTitleEl.textContent = lesson.title;
    this.lessonDescEl.textContent = lesson.description;

    // Highlight selected lesson
    this.lessonListEl.querySelectorAll('.lesson-item').forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-lesson-id') === lessonId);
    });

    this.loadStep();
    this.editorEl.focus();
  }

  private loadStep(): void {
    if (!this.currentLesson) return;

    const step = this.currentLesson.steps[this.currentStepIndex];
    if (!step) return;

    // Set content
    if (step.initialContent) {
      this.lessonEngine.setContent(step.initialContent);
    }
    if (step.initialCursor) {
      this.lessonEngine.setCursor(step.initialCursor);
    }

    // Update task panel
    this.taskInstructionEl.innerHTML = step.instruction;
    this.taskStepEl.textContent = `Step ${this.currentStepIndex + 1}/${this.currentLesson.steps.length}`;
    this.keyHintEl.textContent = '';

    this.prevState = this.lessonEngine.getState();
  }

  private checkStepCompletion(): void {
    if (!this.currentLesson) return;

    const step = this.currentLesson.steps[this.currentStepIndex];
    const currentState = this.lessonEngine.getState();

    if (step.validate(currentState, this.prevState)) {
      this.editorEl.classList.add('highlight-success');
      setTimeout(() => this.editorEl.classList.remove('highlight-success'), 500);

      if (this.currentStepIndex < this.currentLesson.steps.length - 1) {
        this.currentStepIndex++;
        setTimeout(() => this.loadStep(), 600);
      } else {
        this.completeLesson();
      }
    }
  }

  private completeLesson(): void {
    if (!this.currentLesson) return;

    this.completedLessons.add(this.currentLesson.id);
    this.saveProgress();
    this.updateProgress();
    this.renderLessonList();

    const lessonIndex = lessons.findIndex((l) => l.id === this.currentLesson?.id);
    const nextLesson = lessons[lessonIndex + 1];

    this.modalMessageEl.textContent = nextLesson
      ? `Ready for "${nextLesson.title}"?`
      : 'You\'ve completed all lessons!';

    this.successModal.classList.add('active');
  }

  private nextLesson(): void {
    this.successModal.classList.remove('active');

    if (!this.currentLesson) return;

    const currentIndex = lessons.findIndex((l) => l.id === this.currentLesson?.id);
    const nextLesson = lessons[currentIndex + 1];

    if (nextLesson) {
      if (!this.isPremium && currentIndex + 1 >= this.freeLesonLimit) {
        this.showPremiumModal();
      } else {
        this.selectLesson(nextLesson.id);
      }
    }
  }

  private showHint(): void {
    if (!this.currentLesson) return;

    const step = this.currentLesson.steps[this.currentStepIndex];
    this.keyHintEl.textContent = `💡 ${step.hint}`;
  }

  private renderEditor(state: EditorState, type: 'lesson' | 'sandbox'): void {
    const editorEl = type === 'lesson' ? this.editorEl : this.sandboxEditorEl;
    const lineNumbersEl = type === 'lesson' ? this.lineNumbersEl : this.sandboxLineNumbersEl;
    const modeIndicatorEl = type === 'lesson' ? this.modeIndicatorEl : this.sandboxModeIndicatorEl;
    const commandDisplayEl = type === 'lesson' ? this.commandDisplayEl : this.sandboxCommandDisplayEl;
    const cursorPosEl = type === 'lesson' ? this.cursorPosEl : this.sandboxCursorPosEl;

    // Render lines
    editorEl.innerHTML = state.lines
      .map((line, lineIndex) => {
        const isCurrentLine = lineIndex === state.cursor.line;
        const chars = (line || ' ')
          .split('')
          .map((char, colIndex) => {
            const isCursor = isCurrentLine && colIndex === state.cursor.col;
            const isSelected = this.isCharSelected(state, lineIndex, colIndex);

            let className = 'char';
            if (isCursor && state.mode !== 'insert') className += ' cursor-on';
            if (isSelected) className += ' selected';

            const displayChar = char === ' ' ? '&nbsp;' : this.escapeHtml(char);
            return `<span class="${className}">${displayChar}</span>`;
          })
          .join('');

        // Handle cursor at end of line in insert mode
        let cursorHtml = '';
        if (isCurrentLine && state.mode === 'insert' && state.cursor.col >= line.length) {
          cursorHtml = `<span class="cursor insert"></span>`;
        }
        // Handle empty line cursor
        if (isCurrentLine && line.length === 0 && state.mode !== 'insert') {
          return `<div class="editor-line current"><span class="char cursor-on">&nbsp;</span></div>`;
        }

        return `<div class="editor-line${isCurrentLine ? ' current' : ''}">${chars}${cursorHtml}</div>`;
      })
      .join('');

    // Render line numbers
    lineNumbersEl.innerHTML = state.lines
      .map((_, i) => {
        const isActive = i === state.cursor.line;
        return `<div class="line-number${isActive ? ' active' : ''}">${i + 1}</div>`;
      })
      .join('');

    // Update mode indicator
    modeIndicatorEl.textContent = state.mode.toUpperCase();
    modeIndicatorEl.className = `mode-indicator ${state.mode}`;

    // Update command display
    commandDisplayEl.textContent = state.commandBuffer || state.message || '';

    // Update cursor position
    cursorPosEl.textContent = `Ln ${state.cursor.line + 1}, Col ${state.cursor.col + 1}`;
  }

  private isCharSelected(state: EditorState, line: number, col: number): boolean {
    if (!state.selection) return false;

    const { start, end } = state.selection;
    const selStart = start.line < end.line || (start.line === end.line && start.col <= end.col) ? start : end;
    const selEnd = start.line < end.line || (start.line === end.line && start.col <= end.col) ? end : start;

    if (line < selStart.line || line > selEnd.line) return false;
    if (line === selStart.line && col < selStart.col) return false;
    if (line === selEnd.line && col > selEnd.col) return false;

    return true;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private renderReference(): void {
    const grid = document.getElementById('reference-grid')!;
    grid.innerHTML = referenceCategories
      .map(
        (cat) => `
        <div class="reference-card">
          <h3>${cat.title}</h3>
          <div class="reference-list">
            ${cat.commands
              .map(
                (cmd) => `
                <div class="reference-item">
                  <span class="ref-key">${this.escapeHtml(cmd.key)}</span>
                  <span class="ref-desc">${cmd.description}</span>
                </div>
              `
              )
              .join('')}
          </div>
        </div>
      `
      )
      .join('');
  }

  private updateProgress(): void {
    const total = lessons.length;
    const completed = this.completedLessons.size;
    const percent = Math.round((completed / total) * 100);

    this.progressFillEl.style.width = `${percent}%`;
    this.progressTextEl.textContent = `${percent}% Complete (${completed}/${total})`;
  }

  private loadProgress(): void {
    const saved = localStorage.getItem('vim-trainer-progress');
    if (saved) {
      const data = JSON.parse(saved);
      this.completedLessons = new Set(data.completedLessons || []);
    }
  }

  private saveProgress(): void {
    localStorage.setItem(
      'vim-trainer-progress',
      JSON.stringify({
        completedLessons: Array.from(this.completedLessons),
      })
    );
  }

  private checkPremiumStatus(): void {
    const premium = localStorage.getItem('vim-trainer-premium');
    this.isPremium = premium === 'true';

    // Check URL for success callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      this.isPremium = true;
      localStorage.setItem('vim-trainer-premium', 'true');
      window.history.replaceState({}, '', window.location.pathname);
      this.showPremiumSuccessModal();
    }
  }

  private showPremiumModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'premium-modal';
    modal.innerHTML = `
      <div class="modal-content premium-modal-content">
        <div class="modal-icon">⭐</div>
        <h2>Unlock All Lessons</h2>
        <p>Get access to all ${lessons.length} lessons and master Vim!</p>
        <ul class="premium-features">
          <li>✓ ${lessons.length - this.freeLesonLimit} additional lessons</li>
          <li>✓ Advanced commands & motions</li>
          <li>✓ Lifetime access</li>
          <li>✓ Support development</li>
        </ul>
        <div class="premium-price">
          <span class="price">€5</span>
          <span class="price-note">one-time payment</span>
        </div>
        <button class="btn-primary btn-checkout" id="checkout-btn">
          Unlock Premium
        </button>
        <button class="btn-secondary" id="close-premium-modal">Maybe later</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('checkout-btn')?.addEventListener('click', () => {
      this.initiateCheckout();
    });

    document.getElementById('close-premium-modal')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  private showPremiumSuccessModal(): void {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-icon">🎉</div>
        <h2>Welcome to Premium!</h2>
        <p>Thank you for your purchase! All lessons are now unlocked.</p>
        <button class="btn-primary" id="start-premium">Start Learning</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('start-premium')?.addEventListener('click', () => {
      modal.remove();
      this.renderLessonList();
    });
  }

  private async initiateCheckout(): Promise<void> {
    const btn = document.getElementById('checkout-btn') as HTMLButtonElement;
    btn.textContent = 'Loading...';
    btn.disabled = true;

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      btn.textContent = 'Try Again';
      btn.disabled = false;
      alert('Unable to start checkout. Please try again.');
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new VimTrainerApp();
  app.init();
});
