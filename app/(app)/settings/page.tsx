"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  Sparkles,
  User,
  Plus,
  CheckCircle2,
  Loader2,
  Scan,
  Pencil,
  RotateCcw,
  X,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAppState, TONE_CONTEXT_LABELS } from "@/lib/dirac/store";
import type { ToneProfile, ConditionalTone, ToneContext } from "@/lib/dirac/store";

// ─── Outlook icon (simple SVG) ──────────────────────────

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 7L2 7" />
    </svg>
  );
}

// ─── Types ──────────────────────────────────────────────

interface OutlookStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
}

// ─── Page wrapper (Suspense for useSearchParams) ────────

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

// ─── Tone profile section ────────────────────────────────

const FORMALITY_LABELS: Record<string, string> = {
  formal: "Formal",
  "semi-formal": "Semi-formal",
  casual: "Casual",
  "very-casual": "Very casual",
};

// ─── AI Settings Section ─────────────────────────────────

interface ModelOption {
  id: string;
  label: string;
  provider: string;
  speed: "fast" | "medium" | "slow";
  cost: "cheap" | "mid" | "expensive";
  context: string;
  note?: string;
}

const PRESET_MODELS: ModelOption[] = [
  {
    id: "anthropic/claude-haiku-4-4",
    label: "Claude Haiku 4.4",
    provider: "Anthropic",
    speed: "fast",
    cost: "cheap",
    context: "200K tokens",
    note: "Default — fast, affordable, great for email tasks",
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "Anthropic",
    speed: "medium",
    cost: "mid",
    context: "200K tokens",
    note: "Stronger reasoning and writing quality",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    speed: "medium",
    cost: "mid",
    context: "200K tokens",
    note: "Excellent at long-form writing and nuance",
  },
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    speed: "fast",
    cost: "cheap",
    context: "1M tokens",
    note: "Fast, cheap, huge context window",
  },
  {
    id: "google/gemini-2.5-pro-preview-03-25",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    speed: "medium",
    cost: "mid",
    context: "1M tokens",
    note: "Strongest reasoning from Google",
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    speed: "medium",
    cost: "expensive",
    context: "128K tokens",
    note: "Great at structured output and function calling",
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    speed: "fast",
    cost: "cheap",
    context: "128K tokens",
    note: "Fast and cheap OpenAI model",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    provider: "Meta",
    speed: "medium",
    cost: "cheap",
    context: "128K tokens",
    note: "Open source, no data retention",
  },
];

const SPEED_COLORS = {
  fast:   "text-green-600  bg-green-50  dark:bg-green-950/40  dark:text-green-400",
  medium: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-400",
  slow:   "text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-400",
};

const COST_COLORS = {
  cheap:     "text-green-600  bg-green-50  dark:bg-green-950/40  dark:text-green-400",
  mid:       "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-400",
  expensive: "text-red-600    bg-red-50    dark:bg-red-950/40    dark:text-red-400",
};

const COST_LABEL  = { cheap: "$",  mid: "$$",  expensive: "$$$" };
const SPEED_LABEL = { fast: "Fast", medium: "Med", slow: "Slow" };

function ModelPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>
      {label}
    </span>
  );
}

