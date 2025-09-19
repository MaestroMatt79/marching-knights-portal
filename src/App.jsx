import React, { useEffect, useMemo, useState } from "react";

/**
 * Marching Knights Portal – Single-file React app
 * (Based on Marching Band Portal, repo-ready)
 */

// Types
/** @typedef {"rehearsal"|"sectional"|"parade"|"competition"|"game"} EventType */
/** @typedef {{ name: string, section?: string, email?: string }} StudentRec */

// Helpers
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtTime = (t) => (t?.length ? t : "—");
const addDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const dateToISO = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10);

// Demo data
const DEMO_STUDENTS = [
  { name: "Max Gray", section: "Drum Major", email: "max@example.com" },
  { name: "Asher Higgs", section: "Field Cmd", email: "asher@example.com" },
  { name: "Danica Stup", section: "Guard" },
  { name: "Loralie Hegg", section: "Guard" },
  { name: "Dainon Johnson", section: "Percussion" },
  { name: "Jasper Holmes", section: "Percussion" },
  { name: "Maddie Ware", section: "Flute" },
  { name: "Jackson Brewer", section: "Trumpet" },
  { name: "Jason Koster", section: "Low Brass" },
  { name: "Avery Clayton", section: "Sax" },
];
const DEMO_EVENTS = [
  { id: uid(), date: todayISO(), start: "15:30", end: "18:00", title: "Full Ensemble Rehearsal", type: "rehearsal", location: "MHS Stadium", plan: "Warm-ups (15) → Visual (20) → Music arcs (30) → Sets 1–15 (45) → Full run (10) → Announcements" },
  { id: uid(), date: addDaysISO(2), start: "16:00", end: "18:00", title: "Low Brass Sectional", type: "sectional", location: "Band Room", plan: "Long tones, articulation, m. 37–52." },
  { id: uid(), date: addDaysISO(5), start: "18:30", end: "21:00", title: "Home Game vs Walkersville", type: "game", location: "MHS Stadium", plan: "Report 5:30 • Arc behind scoreboard • Pregame + Halftime: Top Gun medley." },
];

