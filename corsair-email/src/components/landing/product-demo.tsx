"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { CalendarDays, Clock3, FileText, Inbox, Mail, MousePointer2, Pause, RotateCcw } from "lucide-react";
import { AsciiDissolveImage } from "./ascii-dissolve-image";
import "./product-demo.css";

const scenes = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "assistant", label: "Assistant", icon: Mail },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
] as const;

type Scene = (typeof scenes)[number]["id"];

const threads = [
  {
    sender: "Ari Morgan",
    subject: "Launch review",
    time: "9:42 AM",
    message: "Could we review the launch on Thursday at 3 PM? I’ll bring the final checklist.",
    reply: "Hi Ari, Thursday at 3 PM works for me. Thanks for pulling the checklist together.",
  },
  {
    sender: "Maya Chen",
    subject: "Homepage copy",
    time: "9:18 AM",
    message: "The revised homepage copy is ready. Can you check the headline before Friday?",
    reply: "Hi Maya, I’ll take a look at the headline before Friday and send you my notes.",
  },
  {
    sender: "Devon Lee",
    subject: "Friday handoff",
    time: "8:56 AM",
    message: "The handoff notes are ready. I’ll walk the team through them on Friday.",
    reply: "Thanks, Devon. I’ll read through the handoff notes before Friday.",
  },
];

function DemoAction({ children, ...props }: ComponentProps<"button">) {
  return <button type="button" className="nm-glaze" data-tone="sage" {...props}>{children}</button>;
}

