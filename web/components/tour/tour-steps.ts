export interface TourStep {
  id: string
  /** CSS selector for the target element (null = centered card, no spotlight) */
  target: string | null
  title: string
  description: string
  /** Preferred tooltip placement relative to the spotlight */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /** Extra padding around the spotlight cutout (px) */
  padding?: number
  /** If true, step is skipped when target element is missing from DOM */
  optional?: boolean
  /** Navigate via router.push before showing (supports {{tourEssayId}} placeholder) */
  route?: string
  /** CSS selector to click before showing (e.g. for panel toggling) */
  clickBefore?: string
  /** Section label for grouped progress display */
  section?: string
}

export const tourSteps: TourStep[] = [
  // --- Welcome ---
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to Zora',
    description: 'A quiet space for your best writing. Let\u2019s take a quick look around so you know where everything is.',
    placement: 'center',
    section: 'Welcome',
  },

  // --- Home ---
  {
    id: 'new-document',
    target: '[data-tour="new-document"]',
    title: 'Start Something New',
    description: 'Create essays, research papers, stories, screenplays, and more. Each type comes with its own layout and tools.',
    placement: 'bottom',
    padding: 6,
    section: 'Home',
  },
  {
    id: 'filter-tabs',
    target: '[data-tour="filter-tabs"]',
    title: 'Find Your Work',
    description: 'Your documents are organized by type \u2014 academic, creative, professional \u2014 so you can find them easily.',
    placement: 'bottom',
    padding: 6,
    optional: true,
    section: 'Home',
  },

  // --- Editor ---
  {
    id: 'writing-plan',
    target: '[data-tour="writing-plan"]',
    title: 'Your Writing Plan',
    description: 'Set your topic, thesis, word count goal, and writing voice here. Think of it as your creative brief \u2014 Zora uses this to tailor all of her suggestions to your project.',
    placement: 'bottom',
    padding: 6,
    route: '/editor?id={{tourEssayId}}',
    section: 'Editor',
  },
  {
    id: 'outline-panel',
    target: '[data-tour="outline-panel"]',
    title: 'Your Outline',
    description: 'Build your outline by hand, upload one from a file, or let Zora generate one from your Writing Plan. Each section tracks notes, evidence, and word count progress.',
    placement: 'top',
    padding: 8,
    section: 'Editor',
  },
  {
    id: 'editor-area',
    target: '[data-tour="editor-area"]',
    title: 'Your Writing Space',
    description: 'This is where you write. Highlight any text to see quick actions \u2014 rephrase in your voice, humanize, score against your style profile, or ask Zora for help.',
    placement: 'top',
    padding: 4,
    section: 'Editor',
  },
  {
    id: 'toolbar',
    target: '[data-tour="toolbar"]',
    title: 'Formatting',
    description: 'Simple formatting when you need it \u2014 headings, bold, italic, lists, and blockquotes. The Zora button on the right opens your AI assistant panel.',
    placement: 'bottom',
    padding: 4,
    section: 'Editor',
  },
  {
    id: 'zora-panel',
    target: '[data-tour="zora-panel"]',
    title: 'Meet Zora',
    description: 'Your AI writing assistant lives here. Use Writing Tools to expand, rephrase, or humanize text. Switch to Chat to talk through ideas or get feedback. The AI Detection tab checks your writing for patterns that might flag as AI-generated.',
    placement: 'left',
    padding: 8,
    section: 'Editor',
  },
  {
    id: 'sources-btn',
    target: '[data-tour="sources-btn"]',
    title: 'Books & Sources',
    description: 'Upload PDFs, Word docs, or textbooks, then extract quotes and evidence directly into your outline sections. You can also add website sources with automatic metadata.',
    placement: 'bottom',
    padding: 6,
    optional: true,
    section: 'Editor',
  },
  {
    id: 'research-btn',
    target: '[data-tour="research-btn"]',
    title: 'Academic Research',
    description: 'Search millions of peer-reviewed papers, save them to your library, and generate formatted citations in APA, MLA, Chicago, IEEE, or Harvard style.',
    placement: 'bottom',
    padding: 6,
    optional: true,
    section: 'Editor',
  },
  {
    id: 'export-btn',
    target: '[data-tour="export-btn"]',
    title: 'Export Your Work',
    description: 'When you\u2019re ready, export as Markdown, PDF, Word, or HTML. Your formatting, citations, and structure are all preserved.',
    placement: 'bottom',
    padding: 6,
    section: 'Editor',
  },

  // --- Finish ---
  {
    id: 'finish',
    target: null,
    title: 'You\u2019re All Set',
    description: 'That\u2019s the tour. You can change your writing voice anytime in the Writing Plan, and click the ? button to revisit this tour. Happy writing.',
    placement: 'center',
    section: 'Finish',
  },
]
