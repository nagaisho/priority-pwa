import React, { useState, useEffect, useRef } from "react";

const QUADRANTS = [
  { key: "now", urgent: true, important: true, title: "緊急 × 重要", color: "#B33A2E", tint: "#F6E7E4" },
  { key: "plan", urgent: false, important: true, title: "非緊急 × 重要", color: "#3C6E5C", tint: "#E6EEEA" },
  { key: "delegate", urgent: true, important: false, title: "緊急 × 非重要", color: "#B8842E", tint: "#F3ECDE" },
  { key: "stop", urgent: false, important: false, title: "非緊急 × 非重要", color: "#7A756A", tint: "#EDEBE5" },
];

const MEMO_COLOR = "#5B5648";
const STORAGE_KEY = "priority-matrix-data";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function findQuadrant(urgent, important) {
  return QUADRANTS.find((q) => q.urgent === urgent && q.important === important);
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export default function PriorityMatrix() {
  const [tasks, setTasks] = useState([]);
  const [memoItems, setMemoItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [page, setPage] = useState(0);

  const [text, setText] = useState("");
  const [urgent, setUrgent] = useState(true);
  const [important, setImportant] = useState(true);
  const [drag, setDrag] = useState(null);
  const quadrantRefs = useRef({});
  const inputRef = useRef(null);

  const [memoText, setMemoText] = useState("");
  const memoInputRef = useRef(null);
  const [memoDrag, setMemoDrag] = useState(null);
  const memoRefs = useRef({});

  const [freeNote, setFreeNote] = useState("");
  const freeNoteRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setTasks(data.tasks || []);
        setHistory(data.history || []);
        setMemoItems(data.memoItems || []);
        setFreeNote(data.freeNote || "");
      }
    } catch (e) {
      // no saved data yet
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ tasks, history, memoItems, freeNote })
        );
        setSaveError(false);
      } catch (e) {
        setSaveError(true);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [tasks, history, memoItems, freeNote, loaded]);

  useEffect(() => {
    if (page !== 2 || !freeNoteRef.current) return;
    freeNoteRef.current.style.height = "auto";
    freeNoteRef.current.style.height = freeNoteRef.current.scrollHeight + "px";
  }, [page, freeNote]);

  function addTask(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setTasks((prev) => [{ id: uid(), text: trimmed, urgent, important }, ...prev]);
    setText("");
    inputRef.current && inputRef.current.focus();
  }

  function completeTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setHistory((prev) => [
      { id: task.id, text: task.text, urgent: task.urgent, important: task.important, source: "task", completedAt: Date.now() },
      ...prev,
    ]);
  }

  function removeTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function moveTask(id, target) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, urgent: target.urgent, important: target.important } : t))
    );
  }

  function quadrantKeyAt(x, y) {
    for (const key in quadrantRefs.current) {
      const el = quadrantRefs.current[key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  }

  function handleDragStart(e, task) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      id: task.id,
      text: task.text,
      x: e.clientX,
      y: e.clientY,
      over: findQuadrant(task.urgent, task.important).key,
    });
  }

  function handleDragMove(e) {
    if (!drag) return;
    e.preventDefault();
    const overKey = quadrantKeyAt(e.clientX, e.clientY);
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over: overKey || d.over } : d));
  }

  function handleDragEnd(e) {
    if (!drag) return;
    e.preventDefault();
    const target = QUADRANTS.find((q) => q.key === drag.over);
    if (target) moveTask(drag.id, target);
    setDrag(null);
  }

  function addMemo(e) {
    e.preventDefault();
    const trimmed = memoText.trim();
    if (!trimmed) return;
    setMemoItems((prev) => [{ id: uid(), text: trimmed }, ...prev]);
    setMemoText("");
    memoInputRef.current && memoInputRef.current.focus();
  }

  function completeMemo(item) {
    setMemoItems((prev) => prev.filter((m) => m.id !== item.id));
    setHistory((prev) => [
      { id: item.id, text: item.text, source: "memo", completedAt: Date.now() },
      ...prev,
    ]);
  }

  function removeMemo(id) {
    setMemoItems((prev) => prev.filter((m) => m.id !== id));
  }

  function reorderMemo(dragId, targetIndex) {
    setMemoItems((prev) => {
      const idx = prev.findIndex((m) => m.id === dragId);
      if (idx === -1) return prev;
      const dragged = prev[idx];
      const without = prev.filter((m) => m.id !== dragId);
      let insertAt = idx < targetIndex ? targetIndex - 1 : targetIndex;
      insertAt = Math.max(0, Math.min(without.length, insertAt));
      without.splice(insertAt, 0, dragged);
      return without;
    });
  }

  function memoIndexAt(y) {
    for (let i = 0; i < memoItems.length; i++) {
      const el = memoRefs.current[memoItems[i].id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return memoItems.length;
  }

  function handleMemoDragStart(e, item) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setMemoDrag({
      id: item.id,
      text: item.text,
      x: e.clientX,
      y: e.clientY,
      overIndex: memoItems.findIndex((m) => m.id === item.id),
    });
  }

  function handleMemoDragMove(e) {
    if (!memoDrag) return;
    e.preventDefault();
    const overIndex = memoIndexAt(e.clientY);
    setMemoDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, overIndex } : d));
  }

  function handleMemoDragEnd(e) {
    if (!memoDrag) return;
    e.preventDefault();
    reorderMemo(memoDrag.id, memoDrag.overIndex);
    setMemoDrag(null);
  }

  function restoreHistory(item) {
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    if (item.source === "memo") {
      setMemoItems((prev) => [{ id: item.id, text: item.text }, ...prev]);
    } else {
      setTasks((prev) => [{ id: item.id, text: item.text, urgent: item.urgent, important: item.important }, ...prev]);
    }
  }

  function removeHistory(id) {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }

  function clearHistory() {
    setHistory([]);
  }

  const tasksFor = (q) => tasks.filter((t) => t.urgent === q.urgent && t.important === q.important);

  return (
    <div className="pm-root">
      <style>{`
        .pm-root {
          --ink: #2B2A28;
          --paper: #ECE8DE;
          --paper-raised: #F7F4EC;
          --line: rgba(43,42,40,0.14);
          font-family: "Yu Gothic Medium", "Yu Gothic", -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          justify-content: center;
          box-sizing: border-box;
        }
        .pm-shell { width: 100%; max-width: 460px; padding: 18px 14px 90px; box-sizing: border-box; }

        .pm-form {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 16px;
        }
        .pm-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 10px;
          padding: 12px;
          font-size: 16px;
          color: var(--ink);
          margin-bottom: 10px;
        }
        .pm-input:focus { outline: 2px solid #3C6E5C; outline-offset: 1px; }
        .pm-input.last { margin-bottom: 0; }
        .pm-input.pm-input-cream { background: #fff; }
        .pm-toggles { display: flex; gap: 10px; margin-bottom: 0; }
        .pm-chip {
          flex: 2; padding: 10px 8px; border-radius: 999px; border: 1px solid var(--line);
          background: #fff; font-size: 13px; font-weight: 600; color: #8B8578;
          text-align: center; cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .pm-chip.on-urgent { background: #B33A2E; border-color: #B33A2E; color: #fff; }
        .pm-chip.on-important { background: #3C6E5C; border-color: #3C6E5C; color: #fff; }
        .pm-submit {
          width: 100%; padding: 12px; border-radius: 10px; border: none;
          background: var(--ink); color: #F7F4EC; font-size: 14px; font-weight: 700;
          letter-spacing: 0.04em; cursor: pointer; min-height: 44px;
        }
        .pm-submit:active { opacity: 0.85; }
        .pm-submit-inline {
          flex: 1; border: none; border-radius: 999px; background: var(--ink);
          color: #F7F4EC; font-size: 13px; font-weight: 700; cursor: pointer; padding: 10px 4px;
        }
        .pm-submit-inline:active { opacity: 0.85; }
        .pm-form-row { display: flex; gap: 8px; }
        .pm-form-row .pm-input { margin-bottom: 0; }
        .pm-submit.compact { width: auto; padding: 0 16px; }

        .pm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pm-card {
          border-radius: 14px; padding: 12px 10px; border: 1px solid var(--line);
          min-height: 270px; max-height: 400px; display: flex; flex-direction: column; color: var(--ink);
        }
        .pm-card-title { font-size: 12.5px; font-weight: 700; margin: 0 0 8px; }
        .pm-card-list { flex: 1; overflow-y: auto; }
        .pm-task { padding: 6px 0; border-bottom: 1px solid var(--line); }
        .pm-task-row { display: flex; align-items: center; gap: 6px; }
        .pm-task-check {
          width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--line);
          flex: none; display: flex; align-items: center; justify-content: center;
          cursor: pointer; background: #fff; font-size: 12px;
        }
        .pm-task-text { flex: 1; font-size: 12.5px; word-break: break-word; }
        .pm-task-grip, .pm-task-del {
          border: none; background: transparent; color: #8B8578; padding: 4px;
          cursor: pointer; flex: none; font-size: 14px; line-height: 1;
        }
        .pm-task-grip { touch-action: none; cursor: grab; font-size: 16px; }
        .pm-task-del { font-size: 16px; }
        .pm-task-dragging { opacity: 0.35; }
        .pm-empty { padding: 12px 0; font-size: 12px; color: #8B8578; text-align: center; }

        .pm-card-dragover { outline: 2px dashed var(--ink); outline-offset: -2px; }
        .pm-drag-ghost {
          position: fixed; transform: translate(-50%, -50%); pointer-events: none;
          background: var(--ink); color: #F7F4EC; font-size: 12.5px; font-weight: 600;
          padding: 8px 12px; border-radius: 10px; max-width: 220px; word-break: break-word;
          box-shadow: 0 6px 16px rgba(0,0,0,0.25); z-index: 20;
        }

        .pm-save-note { margin-top: 14px; font-size: 11px; color: #B33A2E; text-align: center; }

        .pm-memo-list-row {
          display: flex; align-items: center; gap: 10px;
          background: var(--paper-raised); border: 1px solid var(--line); border-radius: 12px;
          padding: 10px 12px; margin-bottom: 8px;
        }
        .pm-memo-round {
          width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--line);
          flex: none; cursor: pointer; background: #fff;
        }
        .pm-memo-text { flex: 1; font-size: 14px; word-break: break-word; }
        .pm-memo-del { border: none; background: transparent; color: #8B8578; font-size: 17px; padding: 4px; cursor: pointer; flex: none; }

        .pm-hist-head { display: flex; justify-content: flex-end; margin-bottom: 8px; }
        .pm-hist-clear { border: none; background: transparent; font-size: 12px; color: #8B8578; text-decoration: underline; cursor: pointer; padding: 4px; }
        .pm-hist-item {
          background: var(--paper-raised); border: 1px solid var(--line); border-radius: 12px;
          padding: 10px 12px; margin-bottom: 8px; display: flex; align-items: flex-start; gap: 10px;
        }
        .pm-hist-tag {
          font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px;
          color: #fff; flex: none; margin-top: 1px; white-space: nowrap;
        }
        .pm-hist-body { flex: 1; min-width: 0; }
        .pm-hist-text { font-size: 13.5px; word-break: break-word; }
        .pm-hist-date { font-size: 10.5px; color: #8B8578; margin-top: 2px; }
        .pm-hist-actions { display: flex; flex-direction: column; gap: 2px; flex: none; }
        .pm-hist-btn { border: none; background: transparent; color: #8B8578; font-size: 15px; cursor: pointer; padding: 3px; }

        .pm-tabbar {
          position: fixed; bottom: 0; left: 0; right: 0; display: flex; justify-content: center;
          background: var(--paper-raised); border-top: 1px solid var(--line); z-index: 5;
        }
        .pm-tabbar-inner { width: 100%; max-width: 460px; display: flex; gap: 6px; padding: 6px 8px calc(8px + env(safe-area-inset-bottom)); box-sizing: border-box; }
        .pm-tab {
          flex: 1; border: none; background: transparent; border-radius: 12px;
          padding: 7px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px;
          font-size: 11px; font-weight: 600; color: #8B8578; cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .pm-tab-icon { font-size: 15px; line-height: 1; }
        .pm-tab.active { color: var(--paper-raised); background: var(--ink); }
        .pm-tab-minor { flex: 0.6; }

        .pm-memo-dragover-top { box-shadow: inset 0 2px 0 var(--ink); }
        .pm-memo-dragover-bottom { box-shadow: inset 0 -2px 0 var(--ink); }
        .pm-note-area {
          width: 100%; box-sizing: border-box; display: block;
          min-height: 55vh; resize: none; overflow: hidden;
          border: 1px solid var(--line); border-radius: 14px;
          background: #FBF9F4; color: var(--ink);
          padding: 14px; font-size: 16px; line-height: 1.7; font-family: inherit;
        }
        .pm-note-area:focus { outline: 2px solid #3C6E5C; outline-offset: 1px; }
      `}</style>

      <div className="pm-shell">
        {page === 0 && (
          <>
            <form className="pm-form" onSubmit={addTask}>
              <input
                ref={inputRef}
                className="pm-input"
                placeholder="やることを入力"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="pm-toggles">
                <div
                  className={"pm-chip" + (urgent ? " on-urgent" : "")}
                  onClick={() => setUrgent((v) => !v)}
                  role="button"
                  tabIndex={0}
                >
                  緊急 {urgent ? "✓" : ""}
                </div>
                <div
                  className={"pm-chip" + (important ? " on-important" : "")}
                  onClick={() => setImportant((v) => !v)}
                  role="button"
                  tabIndex={0}
                >
                  重要 {important ? "✓" : ""}
                </div>
                <button className="pm-submit-inline" type="submit">追加</button>
              </div>
            </form>

            <div className="pm-grid">
              {QUADRANTS.map((q) => {
                const list = tasksFor(q);
                return (
                  <div
                    key={q.key}
                    ref={(el) => (quadrantRefs.current[q.key] = el)}
                    className={"pm-card" + (drag && drag.over === q.key ? " pm-card-dragover" : "")}
                    style={{ background: q.tint }}
                  >
                    <p className="pm-card-title">{q.title}</p>
                    <div className="pm-card-list">
                      {list.length === 0 && <p className="pm-empty">タスクなし</p>}
                      {list.map((t) => (
                        <div
                          className={"pm-task" + (drag && drag.id === t.id ? " pm-task-dragging" : "")}
                          key={t.id}
                        >
                          <div className="pm-task-row">
                            <div
                              className="pm-task-check"
                              onClick={() => completeTask(t)}
                              role="button"
                              tabIndex={0}
                            />
                            <span className="pm-task-text">{t.text}</span>
                            <button
                              className="pm-task-grip"
                              onPointerDown={(e) => handleDragStart(e, t)}
                              onPointerMove={handleDragMove}
                              onPointerUp={handleDragEnd}
                              onPointerCancel={handleDragEnd}
                              aria-label="ドラッグして移動"
                            >
                              ⠿
                            </button>
                            <button className="pm-task-del" onClick={() => removeTask(t.id)}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {saveError && <p className="pm-save-note">保存に失敗しました。もう一度お試しください。</p>}
          </>
        )}

        {page === 1 && (
          <>
            <form className="pm-form" onSubmit={addMemo}>
              <div className="pm-form-row">
                <input
                  ref={memoInputRef}
                  className="pm-input pm-input-cream"
                  placeholder="メモを入力"
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                />
                <button className="pm-submit compact" type="submit">追加</button>
              </div>
            </form>

            {memoItems.length === 0 && <p className="pm-empty">メモはまだありません</p>}
            {memoItems.map((m, i) => (
              <div
                className={
                  "pm-memo-list-row" +
                  (memoDrag && memoDrag.id === m.id ? " pm-task-dragging" : "") +
                  (memoDrag && memoDrag.overIndex === i ? " pm-memo-dragover-top" : "") +
                  (memoDrag && memoDrag.overIndex === memoItems.length && i === memoItems.length - 1
                    ? " pm-memo-dragover-bottom"
                    : "")
                }
                key={m.id}
                ref={(el) => (memoRefs.current[m.id] = el)}
              >
                <div
                  className="pm-memo-round"
                  onClick={() => completeMemo(m)}
                  role="button"
                  tabIndex={0}
                />
                <span className="pm-memo-text">{m.text}</span>
                <button
                  className="pm-task-grip"
                  onPointerDown={(e) => handleMemoDragStart(e, m)}
                  onPointerMove={handleMemoDragMove}
                  onPointerUp={handleMemoDragEnd}
                  onPointerCancel={handleMemoDragEnd}
                  aria-label="ドラッグして並び替え"
                >
                  ⠿
                </button>
                <button className="pm-memo-del" onClick={() => removeMemo(m.id)}>×</button>
              </div>
            ))}
          </>
        )}

        {page === 2 && (
          <textarea
            ref={freeNoteRef}
            className="pm-note-area"
            placeholder="自由にメモを書けます"
            value={freeNote}
            onChange={(e) => setFreeNote(e.target.value)}
          />
        )}


        {page === 3 && (
          <>
            {history.length > 0 && (
              <div className="pm-hist-head">
                <button className="pm-hist-clear" onClick={clearHistory}>すべて削除</button>
              </div>
            )}
            {history.length === 0 && <p className="pm-empty">履歴はまだありません</p>}
            {history.map((h) => {
              const q = h.source === "memo" ? null : findQuadrant(h.urgent, h.important);
              return (
                <div className="pm-hist-item" key={h.id}>
                  <span className="pm-hist-tag" style={{ background: q ? q.color : MEMO_COLOR }}>
                    {q ? q.title : "メモ"}
                  </span>
                  <div className="pm-hist-body">
                    <p className="pm-hist-text">{h.text}</p>
                    <p className="pm-hist-date">{formatDate(h.completedAt)} 完了</p>
                  </div>
                  <div className="pm-hist-actions">
                    <button className="pm-hist-btn" onClick={() => restoreHistory(h)} title="戻す">↺</button>
                    <button className="pm-hist-btn" onClick={() => removeHistory(h.id)} title="削除">×</button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="pm-tabbar">
        <div className="pm-tabbar-inner">
          <button className={"pm-tab" + (page === 0 ? " active" : "")} onClick={() => setPage(0)}>
            <span className="pm-tab-icon">▦</span>整理
          </button>
          <button className={"pm-tab" + (page === 1 ? " active" : "")} onClick={() => setPage(1)}>
            <span className="pm-tab-icon">☑</span>タスク
          </button>
          <button className={"pm-tab" + (page === 2 ? " active" : "")} onClick={() => setPage(2)}>
            <span className="pm-tab-icon">✎</span>メモ
          </button>
          <button className={"pm-tab pm-tab-minor" + (page === 3 ? " active" : "")} onClick={() => setPage(3)}>
            <span className="pm-tab-icon">↺</span>履歴
          </button>
        </div>
      </div>

      {drag && (
        <div className="pm-drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {drag.text}
        </div>
      )}
      {memoDrag && (
        <div className="pm-drag-ghost" style={{ left: memoDrag.x, top: memoDrag.y }}>
          {memoDrag.text}
        </div>
      )}
    </div>
  );
}
