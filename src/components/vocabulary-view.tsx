"use client";

import { ArrowLeft, ArrowRight, BookMarked, Check, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { elapsedMinutes } from "@/lib/practice-time";
import type { VocabularyReview, VocabularyReviewSource } from "@/lib/study-data";
import type { VocabularyWord } from "@/lib/vocabulary";
import { vocabularyTopicLabels, vocabularyTopics } from "@/lib/vocabulary";
import { dueVocabularyReviews, type ReviewRating } from "@/lib/vocabulary-review";

const sourceLabels: Record<VocabularyReviewSource, string> = {
  manual: "手动添加",
  writing: "写作错题",
  listening: "听力错题",
  reading: "阅读错题",
};

const pageSize = 12;

type BrowseResult = { key: string; words: VocabularyWord[]; total: number; error: string };

export function VocabularyView({ today, reviews, hydrated, onAddReview, onReview }: {
  today: string;
  reviews: VocabularyReview[];
  hydrated: boolean;
  onAddReview: (word: VocabularyWord, source: VocabularyReviewSource) => void;
  onReview: (id: string, rating: ReviewRating, minutes: number) => void;
}) {
  const [tab, setTab] = useState<"review" | "browse">("review");
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const [loadedWord, setLoadedWord] = useState<{ id: string; word: VocabularyWord } | null>(null);
  const [wordError, setWordError] = useState<{ id: string; message: string } | null>(null);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [cefr, setCefr] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(1);
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reviewStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    reviewStartedAtRef.current = Date.now();
  }, []);

  const due = dueVocabularyReviews(reviews, today).filter((review) => !completedIds.has(review.id));
  const currentReview = due[0] ?? null;
  const currentId = currentReview?.id ?? null;
  const currentWord = loadedWord?.id === currentId ? loadedWord.word : null;
  const currentError = !currentWord && wordError?.id === currentId ? wordError.message : "";
  const wordLoading = !!currentId && !currentWord && !currentError;
  const revealed = !!currentId && revealedFor === currentId;

  const browseKey = `${submittedQuery}|${cefr}|${topic}|${page}`;
  const browseMatches = browseResult?.key === browseKey;
  const browseLoading = tab === "browse" && !browseMatches;
  const browseError = browseMatches ? browseResult?.error ?? "" : "";
  const words = browseMatches ? browseResult?.words ?? [] : [];
  const total = browseMatches ? browseResult?.total ?? 0 : 0;
  const selected = selectedId ? words.find((word) => word.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    fetch(`/api/vocabulary?id=${encodeURIComponent(currentId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Vocabulary word could not be loaded");
        return await response.json() as { word?: VocabularyWord };
      })
      .then((payload) => {
        if (!cancelled && payload.word) setLoadedWord({ id: currentId, word: payload.word });
      })
      .catch(() => {
        if (!cancelled) setWordError({ id: currentId, message: "词条加载失败，请重试。" });
      });
    return () => { cancelled = true; };
  }, [currentId, retryKey]);

  useEffect(() => {
    if (tab !== "browse") return;
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (submittedQuery) params.set("q", submittedQuery);
    if (cefr) params.set("cefr", cefr);
    if (topic) params.set("topic", topic);
    fetch(`/api/vocabulary?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Vocabulary list could not be loaded");
        return await response.json() as { words?: VocabularyWord[]; total?: number };
      })
      .then((payload) => {
        if (!cancelled) setBrowseResult({ key: browseKey, words: payload.words ?? [], total: payload.total ?? 0, error: "" });
      })
      .catch(() => {
        if (!cancelled) setBrowseResult({ key: browseKey, words: [], total: 0, error: "词库加载失败，请稍后重试。" });
      });
    return () => { cancelled = true; };
  }, [tab, browseKey, page, submittedQuery, cefr, topic]);

  function rate(rating: ReviewRating) {
    if (!currentReview || !hydrated) return;
    const minutes = elapsedMinutes(reviewStartedAtRef.current);
    reviewStartedAtRef.current = Date.now();
    onReview(currentReview.id, rating, minutes);
    setCompletedIds((current) => new Set(current).add(currentReview.id));
    setRevealedFor(null);
  }

  function renderReview() {
    if (reviews.length === 0) {
      return <div className="empty-state">
        <div className="empty-state-icon"><BookMarked size={23} /></div>
        <h2>还没有加入复习的单词</h2>
        <p>去词库挑选 B2/C1 单词，加入后按间隔重复复习。</p>
        <button className="button button-secondary" onClick={() => setTab("browse")}>去词库添加 <ArrowRight size={16} /></button>
      </div>;
    }
    if (!currentReview) {
      return <div className="empty-state">
        <div className="empty-state-icon"><Check size={23} /></div>
        <h2>今天没有到期单词</h2>
        <p>明天再来，或去词库添加新词。</p>
        <button className="button button-secondary" onClick={() => setTab("browse")}>浏览词库 <ArrowRight size={16} /></button>
      </div>;
    }

    return <section className="vocab-review-panel">
      <div className="vocab-review-meta">
        <span>{sourceLabels[currentReview.source]}</span>
        <span>今日还剩 {due.length} 个</span>
      </div>
      <h2 className="vocab-word">{currentReview.word}</h2>
      {currentWord && <p className="vocab-ipa">{currentWord.uk} · {currentWord.us}</p>}
      {wordLoading && <p className="vocab-hint">正在加载词条…</p>}
      {currentError && <div className="notice" role="alert">
        <span>{currentError}</span>
        <button className="button button-secondary" onClick={() => setRetryKey((key) => key + 1)}>重试</button>
      </div>}
      {!revealed
        ? <button className="button button-primary vocab-reveal" onClick={() => currentId && setRevealedFor(currentId)} disabled={!hydrated || !currentWord}>显示答案</button>
        : currentWord && <>
          <WordDetails word={currentWord} />
          <div className="vocab-rating" role="group" aria-label="复习评价">
            <button className="again" onClick={() => rate("again")} disabled={!hydrated}><strong>忘记</strong><small>明天再来</small></button>
            <button className="good" onClick={() => rate("good")} disabled={!hydrated}><strong>一般</strong><small>按间隔复习</small></button>
            <button className="easy" onClick={() => rate("easy")} disabled={!hydrated}><strong>记住</strong><small>拉长间隔</small></button>
          </div>
        </>}
    </section>;
  }

  function renderBrowse() {
    return <div className="vocab-browse">
      <form className="vocab-filters" onSubmit={(event) => {
        event.preventDefault();
        setPage(1);
        setSelectedId(null);
        setSubmittedQuery(query.trim());
      }}>
        <label className="vocab-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单词或中文释义" aria-label="搜索词汇" /></label>
        <select aria-label="CEFR" value={cefr} onChange={(event) => { setCefr(event.target.value); setPage(1); setSelectedId(null); }}>
          <option value="">全部难度</option>
          <option value="B2">B2</option>
          <option value="C1">C1</option>
        </select>
        <select aria-label="话题" value={topic} onChange={(event) => { setTopic(event.target.value); setPage(1); setSelectedId(null); }}>
          <option value="">全部话题</option>
          {vocabularyTopics.map((item) => <option value={item} key={item}>{vocabularyTopicLabels[item]}</option>)}
        </select>
        <button className="button button-secondary" type="submit">搜索</button>
      </form>
      {browseError && <div className="notice" role="alert"><span>{browseError}</span></div>}
      <div className="vocab-browse-layout">
        <div className="vocab-list">
          {browseLoading ? <p className="vocab-hint">正在加载词库…</p> : words.map((word) => <button className={`vocab-list-item ${selected?.id === word.id ? "selected" : ""}`} key={word.id} onClick={() => setSelectedId(word.id)}>
            <div className="vocab-list-top"><strong>{word.w}</strong><span>{word.uk}</span></div>
            <p>{word.senses[0]?.zh}</p>
            <div className="vocab-tags"><span>{word.cefr}</span><span>{vocabularyTopicLabels[word.topic]}</span></div>
          </button>)}
          {!browseLoading && words.length === 0 && <div className="history-empty"><p>没有匹配的词条。</p></div>}
        </div>
        <div className="vocab-detail-panel">
          {selected ? <>
            <div className="vocab-detail-head"><h2>{selected.w}</h2><span>{selected.uk} · {selected.us}</span></div>
            <WordDetails word={selected} />
            <button className="button button-primary vocab-add" onClick={() => onAddReview(selected, "manual")} disabled={!hydrated || reviews.some((review) => review.id === selected.id)}>
              {reviews.some((review) => review.id === selected.id) ? <><Check size={16} />已在复习</> : "加入复习"}
            </button>
          </> : <div className="history-empty"><p>从左侧选择一个词条查看释义和例句。</p></div>}
        </div>
      </div>
      <div className="vocab-pagination">
        <button className="button button-secondary" onClick={() => { setPage((current) => Math.max(1, current - 1)); setSelectedId(null); }} disabled={page <= 1 || browseLoading}><ArrowLeft size={15} />上一页</button>
        <span>第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页 · 共 {total} 词</span>
        <button className="button button-secondary" onClick={() => { setPage((current) => current + 1); setSelectedId(null); }} disabled={page >= Math.ceil(total / pageSize) || browseLoading}>下一页<ArrowRight size={15} /></button>
      </div>
      <p className="vocab-attribution">词汇数据：Word Atlas contributors · CC BY 4.0</p>
    </div>;
  }

  return <>
    <div className="page-title-row">
      <div><div className="eyebrow">间隔重复</div><h1>词汇</h1><p>复习今天到期的单词，或从 B2/C1 词库中添加新词。</p></div>
      <span className="small-pill"><BookMarked size={14} />{due.length} 个到期</span>
    </div>
    <div className="filter-row" role="tablist" aria-label="词汇页面">
      <button role="tab" aria-selected={tab === "review"} className={tab === "review" ? "selected" : ""} onClick={() => { setTab("review"); setRevealedFor(null); }}>今日复习 <span>{due.length}</span></button>
      <button role="tab" aria-selected={tab === "browse"} className={tab === "browse" ? "selected" : ""} onClick={() => { setTab("browse"); setSelectedId(null); }}>词库</button>
    </div>
    {tab === "review" ? renderReview() : renderBrowse()}
  </>;
}