function AiSettingsSection() {
  const [selectedModel,    setSelectedModel]    = useState<string>("anthropic/claude-haiku-4-4");
  const [customModel,      setCustomModel]      = useState<string>("");
  const [aboutMe,          setAboutMe]          = useState<string>("");
  const [modelSearch,      setModelSearch]      = useState<string>("");
  const [saving,           setSaving]           = useState(false);
  const [saved,            setSaved]            = useState(false);
  const [saveError,        setSaveError]        = useState<string | null>(null);
  const [loading,          setLoading]          = useState(true);

  // Load saved settings on mount
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => {
        if (data.aiModel) {
          const isPreset = PRESET_MODELS.some(m => m.id === data.aiModel);
          if (isPreset) {
            setSelectedModel(data.aiModel);
          } else {
            setSelectedModel("custom");
            setCustomModel(data.aiModel);
          }
        }
        if (data.aboutMe) setAboutMe(data.aboutMe);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Auto-save when model changes (debounced)
  const saveSettings = useCallback(async (aiModel: string, aboutMeVal: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiModel, aboutMe: aboutMeVal }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    const activeModel = modelId === "custom" ? customModel : modelId;
    if (activeModel) saveSettings(activeModel, aboutMe);
  };

  const handleCustomModelBlur = () => {
    if (customModel.trim()) saveSettings(customModel.trim(), aboutMe);
  };

  const handleAboutMeBlur = () => {
    const activeModel = selectedModel === "custom" ? customModel : selectedModel;
    saveSettings(activeModel, aboutMe);
  };

  const filteredModels = modelSearch.trim()
    ? PRESET_MODELS.filter(m =>
        m.label.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.provider.toLowerCase().includes(modelSearch.toLowerCase())
      )
    : PRESET_MODELS;

  const activeModelInfo = PRESET_MODELS.find(m => m.id === selectedModel);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">AI settings</h2>
        </div>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {saved && !saving && (
          <span className="flex items-center gap-1 text-[11px] text-green-600">
            <CheckCircle2 className="h-3 w-3" /> Saved
          </span>
        )}
        {saveError && <span className="text-[11px] text-red-500">{saveError}</span>}
      </div>

      <div className="space-y-6">

        {/* Model selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground">Model</label>
            {activeModelInfo && (
              <span className="text-[11px] text-muted-foreground">
                Active: <span className="font-medium text-foreground">{activeModelInfo.label}</span>
              </span>
            )}
            {selectedModel === "custom" && customModel && (
              <span className="text-[11px] text-muted-foreground">
                Active: <span className="font-mono font-medium text-foreground">{customModel}</span>
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-2">
              {/* Search */}
              <Input
                value={modelSearch}
                onChange={e => setModelSearch(e.target.value)}
                placeholder="Search models…"
                className="text-xs h-8"
              />

              {/* Model list */}
              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {filteredModels.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">No models match</p>
                )}
                {filteredModels.map(m => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleModelSelect(m.id)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-primary/8 dark:bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {/* Radio dot */}
                      <div className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-medium ${isSelected ? "text-foreground" : "text-foreground"}`}>
                            {m.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">{m.provider}</span>
                          <div className="flex items-center gap-1 ml-auto">
                            <ModelPill label={SPEED_LABEL[m.speed]} color={SPEED_COLORS[m.speed]} />
                            <ModelPill label={COST_LABEL[m.cost]} color={COST_COLORS[m.cost]} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {m.note && (
                            <p className="text-[11px] text-muted-foreground truncate">{m.note}</p>
                          )}
                          <span className="text-[10px] text-muted-foreground/40 shrink-0 ml-auto">{m.context}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Custom slug */}
                <button
                  onClick={() => handleModelSelect("custom")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    selectedModel === "custom" ? "bg-primary/8 dark:bg-primary/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors ${
                    selectedModel === "custom" ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`} />
                  <span className="text-xs font-medium text-foreground">Custom slug</span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">
                    any model on openrouter.ai/models
                  </span>
                </button>
              </div>

              {selectedModel === "custom" && (
                <Input
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  onBlur={handleCustomModelBlur}
                  placeholder="e.g. deepseek/deepseek-r1-distill-qwen-32b"
                  className="text-xs font-mono"
                  autoFocus
                />
              )}
            </div>
          )}
        </div>

        {/* About you */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            About you{" "}
            <span className="font-normal text-muted-foreground/60">— gives AI context when drafting</span>
          </label>
          <Textarea
            value={aboutMe}
            onChange={e => setAboutMe(e.target.value)}
            onBlur={handleAboutMeBlur}
            placeholder="e.g. I'm a product manager at a Series B startup. I mostly email engineers, investors, and customers. Keep it brief."
            className="mt-1.5 text-sm min-h-[72px] resize-none"
            rows={3}
          />
        </div>

      </div>
    </section>
  );
}

