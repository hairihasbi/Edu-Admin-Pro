import React, { useState } from 'react';
import katex from 'katex';
import { Calculator, HelpCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

/**
 * Safely escape HTML characters to prevent XSS in plain text portions
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render LaTeX formula string into HTML using KaTeX
 */
export function renderMathToString(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex.trim(), {
      throwOnError: false,
      displayMode,
      output: 'html'
    });
  } catch (error) {
    return `<span class="katex-error text-red-500 font-mono text-xs" title="${escapeHtml(String(error))}">${escapeHtml(latex)}</span>`;
  }
}

/**
 * Clean and normalize text copied from Gemini AI or other LLMs:
 * 1. Strips markdown codeblocks wrapping the whole text (```markdown ... ```)
 * 2. Converts Gemini's LaTeX display delimiters \[ ... \] to $$ ... $$
 * 3. Converts Gemini's LaTeX inline delimiters \( ... \) to $ ... $
 * 4. Trims internal whitespace adjacent to dollar signs ($ f(x) $ -> $f(x)$)
 */
export function normalizeGeminiMathText(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Remove wrapping markdown code fences if whole text is wrapped in ```markdown or ```
  cleaned = cleaned.replace(/^\s*```(?:markdown|latex|text)?\s*\n?([\s\S]*?)\n?\s*```\s*$/g, '$1');

  // Convert Gemini display math \[ ... \] to $$ ... $$
  cleaned = cleaned.replace(/\\\[([\s\S]+?)\\\]/g, (_, latex) => `$$${latex.trim()}$$`);

  // Convert Gemini inline math \( ... \) to $ ... $
  cleaned = cleaned.replace(/\\\(([\s\S]+?)\\\)/g, (_, latex) => `$${latex.trim()}$`);

  // Fix spaces right inside dollar signs e.g. "$ x + 1 $" -> "$x + 1$"
  cleaned = cleaned.replace(/\$\s+([^\$\n]+?)\s+\$/g, '$$$1$$');

  return cleaned;
}

/**
 * Parse a text string containing math markers:
 * 1. $$...$$ or \[...\] (block/display math)
 * 2. $...$ or \(...\) (inline math)
 * and render the math expressions to HTML using KaTeX while preserving text formatting and line breaks.
 */
export function renderTextWithMathToHtml(text: string): string {
  if (!text) return '';

  // First normalize common Gemini LLM notation formats
  const normalizedText = normalizeGeminiMathText(text);

  // Regex matches:
  // 1. Block math: $$...$$ or \[...\]
  // 2. Inline math: $...$ or \(...\)
  const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$([^\$\n]+?)\$|\\\(([^\n]+?)\\\))/g;

  let lastIndex = 0;
  let result = '';
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(normalizedText)) !== null) {
    // Process text before the match
    const textBefore = normalizedText.substring(lastIndex, match.index);
    if (textBefore) {
      result += escapeHtml(textBefore).replace(/\n/g, '<br/>');
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith('$$') && matchedStr.endsWith('$$')) {
      // Block math $$...$$
      const latex = matchedStr.slice(2, -2);
      result += `<div class="katex-block my-1.5 text-center overflow-x-auto py-1">${renderMathToString(latex, true)}</div>`;
    } else if (matchedStr.startsWith('\\[') && matchedStr.endsWith('\\]')) {
      // Block math \[...\]
      const latex = matchedStr.slice(2, -2);
      result += `<div class="katex-block my-1.5 text-center overflow-x-auto py-1">${renderMathToString(latex, true)}</div>`;
    } else if (matchedStr.startsWith('$') && matchedStr.endsWith('$')) {
      // Inline math $...$
      const latex = matchedStr.slice(1, -1);
      result += `<span class="katex-inline inline-block px-0.5">${renderMathToString(latex, false)}</span>`;
    } else if (matchedStr.startsWith('\\(') && matchedStr.endsWith('\\)')) {
      // Inline math \(...\)
      const latex = matchedStr.slice(2, -2);
      result += `<span class="katex-inline inline-block px-0.5">${renderMathToString(latex, false)}</span>`;
    }

    lastIndex = match.index + matchedStr.length;
  }

  // Append any remaining text after the last match
  if (lastIndex < normalizedText.length) {
    const textAfter = normalizedText.substring(lastIndex);
    result += escapeHtml(textAfter).replace(/\n/g, '<br/>');
  }

  return result;
}

