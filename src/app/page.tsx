"use client";

import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookMarked,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  Flame,
  Headphones,
  Lightbulb,
  ListChecks,
  Mic2,
  MoreHorizontal,
  PencilLine,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Volume2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { VocabularyView } from "@/components/vocabulary-view";
import type { FeedbackCriterion, FeedbackReport } from "@/lib/feedback";
import { gradeListeningSection, type ListeningCompletionQuestion, type ListeningMultipleChoiceQuestion, type ListeningQuestionResult, type ListeningResult, type ListeningSection } from "@/lib/listening";
import { listeningSection } from "@/lib/listening-data";
import { elapsedMinutes } from "@/lib/practice-time";
import { getDailyTask2Question } from "@/lib/questions-data";
import { task2TypeLabels } from "@/lib/questions";
import { gradeReadingPassage, type ReadingCompletionQuestion, type ReadingHeadingQuestion, type ReadingPassage, type ReadingQuestionResult, type ReadingResult, type ReadingTfngQuestion } from "@/lib/reading";
import { readingPassage } from "@/lib/reading-data";
import { defaultData, isValidState, type FeedbackHistoryEntry, type Mistake, type Profile, type SavedData, type Skill, type StudyLog, type VocabularyReviewSource } from "@/lib/study-data";
import type { VocabularyWord } from "@/lib/vocabulary";
import { createVocabularyReview, dueVocabularyReviews, scheduleVocabularyReview, type ReviewRating } from "@/lib/vocabulary-review";
import { diffWords } from "@/lib/word-diff";

type View = "today" | "practice" | "review" | "vocabulary" | "feedback" | "progress";

const feedbackBandKeys = [
  { key: "TR", label: "任务回应", color: "#2f7cf6" },
  { key: "CC", label: "连贯与衔接", color: "#237a45" },
  { key: "LR", label: "词汇资源", color: "#8a5a00" },
  { key: "GRA", label: "语法多样性", color: "#6b4fa1" },
] as const;

const skills: { id: Skill; name: string; en: string; icon: typeof BookOpen; tint: string; minutes: number }[] = [
  { id: "listening", name: "听力", en: "Listening", icon: Headphones, tint: "blue", minutes: listeningSection.practiceMinutes },
  { id: "reading", name: "阅读", en: "Reading", icon: BookOpen, tint: "green", minutes: readingPassage.minutes },
  { id: "writing", name: "写作", en: "Writing", icon: PencilLine, tint: "orange", minutes: 20 },
  { id: "speaking", name: "口语", en: "Speaking", icon: Mic2, tint: "violet", minutes: 10 },
  { id: "vocabulary", name: "词汇", en: "Vocabulary", icon: BookMarked, tint: "teal", minutes: 20 },
];

const navItems: { id: View; label: string; icon: typeof BookOpen }[] = [
  { id: "today", label: "今日计划", icon: CalendarDays },
  { id: "practice", label: "练习中心", icon: ListChecks },
  { id: "review", label: "错题复练", icon: RotateCcw },
  { id: "vocabulary", label: "词汇", icon: BookMarked },
  { id: "feedback", label: "AI 批改", icon: Sparkles },
  { id: "progress", label: "学习进度", icon: TrendingUp },
];

const skillNames: Record<Skill, string> = {
  listening: "听力",
  reading: "阅读",
  writing: "写作",
  speaking: "口语",
  vocabulary: "词汇",
};

function localDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(date);
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function daysToExam(examDate: string) {
  if (!examDate) return null;
  const exam = new Date(`${examDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((exam.getTime() - today.getTime()) / 86_400_000);
}

function getStreak(checkIns: string[]) {
  const dates = new Set(checkIns);
  const cursor = new Date();
  if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dates.has(localDateKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function Sidebar({ view, onNavigate, openSettings, pendingReviews, pendingVocabulary }: { view: View; onNavigate: (view: View) => void; openSettings: () => void; pendingReviews: number; pendingVocabulary: number }) {
  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="#today" onClick={(event) => { event.preventDefault(); onNavigate("today"); }}>
          <span className="brand-mark"><AudioLines size={19} strokeWidth={2.2} /></span>
          <span><strong>steady</strong><small>IELTS study</small></span>
        </a>
        <div className="sidebar-label">学习空间</div>
        <nav className="primary-nav" aria-label="主导航">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button className={`nav-link ${view === id ? "active" : ""}`} key={id} onClick={() => onNavigate(id)}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "review" && pendingReviews > 0 && <span className="nav-count">{pendingReviews}</span>}
              {id === "vocabulary" && pendingVocabulary > 0 && <span className="nav-count">{pendingVocabulary}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <span className="note-icon"><Lightbulb size={16} /></span>
          <p>稳定练习，比一次学很久更重要。</p>
        </div>
        <button className="nav-link settings-link" onClick={openSettings}><Settings2 size={18} strokeWidth={1.8} /><span>目标与设置</span></button>
        <div className="profile-row">
          <div className="avatar">L</div>
          <div className="profile-copy"><strong>我的备考</strong><small>个人学习空间</small></div>
          <MoreHorizontal size={19} className="muted-icon" />
        </div>
      </aside>
      <nav className="mobile-nav" aria-label="主导航">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => onNavigate(id)} aria-label={label}>
            <Icon size={20} strokeWidth={1.9} /><span>{label}</span>
            {id === "review" && pendingReviews > 0 && <i />}
            {id === "vocabulary" && pendingVocabulary > 0 && <i />}
          </button>
        ))}
      </nav>
    </>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  );
}

function AppButton({ children, onClick, variant = "secondary", icon: Icon, disabled = false, type = "button" }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "quiet"; icon?: typeof ArrowRight; disabled?: boolean; type?: "button" | "submit" }) {
  return <button type={type} className={`button button-${variant}`} onClick={onClick} disabled={disabled}>{Icon && <Icon size={16} strokeWidth={2} />}{children}</button>;
}

export default function Home() {
  const [view, setView] = useState<View>("today");
  const [data, setData] = useState<SavedData>(defaultData);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [answer, setAnswer] = useState("");
  const [sessionResult, setSessionResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | Skill>("all");
  const [essay, setEssay] = useState("");
  const [feedback, setFeedback] = useState<FeedbackReport | null>(null);
  const [feedbackMinutes, setFeedbackMinutes] = useState<number | null>(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [goalDraft, setGoalDraft] = useState<Profile>(defaultData().profile);
  const [notice, setNotice] = useState("");
  const saveQueue = useRef(Promise.resolve());
  const lastQueuedData = useRef<string | null>(null);
  const saveVersion = useRef(0);
  const writingStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStudyData() {
      try {
        const response = await fetch("/api/study", { cache: "no-store" });
        if (!response.ok) throw new Error("Study data could not be loaded");
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("state" in result)
          || (result.state !== null && !isValidState(result.state))) {
          throw new Error("Study data response is invalid");
        }
        if (cancelled) return;
        const loadedData = result.state ?? defaultData();
        lastQueuedData.current = JSON.stringify(loadedData);
        setData(loadedData);
        setHydrated(true);
      } catch {
        if (cancelled) return;
        setLoadError(true);
      }
    }

    void loadStudyData();
    return () => { cancelled = true; };
  }, [loadAttempt]);

  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify(data);
    if (serialized === lastQueuedData.current) return;
    lastQueuedData.current = serialized;
    const version = ++saveVersion.current;
    setNotice("正在保存学习记录…");
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/study", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: serialized,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(result?.error || "学习记录同步失败。");
      }
      if (saveVersion.current === version) setNotice("学习记录已保存到服务端。");
    }).catch((error: unknown) => {
      if (saveVersion.current === version) {
        lastQueuedData.current = null;
        setNotice(error instanceof Error ? error.message : "学习记录保存失败，请检查服务后重试。");
      }
    });
  }, [data, hydrated]);

  const todayKey = localDateKey();
  const writingQuestion = useMemo(() => getDailyTask2Question(todayKey), [todayKey]);
  const todayLogs = data.logs.filter((log) => log.date === todayKey);
  const todayMinutes = todayLogs.reduce((sum, log) => sum + log.minutes, 0);
  const todayDone = todayLogs.length;
  const pendingMistakes = data.mistakes.filter((item) => !item.mastered);
  const feedbackHistory = data.feedbackHistory ?? [];
  const dueVocabularyCount = dueVocabularyReviews(data.vocabularyReviews ?? [], todayKey).length;
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return { key, label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date), minutes: data.logs.filter((log) => log.date === key).reduce((sum, log) => sum + log.minutes, 0) };
  }), [data.logs]);
  const skillErrors = useMemo(() => skills.map(({ id }) => ({ skill: id, count: pendingMistakes.filter((item) => item.skill === id).length })).sort((a, b) => b.count - a.count), [pendingMistakes]);
  const weakestSkill = skillErrors[0]?.count ? skillErrors[0].skill : null;
  const planSkills: Skill[] = weakestSkill
    ? [weakestSkill, ...skills.map((skill) => skill.id).filter((skill) => skill !== weakestSkill).slice(0, 2)]
    : ["reading", "listening", "speaking"];
  const streak = getStreak(data.checkIns);
  const totalWeekMinutes = weekDays.reduce((sum, day) => sum + day.minutes, 0);
  const maxWeekMinutes = Math.max(30, ...weekDays.map((day) => day.minutes));
  const completion = Math.min(100, Math.round((todayMinutes / Math.max(1, data.profile.dailyTarget)) * 100));

  function startSkill(skill: Skill) {
    if (!hydrated) return;
    setAnswer("");
    setSessionResult(null);
    if (skill === "vocabulary") {
      setActiveSkill(null);
      setView("vocabulary");
      return;
    }
    if (skill === "writing") {
      writingStartedAtRef.current = Date.now();
      setActiveSkill(null);
      setFeedback(null);
      setFeedbackMinutes(null);
      setFeedbackError("");
      setView("feedback");
      return;
    }
    setActiveSkill(skill);
    setView("practice");
  }

  function recordSession(skill: Skill, minutes: number, correct: number, total: number) {
    if (!hydrated) return;
    const today = localDateKey();
    const log: StudyLog = { id: crypto.randomUUID(), date: today, minutes, skill, correct, total };
    setData((current) => ({ ...current, logs: [...current.logs, log], checkIns: current.checkIns.includes(today) ? current.checkIns : [...current.checkIns, today] }));
  }

  function submitSession(hasRecording: boolean, minutes: number) {
    if (!hydrated || activeSkill !== "speaking" || (!answer && !hasRecording) || sessionResult) return;
    setSessionResult({ correct: true, explanation: "完成了一次口语练习。试着回听自己的回答，检查是否先给出观点，再用细节或例子展开。" });
    recordSession("speaking", minutes, 0, 0);
  }

  function submitReading(answers: Record<string, string>, minutes: number): ReadingResult | null {
    if (!hydrated) return null;
    const result = gradeReadingPassage(readingPassage, answers);
    const today = localDateKey();
    const log: StudyLog = { id: crypto.randomUUID(), date: today, minutes, skill: "reading", correct: result.correct, total: result.total };
    setData((current) => {
      let next: SavedData = {
        ...current,
        logs: [...current.logs, log],
        checkIns: current.checkIns.includes(today) ? current.checkIns : [...current.checkIns, today],
      };
      for (const item of result.results) {
        if (item.correct) continue;
        const id = `${readingPassage.id}-q${item.question.number}`;
        if (next.mistakes.some((mistake) => mistake.id === id)) continue;
        next = {
          ...next,
          mistakes: [{
            id,
            skill: "reading",
            question: `Passage 1 · Q${item.question.number}: ${item.question.prompt}`,
            reason: item.question.explanation,
            date: today,
            mastered: false,
          }, ...next.mistakes],
        };
      }
      return next;
    });
    const wrongText = result.results
      .filter((item) => !item.correct)
      .map((item) => `${item.question.prompt}\n${item.question.explanation}\n${item.question.evidence}\n${item.expected}`)
      .join("\n");
    void addVocabularyFromText(wrongText, "reading");
    return result;
  }

  function submitListening(answers: Record<string, string>, minutes: number): ListeningResult | null {
    if (!hydrated) return null;
    const result = gradeListeningSection(listeningSection, answers);
    const today = localDateKey();
    const log: StudyLog = { id: crypto.randomUUID(), date: today, minutes, skill: "listening", correct: result.correct, total: result.total };
    setData((current) => {
      let next: SavedData = {
        ...current,
        logs: [...current.logs, log],
        checkIns: current.checkIns.includes(today) ? current.checkIns : [...current.checkIns, today],
      };
      for (const item of result.results) {
        if (item.correct) continue;
        const id = `${listeningSection.id}-q${item.question.number}`;
        if (next.mistakes.some((mistake) => mistake.id === id)) continue;
        next = {
          ...next,
          mistakes: [{
            id,
            skill: "listening",
            question: `Listening Section 2 · Q${item.question.number}: ${item.question.prompt}`,
            reason: item.question.explanation,
            date: today,
            mastered: false,
          }, ...next.mistakes],
        };
      }
      return next;
    });
    const wrongText = result.results
      .filter((item) => !item.correct)
      .map((item) => `${item.question.prompt}\n${item.question.explanation}\n${item.question.evidence}\n${item.expected}`)
      .join("\n");
    void addVocabularyFromText(wrongText, "listening");
    return result;
  }

  function markMastered(id: string) {
    if (!hydrated) return;
    setData((current) => ({ ...current, mistakes: current.mistakes.map((item) => item.id === id ? { ...item, mastered: true } : item) }));
  }

  function addVocabularyReview(word: VocabularyWord, source: VocabularyReviewSource) {
    if (!hydrated) return;
    const today = localDateKey();
    setData((current) => {
      const reviews = current.vocabularyReviews ?? [];
      if (reviews.some((entry) => entry.id === word.id)) return current;
      return { ...current, vocabularyReviews: [createVocabularyReview(word.id, word.w, source, today), ...reviews] };
    });
  }

  function reviewVocabulary(id: string, rating: ReviewRating, minutes: number) {
    if (!hydrated) return;
    const today = localDateKey();
    const log: StudyLog = { id: crypto.randomUUID(), date: today, minutes, skill: "vocabulary", correct: 0, total: 0 };
    setData((current) => {
      const reviews = current.vocabularyReviews ?? [];
      return {
        ...current,
        vocabularyReviews: reviews.map((entry) => entry.id === id ? scheduleVocabularyReview(entry, rating, today) : entry),
        logs: [...current.logs, log],
        checkIns: current.checkIns.includes(today) ? current.checkIns : [...current.checkIns, today],
      };
    });
  }

  async function addVocabularyFromText(text: string, source: VocabularyReviewSource) {
    if (!hydrated || !text.trim()) return;
    try {
      const response = await fetch("/api/vocabulary/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, limit: 5 }),
      });
      if (!response.ok) return;
      const payload = await response.json() as { words?: VocabularyWord[] };
      const matches = payload.words ?? [];
      if (matches.length === 0) return;
      const today = localDateKey();
      setData((current) => {
        const reviews = current.vocabularyReviews ?? [];
        const additions = matches
          .filter((word) => !reviews.some((entry) => entry.id === word.id))
          .map((word) => createVocabularyReview(word.id, word.w, source, today));
        if (additions.length === 0) return current;
        return { ...current, vocabularyReviews: [...additions, ...reviews] };
      });
    } catch {
      return;
    }
  }

  async function addVocabularySpellingSignals(text: string) {
    if (!hydrated || !text.trim()) return;
    try {
      const response = await fetch("/api/vocabulary/spellcheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, limit: 5 }),
      });
      if (!response.ok) return;
      const payload = await response.json() as { words?: VocabularyWord[] };
      const matches = payload.words ?? [];
      if (matches.length === 0) return;
      const today = localDateKey();
      setData((current) => {
        const nextSignals = (current.vocabularySignals ?? []).map((signal) => ({ ...signal }));
        const reviews = current.vocabularyReviews ?? [];
        const additions: ReturnType<typeof createVocabularyReview>[] = [];

        for (const word of matches) {
          const index = nextSignals.findIndex((signal) => signal.id === word.id);
          if (index >= 0) {
            nextSignals[index] = {
              ...nextSignals[index],
              count: nextSignals[index].count + 1,
              lastSeen: today,
            };
          } else {
            nextSignals.push({ id: word.id, word: word.w, count: 1, lastSeen: today });
          }

          const signal = nextSignals.find((entry) => entry.id === word.id);
          if (signal && signal.count >= 2
            && !reviews.some((review) => review.id === word.id)
            && !additions.some((review) => review.id === word.id)) {
            additions.push(createVocabularyReview(word.id, word.w, "writing", today));
          }
        }

        const next: SavedData = { ...current, vocabularySignals: nextSignals };
        if (additions.length > 0) next.vocabularyReviews = [...additions, ...reviews];
        return next;
      });
    } catch {
      return;
    }
  }

  async function submitEssay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated) return;
    const minutes = elapsedMinutes(writingStartedAtRef.current);
    setFeedbackLoading(true);
    setFeedbackError("");
    setFeedback(null);
    setFeedbackMinutes(null);
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ essay, prompt: writingQuestion.prompt }) });
      const result = await response.json() as FeedbackReport & { error?: string };
      if (!response.ok) throw new Error(result.error || "批改暂时不可用，请稍后重试。");
      setFeedback(result);
      setFeedbackMinutes(minutes);
      writingStartedAtRef.current = null;
      recordSession("writing", minutes, 0, 0);
      if (!result.demo) {
        const lr = result.criteria[2];
        void addVocabularyFromText(`${lr.observation}\n${lr.suggestion}`, "writing");
      }
      void addVocabularySpellingSignals(essay);
      const weakest = result.criteria.reduce<FeedbackCriterion | null>(
        (lowest, criterion) => !lowest || criterion.band < lowest.band ? criterion : lowest,
        null,
      );
      const mistake: Mistake | null = weakest && weakest.band <= 5.5 ? {
        id: result.submissionId,
        skill: "writing",
        question: `Writing Task 2 · ${weakest.name}`,
        reason: weakest.suggestion,
        date: localDateKey(),
        mastered: false,
      } : null;
      const historyEntry: FeedbackHistoryEntry | null = result.demo ? null : {
        id: result.submissionId,
        date: localDateKey(),
        overall: result.overallBand,
        bands: {
          TR: result.criteria[0].band,
          CC: result.criteria[1].band,
          LR: result.criteria[2].band,
          GRA: result.criteria[3].band,
        },
      };
      if (mistake || historyEntry) {
        setData((current) => {
          let next = current;
          if (historyEntry && !(current.feedbackHistory ?? []).some((entry) => entry.id === historyEntry.id)) {
            next = { ...next, feedbackHistory: [...(current.feedbackHistory ?? []), historyEntry] };
          }
          if (mistake && !next.mistakes.some((item) => item.id === mistake.id)) {
            next = { ...next, mistakes: [mistake, ...next.mistakes] };
          }
          return next;
        });
      }
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "批改暂时不可用，请稍后重试。");
    } finally {
      setFeedbackLoading(false);
    }
  }

  function saveGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated) return;
    setData((current) => ({ ...current, profile: goalDraft }));
    setSettingsOpen(false);
    setNotice("");
  }

  function openGoalSettings() {
    if (!hydrated) return;
    setGoalDraft(data.profile);
    setSettingsOpen(true);
  }

  function exportStudyData() {
    if (!hydrated) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ielts-coach-backup-${localDateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setSettingsOpen(false);
    setNotice("学习数据备份已导出。");
  }

  const title = navItems.find((item) => item.id === view)?.label || "今日计划";

  return (
    <div className="app-shell">
      <Sidebar view={view} onNavigate={(next) => {
        writingStartedAtRef.current = next === "feedback" ? Date.now() : null;
        setView(next);
        setActiveSkill(null);
      }} openSettings={openGoalSettings} pendingReviews={pendingMistakes.length} pendingVocabulary={dueVocabularyCount} />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>我的学习</span><span className="crumb-divider">/</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            <span className="exam-date-chip"><CalendarDays size={15} />{data.profile.examDate ? daysToExam(data.profile.examDate) === 0 ? "今天考试" : `距考试 ${daysToExam(data.profile.examDate)} 天` : "考试日期未设置"}</span>
            <button className="goal-chip" onClick={openGoalSettings} aria-label="设置目标分数"><Target size={15} />目标 {data.profile.targetBand}</button>
            <button className="top-avatar" onClick={openGoalSettings} aria-label="打开目标设置">L</button>
          </div>
        </header>
        <div className="page-content">
          {!hydrated && <div className="notice" role={loadError ? "alert" : "status"}>
            <span>{loadError ? "服务端学习记录无法读取，已暂停修改和保存。请检查服务后重试。" : "正在读取学习记录，载入后即可开始练习。"}</span>
            {loadError && <AppButton onClick={() => { setLoadError(false); setLoadAttempt((attempt) => attempt + 1); }}>重新读取</AppButton>}
          </div>}
          {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice("")}><X size={15} /></button></div>}
          {view === "today" && <>
            <div className="page-title-row">
              <div><div className="eyebrow">{formatDate(new Date())}</div><h1>今日计划</h1><p>按自己的节奏完成今天的一小步。</p></div>
              <AppButton variant="secondary" icon={Settings2} onClick={openGoalSettings}>调整目标</AppButton>
            </div>
            <div className="today-layout">
              <div className="today-main-column">
                <section className="daily-focus" aria-labelledby="daily-focus-title">
                  <div className="focus-copy">
                    <div className="focus-kicker"><span className="status-dot" />今日学习</div>
                    <h2 id="daily-focus-title">{weakestSkill ? `先复练${skillNames[weakestSkill]}错题` : "从一个短练习开始"}</h2>
                    <p>{weakestSkill ? `你最近的${skillNames[weakestSkill]}错题较多，先花一点时间巩固，再继续新内容。` : "完成一项练习后，系统会记录用时与错题，并据此调整后续建议。"}</p>
                    <div className="focus-meta"><span><Clock3 size={15} />约 {weakestSkill ? 12 : 15} 分钟</span><span><Target size={15} />{weakestSkill ? "错题巩固" : "今日推荐"}</span></div>
                    <AppButton variant="primary" icon={Play} onClick={() => startSkill(weakestSkill || "reading")}>{weakestSkill ? "开始错题复练" : "开始阅读练习"}</AppButton>
                  </div>
                  <div className="focus-side">
                    <div className="focus-side-label">本周节奏</div>
                    <div className="mini-week" aria-label="本周打卡情况">
                      {weekDays.map((day) => <div className={`mini-day ${day.minutes ? "done" : ""}`} key={day.key}><span>{day.label}</span><i>{day.minutes ? <Check size={12} /> : ""}</i></div>)}
                    </div>
                    <div className="focus-side-footer"><Flame size={16} /><strong>{streak}</strong><span>天连续学习</span></div>
                  </div>
                </section>

                <section className="section-block plan-section">
                  <SectionHeading eyebrow="按需调整" title="今天练什么" description="先完成一项也可以，练习结果会更新你的计划。" action={<button className="text-action" onClick={() => setView("practice")}>全部练习 <ArrowRight size={15} /></button>} />
                  <div className="plan-list">
                    {planSkills.map((skill, index) => {
                      const item = skills.find((entry) => entry.id === skill)!;
                      const Icon = item.icon;
                      const isReview = !!weakestSkill && index === 0;
                      const done = todayLogs.some((log) => log.skill === skill);
                      return <div className="plan-row" key={`${skill}-${index}`}>
                        <div className={`plan-icon ${item.tint}`}><Icon size={18} strokeWidth={1.8} /></div>
                        <div className="plan-content"><div className="plan-title-row"><strong>{isReview ? `${item.name}错题复练` : `${item.name}专项练习`}</strong>{done && <span className="done-label"><Check size={12} />已完成</span>}</div><span>{skill === "reading" ? "段落信息定位 · True / False / Not Given" : skill === "listening" ? "场景细节 · 关键词辨音" : skill === "writing" ? "Task 2 · 论点展开与段落衔接" : "Part 2 · 个人经历与细节展开"}</span></div>
                        <span className="plan-time"><Clock3 size={14} />{isReview ? 12 : item.minutes} 分钟</span>
                        <button className="row-start" onClick={() => startSkill(skill)} aria-label={`开始${item.name}练习`}><ArrowRight size={17} /></button>
                      </div>;
                    })}
                  </div>
                </section>

                <section className="section-block skill-section">
                  <SectionHeading eyebrow="专项练习" title="按需覆盖各项能力" action={<button className="text-action" onClick={() => setView("practice")}>练习中心 <ArrowRight size={15} /></button>} />
                  <div className="skill-grid">
                    {skills.map(({ id, name, en, icon: Icon, tint, minutes }) => {
                      const count = data.logs.filter((log) => log.skill === id).length;
                      return <button className="skill-tile" key={id} onClick={() => startSkill(id)}><span className={`skill-icon ${tint}`}><Icon size={19} strokeWidth={1.8} /></span><span className="skill-name"><strong>{name}</strong><small>{en}</small></span><span className="skill-meta">{count ? `${count} 次练习` : `${minutes} 分钟`}</span><ArrowRight size={16} className="skill-arrow" /></button>;
                    })}
                  </div>
                </section>
              </div>

              <aside className="today-aside">
                <section className="aside-section goal-progress">
                  <div className="aside-title-row"><span>每日目标</span><button className="icon-button" onClick={openGoalSettings} aria-label="编辑每日目标"><Settings2 size={16} /></button></div>
                  <div className="goal-numbers"><strong>{todayMinutes}</strong><span>/ {data.profile.dailyTarget} 分钟</span></div>
                  <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
                  <div className="progress-caption"><span>{completion}% 完成</span><span>{todayDone} 项练习</span></div>
                  <button className="goal-edit" onClick={openGoalSettings}>调整每日时长 <ArrowRight size={14} /></button>
                </section>
                <section className="aside-section target-summary">
                  <div className="aside-title-row"><span>备考目标</span><button className="text-action compact" onClick={openGoalSettings}>编辑</button></div>
                  <div className="band-display"><strong>{data.profile.targetBand}</strong><span>目标总分</span><span className="band-pill">IELTS</span></div>
                  <div className="band-scale"><span>5.0</span><i><b style={{ left: `${Math.max(0, Math.min(100, (Number(data.profile.targetBand) - 5) * 25))}%` }} /></i><span>9.0</span></div>
                  <div className="exam-countdown"><CalendarDays size={15} /><span>{data.profile.examDate ? daysToExam(data.profile.examDate)! >= 0 ? `考试日期 ${data.profile.examDate} · 剩余 ${daysToExam(data.profile.examDate)} 天` : `考试日期 ${data.profile.examDate} · 已过期` : "添加考试日期，查看倒计时"}</span></div>
                </section>
                <section className="aside-section review-summary">
                  <div className="aside-title-row"><span>待复习错题</span><button className="text-action compact" onClick={() => setView("review")}>查看全部</button></div>
                  {pendingMistakes.length ? <>
                    <div className="mistake-count"><strong>{pendingMistakes.length}</strong><span>道待巩固</span></div>
                    <div className="mistake-breakdown">{skillErrors.filter((item) => item.count).slice(0, 3).map((item) => <div key={item.skill}><span>{skillNames[item.skill]}</span><span>{item.count}</span></div>)}</div>
                  </> : <div className="empty-inline"><span className="empty-check"><CheckCheck size={17} /></span><div><strong>还没有错题</strong><p>完成练习后，错题会自动整理在这里。</p></div></div>}
                </section>
              </aside>
            </div>
          </>}

          {view === "practice" && <>
            {activeSkill === "reading" ? <ReadingSession passage={readingPassage} ready={hydrated} onSubmit={submitReading} onBack={() => setActiveSkill(null)} /> : activeSkill === "listening" ? <ListeningSession section={listeningSection} ready={hydrated} onSubmit={submitListening} onBack={() => setActiveSkill(null)} /> : activeSkill === "speaking" ? <SpeakingSession answer={answer} setAnswer={setAnswer} result={sessionResult} onSubmit={submitSession} onBack={() => { setActiveSkill(null); setSessionResult(null); }} /> : <>
              <div className="page-title-row"><div><div className="eyebrow">练习与模考</div><h1>练习中心</h1><p>按科目和可用时间选择一项，练习后查看解析。</p></div><span className="small-pill"><AlarmClock size={14} />按 10–20 分钟设计</span></div>
              <div className="practice-overview"><div className="practice-overview-main"><span className="eyebrow">适合工作日的节奏</span><h2>一段专注时间，完成一个小目标。</h2><p>练习会自动计入今日计划。答错的题目进入错题复习，并影响下一次推荐。</p></div><div className="practice-overview-side"><strong>{data.profile.dailyTarget}</strong><span>每日目标 · 分钟</span><button className="text-action" onClick={openGoalSettings}>调整 <ArrowRight size={14} /></button></div></div>
              <section className="section-block practice-list-section"><SectionHeading eyebrow="选择科目" title="开始一项练习" /><div className="practice-cards">{skills.map(({ id, name, en, icon: Icon, tint, minutes }) => <article className="practice-card" key={id}><div className="practice-card-top"><span className={`skill-icon ${tint}`}><Icon size={20} /></span><span className="practice-count">{data.logs.filter((log) => log.skill === id).length} 次完成</span></div><h3>{name}<small>{en}</small></h3><p>{id === "listening" ? "场景对话、细节捕捉与同义表达辨认。" : id === "reading" ? "段落定位、题型策略与同义替换练习。" : id === "writing" ? "Task 1 / Task 2 写作，并获得四项标准反馈。" : id === "vocabulary" ? "复习到期单词，按间隔重复巩固词汇。" : "逐题作答、Part 2 个人陈述与表达复盘。"}</p><div className="practice-card-footer"><span><Clock3 size={14} />约 {minutes} 分钟</span><AppButton variant="secondary" icon={ArrowRight} onClick={() => startSkill(id)}>开始练习</AppButton></div></article>)}</div></section>
              <section className="section-block mock-section"><div className="mock-row"><div className="mock-icon"><FileText size={19} /></div><div><strong>完整模考</strong><p>将听力、阅读、写作组合为一次限时模考。建议在有完整时间时进行。</p></div><span className="coming-label">计划中</span></div></section>
            </>}
          </>}

          {view === "review" && <>
            <div className="page-title-row"><div><div className="eyebrow">针对性巩固</div><h1>错题复练</h1><p>重新理解错误原因，再标记为已掌握。错题分布会调整你的今日建议。</p></div><span className="review-total"><strong>{pendingMistakes.length}</strong> 道待复习</span></div>
            <div className="filter-row" role="tablist" aria-label="筛选错题">{(["all", "listening", "reading", "writing", "speaking"] as const).map((filter) => <button role="tab" aria-selected={reviewFilter === filter} className={reviewFilter === filter ? "selected" : ""} key={filter} onClick={() => setReviewFilter(filter)}>{filter === "all" ? "全部" : skillNames[filter]}{filter !== "all" && <span>{pendingMistakes.filter((item) => item.skill === filter).length}</span>}</button>)}</div>
            <div className="mistake-list">{pendingMistakes.filter((item) => reviewFilter === "all" || item.skill === reviewFilter).length ? pendingMistakes.filter((item) => reviewFilter === "all" || item.skill === reviewFilter).map((item) => <article className="mistake-row" key={item.id}><div className={`mistake-skill-mark ${skills.find((skill) => skill.id === item.skill)?.tint}`}>{item.skill === "reading" ? <BookOpen size={17} /> : item.skill === "listening" ? <Headphones size={17} /> : item.skill === "writing" ? <PencilLine size={17} /> : <Mic2 size={17} />}</div><div className="mistake-content"><div className="mistake-title-line"><span className="mistake-skill-label">{skillNames[item.skill]}</span><span className="mistake-date">{item.date}</span></div><h3>{item.question}</h3><p><strong>错误原因</strong> {item.reason}</p><div className="mistake-recall"><span>复习提示</span><span>先遮住解析，重新说出判断依据或改写答案。</span></div></div><button className="mastered-button" disabled={!hydrated} onClick={() => markMastered(item.id)}><Check size={15} />已掌握</button></article>) : <div className="empty-state"><div className="empty-state-icon"><CheckCheck size={23} /></div><h2>{pendingMistakes.length ? "这个科目暂时没有待复习错题" : "暂时没有待复习错题"}</h2><p>完成阅读或听力练习后，答错的题目会自动加入这里。</p><AppButton variant="secondary" icon={ArrowRight} onClick={() => setView("practice")}>去练习中心</AppButton></div>}</div>
            {data.mistakes.some((item) => item.mastered) && <section className="mastered-section"><h2>已掌握 <span>{data.mistakes.filter((item) => item.mastered).length}</span></h2><p>这些题目已从待复习列表移除，仍保留在学习记录中。</p></section>}
          </>}

          {view === "feedback" && <>
            <div className="page-title-row"><div><div className="eyebrow">Writing Task 2 · TR / CC / LR / GRA</div><h1>AI 写作批改</h1><p>提交作文后，按四项评分标准查看估分、原文证据和下一步建议。</p></div><span className="small-pill"><Sparkles size={14} />练习参考</span></div>
            <div className="writing-layout">
              <form className="essay-panel" onSubmit={submitEssay}>
                <div className="essay-prompt"><div className="prompt-label"><span>Task 2 练习题</span><span>{task2TypeLabels[writingQuestion.type]}</span></div><p>{writingQuestion.prompt}</p><div className="prompt-meta"><span>建议用时 40 分钟</span><span>至少 250 词</span></div></div>
                <label className="essay-label" htmlFor="essay-text">你的作文</label>
                <textarea id="essay-text" className="essay-input" value={essay} onChange={(event) => {
                  setEssay(event.target.value);
                  if (writingStartedAtRef.current === null) writingStartedAtRef.current = Date.now();
                }} placeholder="在这里写下你的 Task 2 作文……" minLength={40} required />
                <div className="essay-footer"><span>输入统计 {essay.trim() ? essay.trim().split(/\s+/).length : 0} 词</span><AppButton type="submit" variant="primary" icon={Sparkles} disabled={!hydrated || feedbackLoading || essay.trim().length < 40}>{feedbackLoading ? "正在分析…" : "提交批改"}</AppButton></div>
                {feedbackError && <div className="feedback-error" role="alert">{feedbackError}</div>}
                <p className="privacy-note"><CircleHelp size={14} />提交后文本会发送至服务器配置的 AI 服务进行分析。不要提交个人敏感信息。</p>
              </form>
              <aside className="feedback-aside"><div className="feedback-aside-heading"><Sparkles size={17} /><strong>反馈包含</strong></div><ul><li><span>TR</span><div><strong>任务回应</strong><small>立场、切题程度与论证</small></div></li><li><span>CC</span><div><strong>连贯与衔接</strong><small>段落组织与逻辑推进</small></div></li><li><span>LR</span><div><strong>词汇资源</strong><small>准确度、搭配与变化</small></div></li><li><span>GRA</span><div><strong>语法多样性与准确性</strong><small>句式控制与错误模式</small></div></li></ul><div className="feedback-disclaimer"><Lightbulb size={15} /><p>估分用于练习参考，不代表官方考试成绩。反馈会引用作文原文，帮助你核对判断依据。</p></div></aside>
            </div>
            {feedback && <section className="feedback-report">
              <div className="report-heading">
                <div><div className="eyebrow">批改完成 {feedback.demo && "· 演示反馈"}</div><h2>你的写作反馈</h2></div>
                <div className="report-band">
                  <strong>{feedback.overallBand.toFixed(1)}</strong><span>练习估分</span>
                  <small className={feedback.wordCount < 250 ? "word-count-warning" : ""}>{feedback.wordCount} 词{feedback.wordCount < 250 ? " · 未达建议长度（不扣分）" : ""}{feedbackMinutes !== null ? ` · 用时 ${feedbackMinutes} 分钟` : ""}</small>
                </div>
              </div>
              {feedback.demo && <div className="demo-note">当前为演示反馈。配置服务端 AI 环境变量后，这里会显示基于你作文内容生成的分析。</div>}
              <div className="criteria-grid">
                {feedback.criteria.map((criterion) => <article className="criterion" key={criterion.name}>
                  <div className="criterion-heading"><span>{criterion.name}</span><strong>{criterion.band.toFixed(1)}</strong></div>
                  <p>{criterion.observation}</p>
                  {criterion.evidenceMissing
                    ? <div className="criterion-evidence-missing">本项未找到可核验原文</div>
                    : <blockquote>“{criterion.evidence}”</blockquote>}
                  <div className="criterion-next"><span>下一步</span>{criterion.suggestion}</div>
                </article>)}
              </div>
              {feedback.polish && feedback.polish.length > 0 && <section className="polish-section">
                <SectionHeading eyebrow="逐段改写" title="润色稿" description="红色为新增或改写，删除线为删掉的原文；下方附中文翻译。" />
                <div className="polish-list">
                  {feedback.polish.map((paragraph) => <article className="polish-item" key={paragraph.paragraph}>
                    <div className="polish-heading">第 {paragraph.paragraph} 段</div>
                    <div className="polish-rewrite">
                      {diffWords(paragraph.original, paragraph.rewrite).map((token, index) => <Fragment key={index}>
                        {token.type === "add" ? <ins>{token.text}</ins> : token.type === "remove" ? <del>{token.text}</del> : token.text}{" "}
                      </Fragment>)}
                    </div>
                    <div className="polish-translation"><span>中文翻译</span>{paragraph.translation}</div>
                  </article>)}
                </div>
              </section>}
              <div className="report-next-step"><Lightbulb size={17} /><div><strong>下一次练习</strong><p>{feedback.nextStep}</p></div></div>
            </section>}
          </>}

          {view === "vocabulary" && <VocabularyView today={todayKey} reviews={data.vocabularyReviews ?? []} hydrated={hydrated} onAddReview={addVocabularyReview} onReview={reviewVocabulary} />}

          {view === "progress" && <>
            <div className="page-title-row"><div><div className="eyebrow">记录与趋势</div><h1>学习进度</h1><p>回看练习时长、打卡和各科练习分布。</p></div><button className="goal-chip" onClick={openGoalSettings}><Target size={15} />目标 {data.profile.targetBand}</button></div>
            <div className="stat-grid"><div className="stat-item"><span>本周练习</span><strong>{totalWeekMinutes}<small>分钟</small></strong><p>近 7 天累计学习时长</p></div><div className="stat-item"><span>完成练习</span><strong>{data.logs.length}<small>项</small></strong><p>各科练习记录</p></div><div className="stat-item"><span>连续打卡</span><strong>{streak}<small>天</small></strong><p>每天完成一项练习即可记录</p></div><div className="stat-item"><span>待复习错题</span><strong>{pendingMistakes.length}<small>道</small></strong><p>完成后可标记为已掌握</p></div></div>
            <div className="progress-layout"><section className="chart-section"><SectionHeading eyebrow="每日记录" title="近 7 天学习时长" description="按完成练习的预计时长统计。" /><div className="week-chart" role="img" aria-label="近七天学习分钟数柱状图">{weekDays.map((day) => <div className="chart-day" key={day.key}><strong>{day.minutes > 0 ? `${day.minutes}m` : ""}</strong><div className="chart-bar-track"><i style={{ height: `${day.minutes ? Math.max(8, (day.minutes / maxWeekMinutes) * 100) : 0}%` }} /></div><span>{day.label}</span></div>)}</div><div className="chart-footer"><span><i />每日学习时长</span><span>合计 {totalWeekMinutes} 分钟</span></div></section>
              <section className="distribution-section"><SectionHeading eyebrow="均衡练习" title="练习分布" /><div className="distribution-list">{skills.map(({ id, name, icon: Icon, tint }) => { const count = data.logs.filter((log) => log.skill === id).length; const pct = data.logs.length ? Math.round(count / data.logs.length * 100) : 0; return <div className="distribution-row" key={id}><span className={`distribution-icon ${tint}`}><Icon size={16} /></span><div className="distribution-detail"><div><strong>{name}</strong><span>{count} 次 · {pct}%</span></div><i><b style={{ width: `${pct}%` }} /></i></div></div>; })}</div></section></div>
            <section className="section-block feedback-history-section">
              <SectionHeading eyebrow="写作趋势" title="四项评分变化" description="仅记录真实 AI 批改；重复提交同一篇不会重复计点。" />
              {feedbackHistory.length ? <div className="feedback-trends">
                {feedbackBandKeys.map(({ key, label, color }) => {
                  const points = feedbackHistory.slice(-12).map((entry) => entry.bands[key]);
                  const latest = points.at(-1);
                  const coordinates = points.map((value, index) => ({
                    x: points.length === 1 ? 60 : 4 + (index / (points.length - 1)) * 112,
                    y: 38 - (value / 9) * 36,
                  }));
                  return <article className="feedback-trend" key={key}>
                    <div className="feedback-trend-head"><span>{key}</span><strong>{latest?.toFixed(1)}</strong></div>
                    <svg viewBox="0 0 120 40" role="img" aria-label={`${label} 最近 ${points.length} 次评分`}>
                      <polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                      {coordinates.map(({ x, y }, index) => <circle key={index} cx={x} cy={y} r="2" fill={color} />)}
                    </svg>
                    <span className="feedback-trend-label">{label} · 最近 {points.length} 次</span>
                  </article>;
                })}
              </div> : <div className="history-empty"><p>提交一篇真实 AI 批改后，这里会显示四项分数变化。</p></div>}
            </section>
            <section className="section-block history-section"><SectionHeading eyebrow="近期活动" title="练习记录" />{data.logs.length ? <div className="history-list">{[...data.logs].reverse().slice(0, 8).map((log) => <div className="history-row" key={log.id}><span className={`history-dot ${skills.find((item) => item.id === log.skill)?.tint}`} /><div><strong>{skillNames[log.skill]}练习</strong><small>{log.date} · {log.total ? `${log.correct}/${log.total} 题正确` : "练习已完成"}</small></div><span>{log.minutes} 分钟</span></div>)}</div> : <div className="history-empty"><p>完成第一项练习后，学习记录会显示在这里。</p><AppButton variant="secondary" icon={ArrowRight} onClick={() => setView("practice")}>开始练习</AppButton></div>}</section>
          </>}
        </div>
      </main>

      {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-heading"><div><div className="eyebrow">备考设置</div><h2 id="settings-title">你的目标</h2></div><button className="icon-button modal-close" onClick={() => setSettingsOpen(false)} aria-label="关闭"><X size={18} /></button></div><form onSubmit={saveGoal} className="goal-form"><label>目标总分<select value={goalDraft.targetBand} onChange={(event) => setGoalDraft({ ...goalDraft, targetBand: event.target.value })}>{["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"].map((score) => <option key={score}>{score}</option>)}</select></label><label>考试日期<input type="date" value={goalDraft.examDate} onChange={(event) => setGoalDraft({ ...goalDraft, examDate: event.target.value })} /></label><fieldset><legend>每日学习目标</legend><div className="duration-options">{[15, 30, 45, 60, 90].map((minutes) => <button type="button" className={goalDraft.dailyTarget === minutes ? "selected" : ""} key={minutes} onClick={() => setGoalDraft({ ...goalDraft, dailyTarget: minutes })}>{minutes}<small>分</small></button>)}</div></fieldset><div className="modal-actions"><AppButton variant="secondary" onClick={() => setSettingsOpen(false)}>取消</AppButton><AppButton type="submit" variant="primary" icon={Check} disabled={!hydrated}>保存目标</AppButton></div></form><div className="backup-section"><div><strong>学习数据备份</strong><p>导出当前学习记录；恢复时替换 data/study-state.json。不包含录音和 API key。</p></div><AppButton variant="secondary" icon={Download} onClick={exportStudyData} disabled={!hydrated}>导出备份</AppButton></div></section></div>}
      {!hydrated && !loadError && <div className="loading-indicator" aria-label="正在载入学习记录" />}
    </div>
  );
}

function ReadingSession({ passage, ready, onSubmit, onBack }: {
  passage: ReadingPassage;
  ready: boolean;
  onSubmit: (answers: Record<string, string>, minutes: number) => ReadingResult | null;
  onBack: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReadingResult | null>(null);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);
  const [submittedMinutes, setSubmittedMinutes] = useState<number | null>(null);

  const tfngQuestions = passage.questions.filter((question): question is ReadingTfngQuestion => question.type === "true-false-not-given");
  const headingQuestions = passage.questions.filter((question): question is ReadingHeadingQuestion => question.type === "matching-headings");
  const completionQuestions = passage.questions.filter((question): question is ReadingCompletionQuestion => question.type === "summary-completion");
  const answered = passage.questions.filter((question) => (answers[question.id] ?? "").trim()).length;

  function updateAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function submit() {
    const minutes = elapsedMinutes(startedAtRef.current);
    const graded = onSubmit(answers, minutes);
    if (graded) {
      setResult(graded);
      setSubmittedMinutes(minutes);
    }
  }

  function feedbackFor(id: string) {
    return result?.results.find((entry) => entry.question.id === id) ?? null;
  }

  function headingText(id: string) {
    return passage.headings.find((heading) => heading.id === id)?.text ?? "";
  }

  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={16} />返回练习中心</button>
    <div className="practice-session-heading">
      <div><div className="eyebrow">阅读 · 完整 Passage 1</div><h1>{passage.title}</h1><p>阅读文章，完成 13 道题。提交后查看答案与解析。</p></div>
      <span className="session-timer"><Clock3 size={15} />约 {passage.minutes} 分钟</span>
    </div>
    {result && <div className="reading-score" role="status"><strong>{result.correct} / {result.total}</strong><span>答对题数{submittedMinutes !== null ? ` · 用时 ${submittedMinutes} 分钟` : ""}</span></div>}
    <div className="reading-session-layout">
      <section className="reading-passage-panel">
        <div className="passage-label"><BookOpen size={15} />Reading Passage 1</div>
        {passage.paragraphs.map((paragraph) => <div className="reading-block" key={paragraph.label}>
          <span className="reading-paragraph-label">{paragraph.label}</span>
          <p>{paragraph.text}</p>
        </div>)}
      </section>
      <section className="reading-questions-panel">
        <ReadingQuestionGroup title="Questions 1–5" typeLabel="TRUE / FALSE / NOT GIVEN">
          {tfngQuestions.map((question) => {
            const graded = feedbackFor(question.id);
            return <article className="reading-question" key={question.id}>
              <div className="question-number">Question {question.number} <span>TRUE / FALSE / NOT GIVEN</span></div>
              <h3>{question.prompt}</h3>
              <div className="answer-options">
                {(["True", "False", "Not Given"] as const).map((option) => {
                  const selected = answers[question.id] === option;
                  const isCorrect = !!result && option === question.answer;
                  const isWrong = !!result && selected && !graded?.correct;
                  return <button className={`${selected ? "chosen" : ""} ${isCorrect ? "correct-answer" : ""} ${isWrong ? "wrong-answer" : ""}`} key={option} onClick={() => updateAnswer(question.id, option)} disabled={!!result}>{option}</button>;
                })}
              </div>
              {graded && <ReadingFeedback graded={graded} question={question} headingText={headingText} />}
            </article>;
          })}
        </ReadingQuestionGroup>

        <ReadingQuestionGroup title="Questions 6–9" typeLabel="MATCHING HEADINGS">
          <div className="heading-options">
            {passage.headings.map((heading) => <div key={heading.id}><span>{heading.id}</span>{heading.text}</div>)}
          </div>
          {headingQuestions.map((question) => {
            const graded = feedbackFor(question.id);
            return <article className="reading-question" key={question.id}>
              <div className="question-number">Question {question.number} <span>MATCHING HEADINGS</span></div>
              <h3>{question.prompt}</h3>
              <select className="reading-select" value={answers[question.id] ?? ""} onChange={(event) => updateAnswer(question.id, event.target.value)} disabled={!!result} aria-label={`Question ${question.number} heading`}>
                <option value="">选择标题</option>
                {passage.headings.map((heading) => <option value={heading.id} key={heading.id}>{heading.id} · {heading.text}</option>)}
              </select>
              {graded && <ReadingFeedback graded={graded} question={question} headingText={headingText} />}
            </article>;
          })}
        </ReadingQuestionGroup>

        <ReadingQuestionGroup title="Questions 10–13" typeLabel="SUMMARY COMPLETION">
          {completionQuestions.map((question) => {
            const graded = feedbackFor(question.id);
            return <article className="reading-question" key={question.id}>
              <div className="question-number">Question {question.number} <span>SUMMARY COMPLETION</span></div>
              <h3>{question.prompt}</h3>
              <input className="reading-input" type="text" value={answers[question.id] ?? ""} onChange={(event) => updateAnswer(question.id, event.target.value)} disabled={!!result} placeholder="输入答案" autoComplete="off" aria-label={`Question ${question.number} answer`} />
              {graded && <ReadingFeedback graded={graded} question={question} headingText={headingText} />}
            </article>;
          })}
        </ReadingQuestionGroup>
      </section>
    </div>
    <div className="reading-actions">
      {result ? <AppButton variant="primary" icon={ArrowRight} onClick={onBack}>完成练习</AppButton> : <AppButton variant="primary" icon={Check} onClick={submit} disabled={!ready || answered < passage.questions.length}>{`提交答案（${answered}/${passage.questions.length}）`}</AppButton>}
      <span>提交后记录用时与错题</span>
    </div>
  </>;
}

function ReadingQuestionGroup({ title, typeLabel, children }: { title: string; typeLabel: string; children: React.ReactNode }) {
  return <section className="reading-question-group">
    <div className="reading-group-heading"><span>{title}</span><small>{typeLabel}</small></div>
    {children}
  </section>;
}

function ReadingFeedback({ graded, question, headingText }: {
  graded: ReadingQuestionResult;
  question: ReadingTfngQuestion | ReadingHeadingQuestion | ReadingCompletionQuestion;
  headingText: (id: string) => string;
}) {
  return <div className={`answer-feedback ${graded.correct ? "correct" : "incorrect"}`} role="status">
    <div className="answer-feedback-title">{graded.correct ? <Check size={17} /> : <CircleHelp size={17} />}{graded.correct ? "回答正确" : "回答错误"}</div>
    {!graded.correct && <p><strong>参考答案</strong> {graded.expected}{question.type === "matching-headings" ? ` · ${headingText(question.answer)}` : ""}</p>}
    <p>{question.explanation}</p>
    {question.evidence
      ? <blockquote className="reading-evidence">“{question.evidence}”</blockquote>
      : question.type === "true-false-not-given" ? <p className="reading-no-evidence">原文没有提供足够信息判断。</p> : null}
  </div>;
}

function ListeningSession({ section, ready, onSubmit, onBack }: {
  section: ListeningSection;
  ready: boolean;
  onSubmit: (answers: Record<string, string>, minutes: number) => ListeningResult | null;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"practice" | "exam">("practice");
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ListeningResult | null>(null);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);
  const [submittedMinutes, setSubmittedMinutes] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const mcQuestions = section.questions.filter((question): question is ListeningMultipleChoiceQuestion => question.type === "multiple-choice");
  const completionQuestions = section.questions.filter((question): question is ListeningCompletionQuestion => question.type === "note-completion");
  const answered = section.questions.filter((question) => (answers[question.id] ?? "").trim()).length;

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  function play() {
    if (typeof window === "undefined") return;
    if (playing || (mode === "exam" && hasPlayed)) return;
    if (section.audioFile) {
      const audio = audioRef.current;
      if (!audio) {
        setAudioError("录音文件尚未加载，请稍后重试。");
        return;
      }
      setAudioError("");
      setPlaying(true);
      setHasPlayed(true);
      audio.currentTime = 0;
      void audio.play().catch(() => {
        setPlaying(false);
        setHasPlayed(false);
        setAudioError("录音播放失败，请检查音频文件路径。");
      });
      return;
    }
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setAudioError("此浏览器暂不支持语音播放，请更换浏览器或检查语音设置。");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(section.script.join("\n\n"));
    utterance.lang = "en-GB";
    utterance.rate = 0.88;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => {
      setPlaying(false);
      setAudioError("播放失败，请检查浏览器语音设置。");
    };
    setAudioError("");
    setPlaying(true);
    setHasPlayed(true);
    window.speechSynthesis.speak(utterance);
  }

  function updateAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function submit() {
    const minutes = elapsedMinutes(startedAtRef.current);
    const graded = onSubmit(answers, minutes);
    if (graded) {
      setResult(graded);
      setSubmittedMinutes(minutes);
    }
  }

  function feedbackFor(id: string) {
    return result?.results.find((entry) => entry.question.id === id) ?? null;
  }

  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={16} />返回练习中心</button>
    <div className="practice-session-heading">
      <div><div className="eyebrow">听力 · 完整 Section 2</div><h1>{section.title}</h1><p>听完整段录音，完成 10 道题。考试模式只能播放一次。</p></div>
      <span className="session-timer"><Clock3 size={15} />音频约 {section.audioMinutes} 分钟 · 练习约 {section.practiceMinutes} 分钟</span>
    </div>
    <section className="listening-audio-panel">
      <div className="passage-label"><Headphones size={15} />Listening · Section 2 · {section.audioFile ? "真人录音" : "浏览器语音"}</div>
      <div className="listening-mode" role="group" aria-label="收听模式">
        <button type="button" className={mode === "practice" ? "selected" : ""} onClick={() => setMode("practice")} disabled={playing || hasPlayed}>练习模式 · 可重复</button>
        <button type="button" className={mode === "exam" ? "selected" : ""} onClick={() => setMode("exam")} disabled={playing || hasPlayed}>考试模式 · 只播一遍</button>
      </div>
      <div className="audio-player">
        <button className="audio-play" onClick={play} disabled={playing || (mode === "exam" && hasPlayed)} aria-label="播放听力">{playing ? <Volume2 size={20} /> : <Play size={20} />}</button>
        <div className={`audio-wave ${playing ? "playing" : ""}`} aria-hidden="true">{Array.from({ length: 42 }, (_, index) => <i key={index} style={{ height: `${12 + ((index * 17) % 29)}px` }} />)}</div>
        <span>{playing ? "播放中…" : mode === "exam" && hasPlayed ? "已播放一次" : `约 ${section.audioMinutes} 分钟`}</span>
      </div>
      {section.audioFile && <audio ref={audioRef} src={section.audioFile} onEnded={() => setPlaying(false)} onError={() => {
        setPlaying(false);
        setHasPlayed(false);
        setAudioError("录音文件无法播放，请检查路径。");
      }} preload="auto" hidden />}
      <p className="audio-hint">{mode === "exam" ? "考试模式：音频只能播放一次，离开本页后可重新开始。" : "练习模式：可以反复收听。"}</p>
      {audioError && <p className="audio-error" role="alert">{audioError}</p>}
      {result && <details className="listening-transcript"><summary>查看听力原文</summary>{section.script.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</details>}
    </section>
    {result && <div className="reading-score" role="status"><strong>{result.correct} / {result.total}</strong><span>答对题数{submittedMinutes !== null ? ` · 用时 ${submittedMinutes} 分钟` : ""}</span></div>}
    <section className="reading-questions-panel listening-questions-panel">
      <ListeningQuestionGroup title="Questions 1–4" typeLabel="MULTIPLE CHOICE">
        {mcQuestions.map((question) => {
          const graded = feedbackFor(question.id);
          return <article className="reading-question" key={question.id}>
            <div className="question-number">Question {question.number} <span>MULTIPLE CHOICE</span></div>
            <h3>{question.prompt}</h3>
            <div className="answer-options">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                const isCorrect = !!result && option.id === question.answer;
                const isWrong = !!result && selected && !graded?.correct;
                return <button className={`${selected ? "chosen" : ""} ${isCorrect ? "correct-answer" : ""} ${isWrong ? "wrong-answer" : ""}`} key={option.id} onClick={() => updateAnswer(question.id, option.id)} disabled={!!result}><span className="radio-mark" />{option.id}. {option.text}</button>;
              })}
            </div>
            {graded && <ListeningFeedback graded={graded} question={question} />}
          </article>;
        })}
      </ListeningQuestionGroup>
      <ListeningQuestionGroup title="Questions 5–10" typeLabel="NOTE COMPLETION">
        {completionQuestions.map((question) => {
          const graded = feedbackFor(question.id);
          return <article className="reading-question" key={question.id}>
            <div className="question-number">Question {question.number} <span>NOTE COMPLETION</span></div>
            <h3>{question.prompt}</h3>
            <input className="reading-input" type="text" value={answers[question.id] ?? ""} onChange={(event) => updateAnswer(question.id, event.target.value)} disabled={!!result} placeholder="输入答案" autoComplete="off" aria-label={`Question ${question.number} answer`} />
            {graded && <ListeningFeedback graded={graded} question={question} />}
          </article>;
        })}
      </ListeningQuestionGroup>
    </section>
    <div className="reading-actions">
      {result ? <AppButton variant="primary" icon={ArrowRight} onClick={onBack}>完成练习</AppButton> : <AppButton variant="primary" icon={Check} onClick={submit} disabled={!ready || answered < section.questions.length}>{`提交答案（${answered}/${section.questions.length}）`}</AppButton>}
      <span>提交后记录用时与错题</span>
    </div>
  </>;
}

function ListeningQuestionGroup({ title, typeLabel, children }: { title: string; typeLabel: string; children: React.ReactNode }) {
  return <section className="reading-question-group">
    <div className="reading-group-heading"><span>{title}</span><small>{typeLabel}</small></div>
    {children}
  </section>;
}

function ListeningFeedback({ graded, question }: {
  graded: ListeningQuestionResult;
  question: ListeningMultipleChoiceQuestion | ListeningCompletionQuestion;
}) {
  return <div className={`answer-feedback ${graded.correct ? "correct" : "incorrect"}`} role="status">
    <div className="answer-feedback-title">{graded.correct ? <Check size={17} /> : <CircleHelp size={17} />}{graded.correct ? "回答正确" : "回答错误"}</div>
    {!graded.correct && <p><strong>参考答案</strong> {graded.expected}</p>}
    <p>{question.explanation}</p>
    <blockquote className="reading-evidence">“{question.evidence}”</blockquote>
  </div>;
}

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function SpeakingSession({ answer, setAnswer, result, onSubmit, onBack }: {
  answer: string;
  setAnswer: (value: string) => void;
  result: { correct: boolean; explanation: string } | null;
  onSubmit: (hasRecording: boolean, minutes: number) => void;
  onBack: () => void;
}) {
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "recorded">("idle");
  const [submittedMinutes, setSubmittedMinutes] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [transcriptNotice, setTranscriptNotice] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  function setRecordingUrl(url: string | null) {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    setAudioUrl(url);
  }

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    stopRecognition();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  function stopRecognition() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognitionRef.current = null;
    try {
      recognition.stop();
    } catch {
      // Recognition may already have ended on its own.
    }
  }

  function startRecognition() {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setTranscriptNotice("当前浏览器不支持实时转写，录音仍可回放。");
      return;
    }
    setTranscript("");
    setTranscriptNotice("");
    const recognition = new Recognition();
    recognition.lang = "en-GB";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal) finalText += `${result[0]?.transcript ?? ""} `;
      }
      if (finalText.trim()) setTranscript((current) => `${current} ${finalText}`.trim());
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setTranscriptNotice("实时转写中断，录音仍可回放。");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setTranscriptNotice("实时转写启动失败，录音仍可回放。");
    }
  }

  async function startRecording() {
    if (result) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("此浏览器暂不支持录音，请更换浏览器。");
      return;
    }
    try {
      setRecordingError("");
      setRecordingUrl(null);
      setElapsed(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopRecognition();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecordingUrl(URL.createObjectURL(blob));
        setRecordingState("recorded");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
      recorder.start();
      setRecordingState("recording");
      startRecognition();
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const seconds = Math.min(120, Math.floor((Date.now() - startedAt) / 1000));
        setElapsed(seconds);
        if (seconds >= 120 && recorder.state !== "inactive") recorder.stop();
      }, 250);
    } catch {
      setRecordingState("idle");
      setRecordingError("无法访问麦克风，请检查浏览器权限，或使用 localhost/HTTPS 打开页面。");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={16} />返回练习中心</button>
    <div className="practice-session-heading">
      <div><div className="eyebrow">口语 · 练习</div><h1>Part 2：个人经历</h1><p>围绕题目持续表达，并尽量使用具体细节支撑内容。</p></div>
      <span className="session-timer"><Clock3 size={15} />约 8 分钟</span>
    </div>
    <div className="session-layout">
      <section className="question-panel">
        <div className="passage-label"><Mic2 size={15} />Speaking · Part 2</div>
        <div className="speaking-prompt"><div className="prompt-label">Describe a skill you learned recently</div><p>You should say:</p><ul><li>what the skill is</li><li>how you learned it</li><li>why you decided to learn it</li><li>and explain how you felt about learning it</li></ul><span><Clock3 size={14} />1 minute to prepare · speak for up to 2 minutes</span></div>
        <div className="recording-panel">
          <div className="recording-status">
            <span className={`recording-dot ${recordingState === "recording" ? "active" : ""}`} />
            <strong>{recordingState === "recording" ? "正在录音" : recordingState === "recorded" ? "录音完成" : "准备录音"}</strong>
            <span>{formatDuration(elapsed)} / 2:00</span>
          </div>
          <div className="recording-actions">
            {recordingState === "recording"
              ? <AppButton variant="secondary" icon={Square} onClick={stopRecording} disabled={!!result}>停止录音</AppButton>
              : <AppButton variant="secondary" icon={Mic2} onClick={startRecording} disabled={!!result}>{recordingState === "recorded" ? "重新录音" : "开始录音"}</AppButton>}
          </div>
          {audioUrl && <audio className="recording-playback" controls src={audioUrl} />}
          {transcript && <div className="recording-transcript"><strong>浏览器转写</strong><p>{transcript}</p></div>}
          {transcriptNotice && <p className="recording-note">{transcriptNotice}</p>}
          {recordingError && <p className="recording-error" role="alert">{recordingError}</p>}
          <p className="recording-note">录音保存在当前页面；如果浏览器支持实时转写，语音可能由浏览器语音服务处理，转写不会保存。最长 2 分钟。</p>
        </div>
        <label className="answer-label" htmlFor="speaking-answer">练习后记录你的回答要点</label>
        <textarea id="speaking-answer" className="speaking-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="可以用英文记录你的回答，也可以先口头练习，再写下关键词……" disabled={!!result} />
        {result && <div className="answer-feedback correct" role="status"><div className="answer-feedback-title"><Check size={17} />练习完成</div><p>{result.explanation}{submittedMinutes !== null ? ` 本次用时 ${submittedMinutes} 分钟。` : ""}</p></div>}
        <div className="session-actions">{result ? <AppButton variant="primary" icon={ArrowRight} onClick={onBack}>完成练习</AppButton> : <AppButton variant="primary" icon={Check} onClick={() => {
          const minutes = elapsedMinutes(startedAtRef.current);
          setSubmittedMinutes(minutes);
          onSubmit(!!audioUrl, minutes);
        }} disabled={(!answer && !audioUrl) || recordingState === "recording"}>完成口语练习</AppButton>}<span>练习结果会计入今日目标</span></div>
      </section>
      <aside className="session-help">
        <div className="help-heading"><Lightbulb size={17} /><strong>答题提醒</strong></div>
        <p>保持自然表达，不需要把提示卡上的每一条都回答成独立短句。</p>
        <div className="help-point"><strong>结构</strong><span>先回答主题，再用一段经历或例子展开。</span></div>
        <div className="help-point"><strong>复盘</strong><span>听完录音后，留意停顿、重复词和回答是否偏题。</span></div>
      </aside>
    </div>
  </>;
}