function WordDetails({ word }: { word: VocabularyWord }) {
  return <div className="vocab-details">
    <div className="vocab-tags"><span>{word.cefr}</span><span>{vocabularyTopicLabels[word.topic]}</span></div>
    <div className="vocab-senses">{word.senses.map((sense, index) => <div className="vocab-sense" key={index}>
      <span>{sense.pos}</span>
      <div><strong>{sense.zh}</strong><small>{sense.en}</small></div>
    </div>)}</div>
    <div className="vocab-examples">{word.ex.map((example, index) => <div className="vocab-example" key={index}>
      <p>{example.en}</p><small>{example.zh}</small>
    </div>)}</div>
    {word.col.length > 0 && <div className="vocab-section"><strong>常用搭配</strong><div className="vocab-chips">{word.col.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div></div>}
    {word.fam.length > 0 && <div className="vocab-section"><strong>词族</strong><div className="vocab-chips">{word.fam.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div></div>}
    {(word.syn.length > 0 || word.ant.length > 0) && <div className="vocab-section"><strong>近义 / 反义</strong><div className="vocab-chips">
      {word.syn.map((item) => <span key={`syn-${item}`}>{item}</span>)}
      {word.ant.map((item) => <span className="ant" key={`ant-${item}`}>{item}</span>)}
    </div></div>}
    {word.tip && <p className="vocab-tip"><strong>提示</strong>{word.tip}</p>}
  </div>;
}