/**
 * Check if a text contains any math formula markers ($...$, $$...$$, \[...\], or \(...\))
 */
export function hasMathFormula(text: string): boolean {
  if (!text) return false;
  return /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\$\n]+?\$|\\\([^\n]+?\\\))/.test(text);
}

/**
 * React Component for displaying formatted text with KaTeX math rendering
 */
export const MathView: React.FC<{
  text: string;
  className?: string;
  displayAsBlock?: boolean;
}> = ({ text, className = '', displayAsBlock = false }) => {
  if (!text) return null;

  // If no math syntax is present, render with standard pre-line text
  if (!hasMathFormula(text)) {
    return <span className={`whitespace-pre-line ${className}`}>{text}</span>;
  }

  const renderedHtml = renderTextWithMathToHtml(text);

  if (displayAsBlock) {
    return (
      <div 
        className={`math-rendered-content text-inherit leading-relaxed ${className}`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }

  return (
    <span 
      className={`math-rendered-content text-inherit leading-relaxed inline ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

// Formula Toolbar Categories & Items
interface MathSnippet {
  label: string;
  code: string;
  tooltip: string;
  example?: string;
}

const FAVORITE_SNIPPETS: MathSnippet[] = [
  { label: 'a/b', code: '$\\frac{a}{b}$', tooltip: 'Pecahan (Fraction)' },
  { label: 'x²', code: '$x^2$', tooltip: 'Pangkat / Kuadrat' },
  { label: 'xⁿ', code: '$x^{n}$', tooltip: 'Pangkat Umum' },
  { label: 'x₁', code: '$x_1$', tooltip: 'Indeks / Subskrip' },
  { label: '√x', code: '$\\sqrt{x}$', tooltip: 'Akar Kuadrat' },
  { label: 'ⁿ√x', code: '$\\sqrt[n]{x}$', tooltip: 'Akar Pangkat n' },
  { label: '±', code: '$\\pm$', tooltip: 'Plus Minus' },
  { label: '×', code: '$\\times$', tooltip: 'Simbol Kali' },
  { label: '÷', code: '$\\div$', tooltip: 'Simbol Bagi' },
  { label: '≤', code: '$\\le$', tooltip: 'Kurang dari sama dengan' },
  { label: '≥', code: '$\\ge$', tooltip: 'Lebih dari sama dengan' },
  { label: '≠', code: '$\\neq$', tooltip: 'Tidak sama dengan' },
  { label: '≈', code: '$\\approx$', tooltip: 'Mendekati / Kira-kira' },
  { label: 'π', code: '$\\pi$', tooltip: 'Bilangan Pi' },
  { label: '°C', code: '$^\\circ\\text{C}$', tooltip: 'Derajat Celcius' },
  { label: '→', code: '$\\rightarrow$', tooltip: 'Panah Reaksi / Transformasi' },
  { label: '⇌', code: '$\\rightleftharpoons$', tooltip: 'Reaksi Kesetimbangan' },
];

const ADVANCED_SNIPPETS: MathSnippet[] = [
  { label: 'Σ (Sigma)', code: '$\\sum_{i=1}^{n} x_i$', tooltip: 'Notasi Penjumlahan (Sigma)' },
  { label: '∫ (Integral)', code: '$\\int_{a}^{b} f(x)\\,dx$', tooltip: 'Integral Tertentu' },
  { label: 'lim (Limit)', code: '$\\lim_{x \\to 0} f(x)$', tooltip: 'Limit Fungsi' },
  { label: 'Vector v⃗', code: '$\\vec{v}$', tooltip: 'Vektor' },
  { label: 'dy/dx', code: '$\\frac{dy}{dx}$', tooltip: 'Turunan (Diferensial)' },
  { label: 'Δ (Delta)', code: '$\\Delta$', tooltip: 'Perubahan / Diskriminan' },
  { label: 'α (Alpha)', code: '$\\alpha$', tooltip: 'Alpha' },
  { label: 'β (Beta)', code: '$\\beta$', tooltip: 'Beta' },
  { label: 'θ (Theta)', code: '$\\theta$', tooltip: 'Sudut Theta' },
  { label: 'λ (Lambda)', code: '$\\lambda$', tooltip: 'Panjang Gelombang' },
  { label: 'μ (Mu)', code: '$\\mu$', tooltip: 'Koefisien Gesek / Mikro' },
  { label: 'Ω (Ohm)', code: '$\\Omega$', tooltip: 'Hambatan Listrik (Ohm)' },
  { label: '∞', code: '$\\infty$', tooltip: 'Tak Hingga' },
];

const TEMPLATE_SNIPPETS: { title: string; category: string; text: string }[] = [
  {
    title: 'Rumus ABC (Persamaan Kuadrat)',
    category: 'Matematika',
    text: '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$'
  },
  {
    title: 'Teorema Pythagoras',
    category: 'Matematika',
    text: '$c = \\sqrt{a^2 + b^2}$'
  },
  {
    title: 'Persamaan Linear 2 Variabel',
    category: 'Matematika',
    text: '$ax + by = c$'
  },
  {
    title: 'Hukum II Newton',
    category: 'Fisika',
    text: '$\\Sigma F = m \\cdot a$'
  },
  {
    title: 'Gerak Lurus Berubah Beraturan (GLBB)',
    category: 'Fisika',
    text: '$v_t = v_0 + a \\cdot t$, $s = v_0 \\cdot t + \\frac{1}{2}a t^2$'
  },
  {
    title: 'Energi Kinetik & Potensial',
    category: 'Fisika',
    text: '$E_k = \\frac{1}{2}m v^2$, $E_p = m \\cdot g \\cdot h$'
  },
  {
    title: 'Reaksi Pembakaran Metana',
    category: 'Kimia',
    text: '$\\text{CH}_4 + 2\\text{O}_2 \\rightarrow \\text{CO}_2 + 2\\text{H}_2\\text{O}$'
  },
  {
    title: 'Persamaan Gas Ideal',
    category: 'Kimia/Fisika',
    text: '$P \\cdot V = n \\cdot R \\cdot T$'
  },
  {
    title: 'Reaksi Fotosintesis',
    category: 'Biologi/Kimia',
    text: '$6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{cahaya}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$'
  }
];

export interface MathFormulaToolbarProps {
  onInsert: (snippet: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const MathFormulaToolbar: React.FC<MathFormulaToolbarProps> = ({
  onInsert,
  isOpen,
  onToggle
}) => {
  const [activeTab, setActiveTab] = useState<'FAVORITE' | 'ADVANCED' | 'TEMPLATE'>('FAVORITE');
  const [showGuide, setShowGuide] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  return (
    <div className="border border-indigo-200 bg-indigo-50/70 rounded-xl overflow-hidden shadow-xs transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-100/90 to-blue-100/80 border-b border-indigo-200 text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-indigo-600 text-white rounded-md shadow-2xs">
            <Calculator size={14} />
          </div>
          <span className="font-bold text-indigo-950">Toolbar Rumus & Simbol Eksakta (KaTeX)</span>
          <span className="hidden sm:inline-block px-2 py-0.5 bg-indigo-200/70 text-indigo-800 text-[10px] font-semibold rounded-full">
            Matematika, Fisika, Kimia, IPA
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="text-indigo-700 hover:text-indigo-950 hover:bg-indigo-200/50 p-1 rounded flex items-center gap-1 font-medium transition"
            title="Petunjuk cara menulis rumus eksakta"
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">Panduan</span>
          </button>
          
          <button
            type="button"
            onClick={onToggle}
            className="text-indigo-700 hover:text-indigo-950 hover:bg-indigo-200/50 p-1 rounded flex items-center gap-0.5 font-bold transition"
            title={isOpen ? "Sembunyikan toolbar" : "Buka toolbar"}
          >
            <span>{isOpen ? 'Tutup' : 'Buka'}</span>
            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Guide details dropdown */}
      {showGuide && (
        <div className="p-3 bg-white border-b border-indigo-100 text-xs text-gray-700 space-y-1.5">
          <p className="font-semibold text-indigo-900 flex items-center gap-1">
            <span>💡 Cara Menulis Rumus Eksakta:</span>
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[11px] text-gray-600">
            <li>
              Cukup apit rumus dengan tanda dollar tunggal <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-700 font-mono">$...$</code> untuk rumus sejajar teks.
              Contoh: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">$f(x) = 2x^2 + 5x - 3$</code>.
            </li>
            <li>
              Gunakan tanda dollar ganda <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-700 font-mono">$$...$$</code> untuk rumus terpusat di baris baru.
            </li>
            <li>
              Klik tombol-tombol di bawah untuk langsung menyisipkan simbol tanpa harus menghafal kode LaTeX.
            </li>
            <li>
              Gunakan tab <strong>Pratinjau Rumus</strong> di bawah kotak teks untuk melihat hasil visual sebelum disimpan atau dicetak.
            </li>
          </ul>
        </div>
      )}

      {/* Toolbar body */}
      {isOpen && (
        <div className="p-2.5 space-y-2.5 bg-white/90">
          {/* Sub-tabs */}
          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('FAVORITE')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTab === 'FAVORITE'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Simbol Umum
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ADVANCED')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTab === 'ADVANCED'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Sains & Kalkulus
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TEMPLATE')}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                activeTab === 'TEMPLATE'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Contoh Rumus Jadi
            </button>
          </div>

          {/* Tab 1: Favorite */}
          {activeTab === 'FAVORITE' && (
            <div className="flex flex-wrap gap-1.5">
              {FAVORITE_SNIPPETS.map((snip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onInsert(snip.code)}
                  title={snip.tooltip}
                  className="px-2.5 py-1.5 bg-gray-50 hover:bg-indigo-50 text-gray-800 hover:text-indigo-700 border border-gray-200 hover:border-indigo-300 rounded-lg text-xs font-serif font-medium transition shadow-2xs active:scale-95 flex items-center justify-center min-w-[34px]"
                >
                  {snip.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab 2: Advanced */}
          {activeTab === 'ADVANCED' && (
            <div className="flex flex-wrap gap-1.5">
              {ADVANCED_SNIPPETS.map((snip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onInsert(snip.code)}
                  title={snip.tooltip}
                  className="px-2.5 py-1.5 bg-gray-50 hover:bg-indigo-50 text-gray-800 hover:text-indigo-700 border border-gray-200 hover:border-indigo-300 rounded-lg text-xs font-serif font-medium transition shadow-2xs active:scale-95 flex items-center justify-center min-w-[34px]"
                >
                  {snip.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab 3: Template Examples */}
          {activeTab === 'TEMPLATE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {TEMPLATE_SNIPPETS.map((tpl, idx) => {
                const isCopied = copiedTemplate === tpl.title;
                return (
                  <div
                    key={idx}
                    className="p-2 bg-gray-50 hover:bg-indigo-50/50 border border-gray-200 rounded-lg text-xs transition flex flex-col justify-between gap-1.5"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 text-[11px]">{tpl.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded font-medium">
                          {tpl.category}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-indigo-700 bg-white p-1 rounded border border-gray-100 truncate">
                        {tpl.text}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onInsert(tpl.text);
                        setCopiedTemplate(tpl.title);
                        setTimeout(() => setCopiedTemplate(null), 1500);
                      }}
                      className="w-full mt-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      {isCopied ? (
                        <>
                          <Check size={12} className="text-emerald-300" />
                          <span>Disisipkan!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Sisipkan ke Form</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