export function ProductDemo({ theme }: { theme: "light" | "dark" }) {
  const [scene, setScene] = useState<Scene>("inbox");
  const [selected, setSelected] = useState(1);
  const [reviewing, setReviewing] = useState(false);
  const [replies, setReplies] = useState(() => threads.map(({ reply }) => reply));
  const draftsPicker = useRef<HTMLButtonElement>(null);
  const [summarized, setSummarized] = useState(false);
  const [proposed, setProposed] = useState(false);
  const root = useRef<HTMLElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const step = useRef(0);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionAllowed(!preference.matches);
    sync();
    preference.addEventListener("change", sync);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.intersectionRatio >= 0.55),
      { threshold: 0.55 },
    );
    const stage = root.current?.querySelector(".product-demo-stage");
    if (stage) observer.observe(stage);
    return () => {
      preference.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const area = root.current;
    const pointer = cursor.current;
    if (!playing || !visible || !motionAllowed || !area || !pointer) return;

    const beats = [
      { target: "thread-0", hold: 1800, apply: () => setSelected(0) },
      { target: "open-draft", hold: 850, apply: () => setScene("drafts") },
      { target: "review-draft", hold: 1900, apply: () => setReviewing(true) },
      { target: "assistant", hold: 820, apply: () => setScene("assistant") },
      { target: "summary", hold: 2900, apply: () => setSummarized(true) },
      { target: "calendar", hold: 820, apply: () => setScene("calendar") },
      { target: "review-event", hold: 2800, apply: () => setProposed(true) },
    ];
    let timer: number;

    const advance = () => {
      const beat = beats[step.current];
      if (!beat) {
        setPlaying(false);
        return;
      }
      const target = area.querySelector<HTMLElement>(`[data-demo-target="${beat.target}"]`);
      if (!target) {
        setPlaying(false);
        return;
      }
      const bounds = area.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      const x = box.left - bounds.left + box.width / 2;
      const y = box.top - bounds.top + box.height / 2;
      pointer.dataset.arrival = pointer.dataset.visible ? "move" : "appear";
      pointer.style.transform = `translate(${x}px, ${y}px)`;
      pointer.dataset.visible = "true";

      timer = window.setTimeout(() => {
        pointer.dataset.pressed = "true";
        timer = window.setTimeout(() => {
          delete pointer.dataset.pressed;
          beat.apply();
          step.current += 1;
          timer = window.setTimeout(advance, beat.hold);
        }, 130);
      }, 380);
    };

    timer = window.setTimeout(advance, step.current === 0 ? 650 : 380);
    return () => {
      window.clearTimeout(timer);
      delete pointer.dataset.visible;
      delete pointer.dataset.pressed;
    };
  }, [motionAllowed, playing, visible]);

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }
    step.current = 0;
    setScene("inbox");
    setSelected(1);
    setReviewing(false);
    setSummarized(false);
    setProposed(false);
    setPlaying(true);
  }

  const thread = threads[selected];
  const current = scenes.find((item) => item.id === scene);

  return (
    <section
      ref={root}
      className="product-demo relative z-10 mx-auto max-w-5xl px-6"
      aria-label="Interactive NovusMail demo"
      onPointerDownCapture={(event) => {
        if (event.target instanceof Element && !event.target.closest("[data-demo-playback]")) {
          setPlaying(false);
        }
      }}
      onFocusCapture={(event) => {
        if (!event.target.closest("[data-demo-playback]")) setPlaying(false);
      }}
    >
      <div className="product-demo-picker" role="group" aria-label="Explore NovusMail features">
        {scenes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-demo-target={id}
            ref={id === "drafts" ? draftsPicker : undefined}
            type="button"
            className="nm-glaze"
            data-tone={scene === id ? undefined : "quiet"}
            aria-pressed={scene === id}
            aria-controls="product-demo-workspace"
            onClick={() => setScene(id)}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
        <button
          type="button"
          className="nm-glaze product-demo-playback"
          data-tone="quiet"
          data-demo-playback
          aria-label={playing ? "Stop demo" : "Replay demo"}
          onClick={togglePlayback}
        >
          {playing ? <Pause size={15} aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}
        </button>
      </div>

      <div className="product-demo-stage">
        <AsciiDissolveImage
          src={`/images/${theme}/lavender.webp`}
          reducedMotionSrc={`/images/${theme}/doop-lavender.png`}
          alt=""
          theme={theme}
          variant="card"
        />
        <div className="product-demo-window" id="product-demo-workspace">
          <header className="product-demo-toolbar">
            <span className="font-serif-display">NovusMail</span>
            <span className="product-demo-breadcrumb"><span aria-hidden="true">/</span>{current?.label}</span>
            <span className="product-demo-sample">Sample workspace</span>
          </header>

          <div className="product-demo-body">
            <div className="product-demo-rail" aria-hidden="true">
              {scenes.map(({ id, icon: Icon }) => <span key={id} data-current={scene === id}><Icon size={17} /></span>)}
            </div>

            <div key={scene} className="product-demo-scene" data-scene={scene}>
              {scene === "inbox" && (
                <>
                  <div className="product-demo-list">
                    <h2>Focus queue</h2>
                    {threads.map(({ sender, subject, time }, index) => (
                      <button key={subject} type="button" data-demo-target={`thread-${index}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
                        <span>{sender}<small>{time}</small></span>
                        <strong>{subject}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="product-demo-detail">
                    <div key={thread.subject} className="product-demo-content">
                      <p className="product-demo-context">Inbox / Needs reply</p>
                      <h2>{thread.subject}</h2>
                      <p className="product-demo-meta">{thread.sender} · {thread.time}</p>
                      <p>{thread.message}</p>
                    </div>
                    <div className="product-demo-actions">
                      <DemoAction data-demo-target="open-draft" onClick={() => {
                        setReviewing(false);
                        setScene("drafts");
                        draftsPicker.current?.focus();
                      }}>Open draft reply</DemoAction>
                    </div>
                  </div>
                </>
              )}

              {scene === "drafts" && (
                <>
                  <div className="product-demo-list">
                    <h2>Drafts</h2>
                    {threads.map(({ sender, subject }, index) => (
                      <button key={subject} type="button" aria-pressed={selected === index} onClick={() => {
                        setSelected(index);
                        setReviewing(false);
                      }}>
                        <span>{sender}</span>
                        <strong>Re: {subject}</strong>
                      </button>
                    ))}
                  </div>
                  <div className="product-demo-detail">
                    <div className="product-demo-content">
                      <p className="product-demo-context">Gmail draft</p>
                      <h2>Re: {thread.subject}</h2>
                      <p className="product-demo-meta">To {thread.sender}</p>
                      <textarea
                        aria-label="Draft reply"
                        readOnly={reviewing}
                        value={replies[selected]}
                        onChange={(event) => {
                          const reply = event.target.value;
                          setReplies((previous) => previous.map((text, index) => index === selected ? reply : text));
                        }}
                      />
                    </div>
                    <div className="product-demo-actions">
                      <p role="status">{reviewing && "Reviewing sample reply"}</p>
                      <DemoAction data-demo-target="review-draft" aria-pressed={reviewing} onClick={() => setReviewing(!reviewing)}>
                        {reviewing ? "Back to draft" : "Review draft"}
                      </DemoAction>
                    </div>
                  </div>
                </>
              )}

              {scene === "assistant" && (
                <div className="product-demo-detail product-demo-conversation">
                  <div className="product-demo-content">
                    <p className="product-demo-context">Assistant</p>
                    <h2>Summarize unread mail</h2>
                    <p className="product-demo-meta">This week · 3 unread conversations</p>
                    <div className="product-demo-summary" aria-live="polite">
                      {summarized && (
                        <ul className="product-demo-enter">
                          <li><strong>Launch review</strong> · Ari proposed Thursday at 3 PM.</li>
                          <li><strong>Homepage copy</strong> · Maya needs a headline check by Friday.</li>
                          <li><strong>Friday handoff</strong> · Devon has the notes ready.</li>
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="product-demo-actions">
                    <DemoAction data-demo-target="summary" aria-pressed={summarized} onClick={() => setSummarized(!summarized)}>
                      {summarized ? "Hide summary" : "Show sample summary"}
                    </DemoAction>
                  </div>
                </div>
              )}

              {scene === "calendar" && (
                <>
                  <div className="product-demo-list product-demo-reference">
                    <h2>Thursday</h2>
                    <div><strong>Design sync</strong><p>10:00–10:30 AM</p></div>
                    <div><strong>Team planning</strong><p>1:00–2:00 PM</p></div>
                  </div>
                  <div className="product-demo-detail">
                    <div className="product-demo-content">
                      <p className="product-demo-context">{proposed ? "Event proposal" : "Google Calendar"}</p>
                      <h2>Launch review</h2>
                      <p className="product-demo-meta"><Clock3 size={14} aria-hidden="true" /> Thursday, 3:00–3:30 PM</p>
                      <p>{proposed ? "Guest: Ari Morgan. Review the details before creating the event." : "Your calendar is free at the time Ari suggested."}</p>
                    </div>
                    <div className="product-demo-actions">
                      <p role="status">{proposed && "Awaiting confirmation"}</p>
                      <DemoAction data-demo-target="review-event" aria-pressed={proposed} onClick={() => setProposed(!proposed)}>
                        {proposed ? "Back to agenda" : "Review event"}
                      </DemoAction>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div ref={cursor} className="product-demo-pointer" aria-hidden="true">
        <MousePointer2 size={22} fill="currentColor" />
      </div>
    </section>
  );
}