// Storage
const LS_KEY = "mkp_state_v1";
function normalizeStudents(arr) {
  return (arr || []).map((s) => (typeof s === 'string' ? { name: s } : { name: s.name || "", section: s.section || s.instrument || "", email: s.email || "" }))
    .filter((s) => s.name.trim().length)
    .sort((a,b)=>a.name.localeCompare(b.name));
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (s) {
      s.settings ||= {};
      if (s.settings.directorPin == null) s.settings.directorPin = "2468";
      if (s.auth == null) s.auth = { role: null, name: "" };
      s.students = normalizeStudents(s.students || []);
      return s;
    }
  } catch {}
  return {
    students: normalizeStudents(DEMO_STUDENTS),
    events: DEMO_EVENTS,
    absences: /** @type {Absence[]} */ ([]),
    settings: { scriptUrl: "", enableSheetsSync: false, directorPin: "2468" },
    auth: /** @type {Auth} */ ({ role: null, name: "" }),
  };
}
function saveState(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

// Sheets sync (verbose errors + JSON guard)
async function sheetsCreateOrUpdate(scriptUrl, payload) {
  try {
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptUrl, ...payload }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0,200)}`);
    try { return JSON.parse(text); }
    catch { throw new Error(`Non-JSON from proxy: ${text.slice(0,200)}`); }
  } catch (err) {
    console.error("Sheets sync error:", err);
    throw err;
  }
}


// App
export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("calendar");
  const [query, setQuery] = useState("");
  const role = state.auth.role || "guest";

  useEffect(() => saveState(state), [state]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.events
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
      .filter((e) => !q || [e.title, e.type, e.location, e.plan].some((t) => t?.toLowerCase().includes(q)));
  }, [state.events, query]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-zinc-950/70 border-b border-zinc-800 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><Logo /><h1 className="text-xl sm:text-2xl font-semibold">Marching Knights Portal</h1></div>
          <div className="flex items-center gap-2">
            <AuthWidget state={state} setState={setState} />
            <button onClick={() => setTab("settings")} className={`px-3 py-1.5 rounded-xl border border-zinc-800 hover:border-zinc-700 ${tab === "settings" ? "bg-zinc-800/60" : "bg-zinc-900/40"}`} title="Settings">Settings</button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 pb-2 flex gap-2">
          {[
            ["calendar", "Calendar"],
            ["absences", "Absences"],
            ["weekly", "Weekly Print"],
            ...(role === "director" ? [["admin", "Director"]] : []),
          ].map(([id, label]) => (
            <Tab key={id} active={tab === id} onClick={() => setTab(id)}>{label}</Tab>
          ))}
          <div className="ml-auto w-full max-w-md">
            <input className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500" placeholder="Search events, plans, locations…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {tab === "calendar" && (
          <CalendarView
            role={role}
            events={filteredEvents}
            onAdd={(e) => setState((s) => ({ ...s, events: [...s.events, e] }))}
            onUpdate={(e) => setState((s) => ({ ...s, events: s.events.map((x) => (x.id === e.id ? e : x)) }))}
            onDelete={(id) => setState((s) => ({ ...s, events: s.events.filter((x) => x.id !== id) }))}
            requestAbsence={(event, payload) => handleAbsenceSubmit({ state, setState, studentName: state.auth.name, event, payload })}
          />
        )}

        {tab === "absences" && (
          <AbsenceView
            role={role}
            studentName={state.auth.name}
            absences={state.absences}
            events={state.events}
            roster={state.students}
            onCancel={(id) => setState((s) => ({ ...s, absences: s.absences.map((a) => (a.id === id && a.status === "Pending" ? { ...a, status: "Cancelled" } : a)) }))}
          />
        )}

        {tab === "weekly" && (<WeeklyPrintView events={state.events} />)}

        {tab === "admin" && role === "director" && (
          <DirectorPanel
            absences={state.absences}
            events={state.events}
            roster={state.students}
            settings={state.settings}
            onDecision={async (id, status, note) => {
              setState((s) => ({ ...s, absences: s.absences.map((a) => (a.id === id ? { ...a, status, directorNote: note } : a)) }));
              try {
                if (state.settings.enableSheetsSync && state.settings.scriptUrl) {
                  await sheetsCreateOrUpdate(state.settings.scriptUrl, { action: "updateStatus", id, status, directorNote: note });
                }
              } catch (err) {
                console.error(err);
                alert("Sheets status update failed (saved locally).\nCheck the Apps Script URL and permissions.");
              }
            }}
          />
        )}

        {tab === "settings" && (
          <SettingsPanel
            settings={state.settings}
            students={state.students}
            onSaveSettings={(settings) => setState((s) => ({ ...s, settings }))}
            onReplaceRoster={(list) => setState((s) => ({ ...s, students: normalizeStudents(list) }))}
            onAddRecords={(list) => setState((s) => ({ ...s, students: normalizeStudents([...s.students, ...list]) }))}
          />
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-6 text-sm text-zinc-400 print:hidden">
        <p>Local data is stored in your browser. Use Settings → "Reset Demo Data" to start over.</p>
      </footer>
    </div>
  );
}

// UI bits
function Logo() { return <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-400 grid place-items-center font-black text-zinc-950">MK</div>; }
function Tab({ active, onClick, children }) { return <button onClick={onClick} className={`px-3 py-1.5 rounded-xl border ${active ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"}`}>{children}</button>; }

// Auth
function AuthWidget({ state, setState }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {state.auth.role ? (
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 px-2 py-1.5 rounded-xl text-sm">
          <span className="text-zinc-300">{state.auth.role === "director" ? "Director" : state.auth.name}</span>
          <button onClick={() => setState((s) => ({ ...s, auth: { role: null, name: "" } }))} className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700">Sign out</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700">Sign in</button>
      )}
      {open && (<Modal title="Sign in" onClose={() => setOpen(false)}><AuthModalContent state={state} setState={setState} onDone={() => setOpen(false)} /></Modal>)}
    </div>
  );
}
function AuthModalContent({ state, setState, onDone }) {
  const [mode, setMode] = useState("student");
  const [studentName, setStudentName] = useState(state.students[0]?.name || "");
  const [pin, setPin] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualSection, setManualSection] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["student", "director"]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg ${mode === m ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}>{m[0].toUpperCase() + m.slice(1)}</button>
        ))}
      </div>

      {mode === "student" ? (
        <div className="grid gap-3">
          <Field label="Select your name (from roster)">
            <select value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
              {state.students.map((s) => (<option key={s.name} value={s.name}>{s.name}{s.section ? ` — ${s.section}` : ""}</option>))}
            </select>
          </Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Or type your name"><input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="First Last" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
            <Field label="Section/Instrument"><input value={manualSection} onChange={(e) => setManualSection(e.target.value)} placeholder="e.g., Trumpet" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
            <Field label="Email (optional)"><input type="email" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="you@school.org" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
          </div>
          <div className="flex justify-end">
            <button onClick={() => {
              const name = (manualName || studentName || "").trim();
              if (!name) return alert("Please select or enter your name.");
              if (manualName) {
                const rec = { name, section: manualSection.trim(), email: manualEmail.trim() };
                setState((s) => ({ ...s, auth: { role: "student", name }, students: normalizeStudents([...s.students, rec]) }));
              } else {
                setState((s) => ({ ...s, auth: { role: "student", name } }));
              }
              onDone();
            }} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Continue</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <Field label="Director PIN"><input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="e.g., 2468" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
          <div className="flex justify-end">
            <button onClick={() => { if (pin !== (state.settings.directorPin || "2468")) return alert("Incorrect PIN"); setState((s) => ({ ...s, auth: { role: "director", name: "" } })); onDone(); }} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Sign in as Director</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Calendar
function CalendarView({ role, events, onAdd, onUpdate, onDelete, requestAbsence }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-3">
        {events.length === 0 && <EmptyCard title="No events yet" subtitle={role === "director" ? "Add your first event →" : "Check back soon."} />}
        {events.map((e) => (<EventCard key={e.id} e={e} role={role} onEdit={() => setEditing(e)} onDelete={() => onDelete(e.id)} onRequest={(payload) => requestAbsence(e, payload)} />))}
      </div>
      <div className="space-y-3">
        {role === "director" && (<button onClick={() => setCreating(true)} className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-medium">+ New Event</button>)}
        <TipCard />
      </div>
      {editing && (<Modal onClose={() => setEditing(null)} title="Edit Event"><EventForm initial={editing} onCancel={() => setEditing(null)} onSubmit={(val) => { onUpdate(val); setEditing(null); }} /></Modal>)}
      {creating && (<Modal onClose={() => setCreating(false)} title="New Event"><EventForm initial={{ id: uid(), date: todayISO(), start: "", end: "", title: "", type: "rehearsal", location: "", plan: "" }} onCancel={() => setCreating(false)} onSubmit={(val) => { onAdd(val); setCreating(false); }} /></Modal>)}
    </div>
  );
}
function EventCard({ e, role, onEdit, onDelete, onRequest }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="p-3 flex items-center gap-3">
        <TypePill type={e.type} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{e.title}</div>
          <div className="text-sm text-zinc-400 truncate">{e.date} · {fmtTime(e.start)}–{fmtTime(e.end)} · {e.location || "TBA"}</div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-sm">{open ? "Hide" : "Details"}</button>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div className="text-sm"><div className="text-zinc-400 mb-1">Rehearsal Plan / Notes</div><div className="whitespace-pre-wrap leading-relaxed">{e.plan || "—"}</div></div>
          <div className="flex items-center gap-2">
            {role === "student" ? (<AbsenceButton onSubmit={onRequest} eventTitle={e.title} />) : role === "guest" ? (<span className="text-sm text-zinc-400">Sign in as a student to request an absence.</span>) : null}
            {role === "director" && (<><button onClick={onEdit} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500">Edit</button><button onClick={onDelete} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500">Delete</button></>)}
          </div>
        </div>
      )}
    </div>
  );
}
function TypePill({ type }) { const map = { rehearsal: "Rehearsal", sectional: "Sectional", parade: "Parade", competition: "Competition", game: "Football Game" }; return <span className="text-xs px-2 py-1 rounded-full border border-zinc-700 bg-zinc-800/60">{map[type] || type}</span>; }
function EmptyCard({ title, subtitle }) { return (<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center"><div className="text-lg font-medium">{title}</div><div className="text-zinc-400">{subtitle}</div></div>); }
function TipCard() { return (<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"><div className="font-semibold mb-1">Tips</div><ul className="text-sm list-disc pl-5 space-y-1 text-zinc-300"><li>Sign in as a Student to submit absence requests tied to your name.</li><li>Sign in as a Director (PIN) to edit events and approve/deny requests.</li><li>Import your roster via CSV in Settings.</li></ul></div>); }
function Modal({ title, onClose, children }) { return (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center p-4"><div className="w/full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900"><div className="flex items-center justify-between p-3 border-b border-zinc-800"><div className="font-semibold">{title}</div><button onClick={onClose} className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700">×</button></div><div className="p-3">{children}</div></div></div>); }

function EventForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="grid gap-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
        <Field label="Start"><input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
        <Field label="End"><input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
        <Field label="Type">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
            <option value="rehearsal">Rehearsal</option>
            <option value="sectional">Sectional</option>
            <option value="parade">Parade</option>
            <option value="competition">Competition</option>
            <option value="game">Football Game</option>
          </select>
        </Field>
      </div>
      <Field label="Location"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
      <Field label="Rehearsal Plan / Notes"><textarea rows={5} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
      <div className="flex items-center justify-end gap-2"><button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700">Cancel</button><button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-medium">Save</button></div>
    </form>
  );
}
function Field({ label, children }) { return (<label className="grid gap-1 text-sm"><span className="text-zinc-400">{label}</span>{children}</label>); }

// Absences
function AbsenceButton({ onSubmit, eventTitle }) {
  const [open, setOpen] = useState(false);
  return (<><button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500">Request Absence</button>{open && (<Modal title={`Request absence – ${eventTitle}`} onClose={() => setOpen(false)}><AbsenceForm onCancel={() => setOpen(false)} onSubmit={(payload) => { onSubmit(payload); setOpen(false); }} /></Modal>)}</>);
}
function AbsenceForm({ onSubmit, onCancel }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ reason, note }); }} className="grid gap-3">
      <Field label="Reason"><select value={reason} onChange={(e) => setReason(e.target.value)} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2"><option value="">Select…</option><option>Illness</option><option>Family obligation</option><option>Work</option><option>Transportation</option><option>School activity</option><option>Other</option></select></Field>
      <Field label="Optional note (details)"><textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
      <div className="flex items-center justify-end gap-2"><button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700">Cancel</button><button type="submit" disabled={!reason} className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium disabled:opacity-50">Submit</button></div>
    </form>
  );
}
function AbsenceView({ role, studentName, absences, events, roster, onCancel }) {
  const [sectionFilter, setSectionFilter] = useState("");
  const sections = useMemo(() => Array.from(new Set(roster.map((r) => r.section).filter(Boolean))).sort(), [roster]);
  let list = role === "student" ? absences.filter((a) => a.student === studentName) : absences;
  if (role === "director" && sectionFilter) {
    const names = new Set(roster.filter((r) => r.section === sectionFilter).map((r) => r.name));
    list = list.filter((a) => names.has(a.student));
  }
  return (
    <div className="space-y-3">
      {role === "director" && (
        <div className="flex items-center gap-2">
          <div className="text-sm text-zinc-400">Filter by section</div>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm">
            <option value="">All Sections</option>
            {sections.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyCard title="No absence requests" subtitle={role === "student" ? "Submit from an event’s Details" : "Waiting on students…"} />
      ) : (
        list.slice().sort((a, b) => (a.submittedAt > b.submittedAt ? -1 : 1)).map((a) => (
          <div key={a.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs border ${statusColor(a.status)}`}>{a.status}</span>
              <div className="font-medium flex-1">{a.student} – {lookupEventTitle(events, a.eventId)}</div>
              <div className="text-sm text-zinc-400">{new Date(a.submittedAt).toLocaleString()}</div>
            </div>
            <div className="text-sm text-zinc-300 mt-1"><span className="text-zinc-400">Reason:</span> {a.reason}{a.note ? (<><span className="text-zinc-400"> · Note:</span> {a.note}</>) : null}</div>
            {a.directorNote && (<div className="text-sm text-emerald-300 mt-1"><span className="text-zinc-400">Director note:</span> {a.directorNote}</div>)}
            {role === "student" && a.status === "Pending" && (<div className="mt-2"><button onClick={() => onCancel(a.id)} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700">Cancel request</button></div>)}
          </div>
        ))
      )}
    </div>
  );
}
function DirectorPanel({ absences, events, roster, onDecision, settings }) {
  const [filter, setFilter] = useState("Pending");
  const [sectionFilter, setSectionFilter] = useState("");
  const sections = useMemo(() => Array.from(new Set(roster.map((r) => r.section).filter(Boolean))).sort(), [roster]);
  let list = absences.filter((a) => (filter === "All" ? true : a.status === filter));
  if (sectionFilter) {
    const names = new Set(roster.filter((r) => r.section === sectionFilter).map((r) => r.name));
    list = list.filter((a) => names.has(a.student));
  }
  const [note, setNote] = useState("");
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-3">
        {list.length === 0 ? (<EmptyCard title={`No ${filter.toLowerCase()} requests`} subtitle="You're all caught up." />) : (
          list.map((a) => (
            <div key={a.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs border ${statusColor(a.status)}`}>{a.status}</span>
                <div className="font-medium flex-1">{a.student} → {lookupEventTitle(events, a.eventId)}</div>
                <div className="text-sm text-zinc-400">{new Date(a.submittedAt).toLocaleString()}</div>
              </div>
              <div className="text-sm text-zinc-300 mt-1"><span className="text-zinc-400">Reason:</span> {a.reason}{a.note ? (<><span className="text-zinc-400"> · Note:</span> {a.note}</>) : null}</div>
              <div className="mt-2 flex items-center gap-2">
                <input className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" placeholder="Optional director note (visible to student)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button onClick={() => onDecision(a.id, "Denied", note)} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500">Deny</button>
                <button onClick={() => onDecision(a.id, "Approved", note)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500">Approve</button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="space-y-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-sm text-zinc-400 mb-1">Status Filter</div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2"><option>Pending</option><option>Approved</option><option>Denied</option><option>Cancelled</option><option>All</option></select>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-sm text-zinc-400 mb-1">Section Filter</div>
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2"><option value="">All Sections</option>{sections.map((s) => (<option key={s} value={s}>{s}</option>))}</select>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
          <div className="font-semibold mb-1">Sheets Sync</div>
          <div className="text-zinc-300">{settings.enableSheetsSync ? "Enabled" : "Disabled"}</div>
          <div className="truncate text-zinc-400 mt-1">{settings.scriptUrl || "No endpoint configured"}</div>
        </div>
      </div>
    </div>
  );
}

// Weekly Print View
function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0 Sun
  const delta = (dow + 6) % 7; // Monday as start
  d.setDate(d.getDate() - delta);
  return d;
}
function dateFromISO(iso) { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); }
function WeeklyPrintView({ events }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const startISO = dateToISO(weekStart);
  const end = new Date(weekStart); end.setDate(end.getDate() + 6); const endISO = dateToISO(end);
  const days = [...Array(7)].map((_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return dateToISO(d); });
  const byDay = Object.fromEntries(days.map((d) => [d, events.filter((e) => e.date === d).sort((a,b)=>a.start.localeCompare(b.start))]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between print:hidden">
        <div className="text-lg font-semibold">Week of {startISO} → {endISO}</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={() => { const d=new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }}>← Prev</button>
          <button className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={() => setWeekStart(startOfWeek(new Date()))}>This Week</button>
          <button className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={() => { const d=new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }}>Next →</button>
          <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {days.map((iso) => (
          <div key={iso} className="rounded-2xl border border-zinc-800 bg-white text-zinc-900 print:bg-white">
            <div className="px-3 py-2 border-b border-zinc-200 font-semibold">{iso} – {dateFromISO(iso).toLocaleDateString(undefined,{ weekday:'long'})}</div>
            <div className="p-3 space-y-2">
              {byDay[iso].length === 0 ? (
                <div className="text-sm text-zinc-500">No events</div>
              ) : byDay[iso].map((e) => (
                <div key={e.id} className="text-sm">
                  <div className="font-semibold">{e.title} <span className="font-normal text-zinc-600">({e.type})</span></div>
                  <div className="text-zinc-700">{fmtTime(e.start)}–{fmtTime(e.end)} · {e.location || "TBA"}</div>
                  {e.plan && (<div className="text-zinc-800 whitespace-pre-wrap border-l-2 border-zinc-300 pl-2 mt-1">{e.plan}</div>)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="text-xs text-zinc-400 print:hidden">Tip: Use the Print button for a clean handout with plans per day.</div>
    </div>
  );
}

// Settings (Sheets + CSV + PIN) with Test connection
function SettingsPanel({ settings, students, onSaveSettings, onReplaceRoster, onAddRecords }) {
  const [scriptUrl, setScriptUrl] = useState(settings.scriptUrl || "");
  const [enable, setEnable] = useState(!!settings.enableSheetsSync);
  const [pin, setPin] = useState(settings.directorPin || "2468");

  const [csvPreview, setCsvPreview] = useState([]);
  async function handleCsv(file) {
    const text = await file.text();
    const recs = parseCSVtoRoster(text);
    if (!recs.length) return alert("No records found. Expect columns: Name, Section (or Instrument), Email.");
    setCsvPreview(recs);
  }
  function downloadTemplate() {
    const content = "Name,Section,Email\\nMax Gray,Drum Major,max@example.com\\nJane Doe,Clarinet,jane@school.org\\n";
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "band_roster_template.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="font-semibold mb-2">Google Sheets (optional)</div>
        <p className="text-sm text-zinc-300">Deploy an Apps Script Web App connected to your Sheet, then paste the URL below. Toggle sync to enable create/update of absence requests and email notifications on status changes.</p>
        <Field label="Apps Script Endpoint URL"><input value={scriptUrl} onChange={(e) => setScriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
        <div className="flex items-center gap-2"><input id="sync" type="checkbox" checked={enable} onChange={(e) => setEnable(e.target.checked)} /><label htmlFor="sync" className="text-sm">Enable Sheets Sync</label></div>
        <Field label="Director PIN"><input value={pin} onChange={(e) => setPin(e.target.value)} className="w/full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2" /></Field>
        <div className="text-xs text-zinc-400">Tip: click Test to verify your Apps Script endpoint before enabling sync.</div>
        <div className="flex items-center gap-2 justify-end">
          <button onClick={async () => {
            if (!scriptUrl) return alert('Add your Apps Script URL first.');
            try {
              const res = await sheetsCreateOrUpdate(scriptUrl, { action: 'ping' });
              alert('Ping OK: ' + JSON.stringify(res).slice(0,200));
            } catch (e) {
              alert('Ping failed: ' + String(e).slice(0,200));
            }
          }} className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700">Test connection</button>
        </div>
        <div className="flex items-center gap-2 justify-end"><button onClick={() => onSaveSettings({ scriptUrl, enableSheetsSync: enable, directorPin: pin || "2468" })} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Save</button><button onClick={() => { localStorage.removeItem(LS_KEY); location.reload(); }} className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700">Reset Demo Data</button></div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
        <div className="font-semibold">Roster (CSV import)</div>
        <p className="text-sm text-zinc-300">Upload CSV with <code>Name</code>, <code>Section</code> (or <code>Instrument</code>), and optional <code>Email</code>. We'll trim blanks & dedupe by name.</p>
        <div className="flex items-center gap-2">
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleCsv(e.target.files[0])} />
          <button onClick={downloadTemplate} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm">Download template</button>
        </div>
        {csvPreview.length > 0 && (
          <div className="text-sm">
            <div className="text-zinc-400 mb-1">Preview ({csvPreview.length} records)</div>
            <div className="max-h-40 overflow-auto bg-zinc-950/60 border border-zinc-800 rounded-xl p-2">
              <table className="w/full text-left text-xs">
                <thead className="text-zinc-400"><tr><th className="pr-4">Name</th><th className="pr-4">Section</th><th>Email</th></tr></thead>
                <tbody>
                  {csvPreview.map((r, i) => (<tr key={i}><td className="pr-4">{r.name}</td><td className="pr-4">{r.section || "—"}</td><td>{r.email || "—"}</td></tr>))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => onReplaceRoster(csvPreview)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500">Replace roster</button>
              <button onClick={() => onAddRecords(csvPreview)} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500">Append to roster</button>
              <button onClick={() => setCsvPreview([])} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700">Clear preview</button>
            </div>
          </div>
        )}
        <div className="text-sm text-zinc-300">
          <div className="text-zinc-400 mb-1">Current roster ({students.length})</div>
          <div className="max-h-48 overflow-auto bg-zinc-950/60 border border-zinc-800 rounded-xl p-2">
            <table className="w/full text-left text-xs">
              <thead className="text-zinc-400"><tr><th className="pr-4">Name</th><th className="pr-4">Section</th><th>Email</th></tr></thead>
              <tbody>
                {students.map((r) => (<tr key={r.name}><td className="pr-4">{r.name}</td><td className="pr-4">{r.section || "—"}</td><td>{r.email || "—"}</td></tr>))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers
function lookupEventTitle(events, id) { return events.find((e) => e.id === id)?.title || "(event)"; }
function statusColor(status) { switch (status) { case "Approved": return "border-emerald-600 text-emerald-300"; case "Denied": return "border-rose-600 text-rose-300"; case "Cancelled": return "border-zinc-600 text-zinc-300"; default: return "border-amber-600 text-amber-300"; } }
function dedupeByName(arr) { const seen = new Set(); const out = []; for (const r of arr) { const key = (r.name||"").trim().toLowerCase(); if (!key || seen.has(key)) continue; seen.add(key); out.push({ name: r.name.trim(), section: (r.section||"").trim(), email: (r.email||"").trim() }); } return out.sort((a,b)=>a.name.localeCompare(b.name)); }
function parseCSVtoRoster(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (!lines.length) return [];
  const headers = safeSplit(lines[0]).map((h) => h.toLowerCase());
  const idxName = headers.findIndex((h) => /name/.test(h));
  const idxSection = headers.findIndex((h) => /(section|instrument)/.test(h));
  const idxEmail = headers.findIndex((h) => /email/.test(h));
  const recs = [];
  if (idxName >= 0) {
    for (let i = 1; i < lines.length; i++) {
      const cols = safeSplit(lines[i]);
      recs.push({ name: (cols[idxName]||"").trim(), section: (cols[idxSection]||"").trim(), email: (cols[idxEmail]||"").trim() });
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      const cols = safeSplit(lines[i]);
      if (!cols[0] || i===0) continue;
      recs.push({ name: cols[0].trim() });
    }
  }
  return dedupeByName(recs);
}
function safeSplit(line) { const out = []; let cur = ""; let inQ = False; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { inQ = !inQ; continue; } if (c === ',' && !inQ) { out.push(cur); cur = ""; continue; } cur += c; } out.push(cur); return out.map((s) => s.trim().replace(/^"|"$/g, "")); }

async function handleAbsenceSubmit({ state, setState, studentName, event, payload }) {
  if (!state.auth.role || state.auth.role !== "student") { alert("Please sign in as a student first."); return; }
  const student = state.students.find((s) => s.name === studentName) || { name: studentName };
  const rec = { id: uid(), eventId: event.id, eventTitle: event.title, student: studentName, studentEmail: student.email || "", reason: payload.reason, note: payload.note, status: "Pending", directorNote: "", submittedAt: new Date().toISOString() };
  setState((s) => ({ ...s, absences: [rec, ...s.absences] }));
  try {
    if (state.settings.enableSheetsSync && state.settings.scriptUrl) {
      await sheetsCreateOrUpdate(state.settings.scriptUrl, { action: "createAbsence", record: rec });
    }
  } catch (err) { console.error(err); alert("Sheets sync failed. Saved locally only.\\n" + String(err).slice(0,200)); }
}

/** @typedef {{ role: null|"student"|"director", name: string }} Auth */
/** @typedef {{ id: string, eventId: string, eventTitle: string, student: string, studentEmail: string, reason: string, note: string, status: "Pending"|"Approved"|"Denied"|"Cancelled", directorNote: string, submittedAt: string }} Absence */