// ─── Appearance Section ───────────────────────────────────

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useAppState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const themes = [
    { id: "light",  label: "Light",  icon: Sun  },
    { id: "dark",   label: "Dark",   icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ] as const;

  const densities = [
    { id: "comfortable", label: "Comfortable", desc: "More breathing room between threads" },
    { id: "compact",     label: "Compact",     desc: "Fit more threads on screen" },
  ] as const;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Monitor className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
      </div>

      <div className="space-y-5">
        {/* Theme */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Theme</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {themes.map(t => {
              const Icon = t.icon;
              const active = mounted && theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 transition-colors ${
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Density */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Thread density</label>
          <div className="mt-2 space-y-1.5">
            {densities.map(d => (
              <button
                key={d.id}
                onClick={() => setDensity(d.id)}
                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  density === d.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <div className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors ${
                  density === d.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                }`} />
                <div>
                  <p className="text-xs font-medium text-foreground">{d.label}</p>
                  <p className="text-[11px] text-muted-foreground">{d.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ToneSection() {
  const { toneProfile, setToneProfile } = useAppState();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSummary, setEditSummary] = useState("");

  const handleAutoDetect = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/tone", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setToneProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze tone");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveManual = () => {
    if (!editSummary.trim()) return;
    const profile: ToneProfile = {
      summary: editSummary.trim(),
      formality: "semi-formal",
      traits: [],
      greeting_style: "",
      signoff_style: "",
      example_phrases: [],
    };
    setToneProfile(profile);
    setEditing(false);
  };

  const handleStartEdit = () => {
    setEditSummary(toneProfile?.summary ?? "");
    setEditing(true);
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Writing tone
        </h2>
      </div>

      {!toneProfile && !editing ? (
        // No tone set — show setup options
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Dirac matches your writing style when drafting replies. Set your
            tone so AI responses sound like you.
          </p>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleAutoDetect}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scan className="h-3.5 w-3.5" />
              )}
              {analyzing ? "Analyzing emails..." : "Auto-detect from emails"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Describe manually
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>
      ) : editing ? (
        // Manual editing
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">
              Describe your writing style in a few sentences
            </label>
            <Textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="e.g., I write casually but professionally. I keep emails short, use contractions, rarely use exclamation marks, and sign off with just my first name."
              className="mt-1 text-sm min-h-[80px]"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="text-xs"
              onClick={handleSaveManual}
              disabled={!editSummary.trim()}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : toneProfile ? (
        // Tone profile display
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div>
              <p className="text-sm text-foreground">{toneProfile.summary}</p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {toneProfile.formality && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {FORMALITY_LABELS[toneProfile.formality] ?? toneProfile.formality}
                </Badge>
              )}
              {toneProfile.traits.map((trait) => (
                <Badge
                  key={trait}
                  variant="secondary"
                  className="text-[10px] font-normal"
                >
                  {trait}
                </Badge>
              ))}
            </div>

            {(toneProfile.greeting_style || toneProfile.signoff_style) && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                {toneProfile.greeting_style && (
                  <div>
                    <span className="text-muted-foreground">Greeting: </span>
                    <span className="text-foreground">
                      {toneProfile.greeting_style}
                    </span>
                  </div>
                )}
                {toneProfile.signoff_style && (
                  <div>
                    <span className="text-muted-foreground">Sign-off: </span>
                    <span className="text-foreground">
                      {toneProfile.signoff_style}
                    </span>
                  </div>
                )}
              </div>
            )}

            {toneProfile.example_phrases.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">
                  Characteristic phrases:{" "}
                </span>
                <span className="text-foreground italic">
                  {toneProfile.example_phrases
                    .map((p) => `"${p}"`)
                    .join(", ")}
                </span>
              </div>
            )}

            {toneProfile.conditional_tones && toneProfile.conditional_tones.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground">
                  Contextual tone shifts
                </p>
                {toneProfile.conditional_tones.map((ct, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-muted/40 px-3 py-2 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {TONE_CONTEXT_LABELS[ct.context as ToneContext] ?? ct.context}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-normal"
                      >
                        {FORMALITY_LABELS[ct.formality] ?? ct.formality}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{ct.tone}</p>
                    {ct.traits.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ct.traits.map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {ct.example_phrases.length > 0 && (
                      <p className="text-[11px] italic text-muted-foreground">
                        {ct.example_phrases.map((p) => `"${p}"`).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleStartEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleAutoDetect}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Re-analyze
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setToneProfile(null)}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

// ─── Settings content ───────────────────────────────────

function SettingsContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const isLoading = status === "loading";
  const gmailConnected = session?.gmailConnected ?? false;

  // Outlook state
  const [outlookStatus, setOutlookStatus] = useState<OutlookStatus>({
    connected: false,
  });
  const [outlookLoading, setOutlookLoading] = useState(true);

  const fetchOutlookStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/outlook/status");
      if (res.ok) {
        const data = await res.json();
        setOutlookStatus(data);
      }
    } catch {
      setOutlookStatus({ connected: false });
    } finally {
      setOutlookLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutlookStatus();
  }, [fetchOutlookStatus]);

  // Check for outlook=connected query param
  useEffect(() => {
    if (searchParams.get("outlook") === "connected") {
      fetchOutlookStatus();
    }
  }, [searchParams, fetchOutlookStatus]);

  // ─── Handlers ─────────────────────────────────────────

  const handleGmailConnect = () => {
    signIn("google", { callbackUrl: "/settings" });
  };

  const handleGmailDisconnect = () => {
    signOut({ callbackUrl: "/settings" });
  };

  const handleOutlookConnect = () => {
    window.location.href = "/api/oauth/outlook";
  };

  const handleOutlookDisconnect = async () => {
    setOutlookLoading(true);
    try {
      await fetch("/api/outlook/status", { method: "DELETE" });
      setOutlookStatus({ connected: false });
    } catch {
      // ignore
    } finally {
      setOutlookLoading(false);
    }
  };

  // ─── Connector definitions ────────────────────────────

  const connectors = [
    {
      platform: "Gmail",
      icon: Mail,
      connected: gmailConnected,
      connectedDetail: gmailConnected ? session?.user?.email : undefined,
      description: "Google email — read, reply, and send",
      comingSoon: false,
    },
    {
      platform: "Outlook",
      icon: OutlookIcon,
      connected: outlookStatus.connected,
      connectedDetail: outlookStatus.connected
        ? outlookStatus.email
        : undefined,
      description: "Microsoft 365, Outlook.com, Hotmail",
      comingSoon: false,
    },
  ];

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="dirac-panel flex flex-1 flex-col overflow-auto">
      <div className="border-b border-border px-6 py-3">
        <h1 className="text-sm font-semibold text-foreground">Settings</h1>
      </div>

      <div className="mx-auto w-full max-w-xl space-y-8 px-6 py-6">
        {/* Profile */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                defaultValue={session?.user?.name ?? ""}
                placeholder="Your name"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input
                value={session?.user?.email ?? ""}
                className="mt-1 text-sm"
                disabled
                placeholder="Connect an email to populate"
              />
            </div>
          </div>
        </section>

        <Separator />

        {/* Connected accounts */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Email accounts
            </h2>
          </div>
          <div className="space-y-3">
            {connectors.map((c) => (
              <div
                key={c.platform}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {c.platform}
                      </span>
                      {c.comingSoon && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          Coming soon
                        </Badge>
                      )}
                      {c.connected && (
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[10px] font-normal text-green-600"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.connected && c.connectedDetail
                        ? c.connectedDetail
                        : c.description}
                    </p>
                  </div>
                </div>

                {c.platform === "Gmail" ? (
                  <Button
                    variant={c.connected ? "outline" : "default"}
                    size="sm"
                    className="text-xs"
                    onClick={
                      c.connected ? handleGmailDisconnect : handleGmailConnect
                    }
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : c.connected ? (
                      "Disconnect"
                    ) : (
                      "Connect"
                    )}
                  </Button>
                ) : c.platform === "Outlook" ? (
                  <Button
                    variant={outlookStatus.connected ? "outline" : "default"}
                    size="sm"
                    className="text-xs"
                    onClick={
                      outlookStatus.connected
                        ? handleOutlookDisconnect
                        : handleOutlookConnect
                    }
                    disabled={outlookLoading}
                  >
                    {outlookLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : outlookStatus.connected ? (
                      "Disconnect"
                    ) : (
                      "Connect"
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs"
                    disabled={c.comingSoon}
                  >
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Connection guidance */}
          {!gmailConnected && !outlookStatus.connected && (
            <p className="mt-3 text-xs text-muted-foreground/60">
              Connect at least one email account to start using Dirac.
            </p>
          )}
          {gmailConnected && outlookStatus.connected && (
            <p className="mt-3 text-xs text-muted-foreground/60">
              Both accounts synced. All emails appear in a unified inbox.
            </p>
          )}
        </section>

        <Separator />

        {/* Appearance */}
        <AppearanceSection />

        <Separator />

        {/* AI preferences — Tone */}
        <ToneSection />

        <Separator />

        {/* Other AI settings */}
        <AiSettingsSection />

        <Separator />

        {/* Keyboard shortcuts */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
          </div>
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border text-xs">
            {[
              ["?",          "Show shortcuts"],
              ["Cmd/Ctrl K", "Open command palette"],
              ["R",          "Reply to selected thread"],
              ["E",          "Archive thread"],
              ["#",          "Delete thread"],
              ["U",          "Mark unread"],
              ["S",          "Star / unstar"],
              ["G I",        "Go to inbox"],
              ["G A",        "Go to activity"],
              ["G S",        "Go to settings"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <kbd className="font-mono text-[10px] bg-muted border border-border rounded px-1.5 py-0.5">{key}</kbd>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
