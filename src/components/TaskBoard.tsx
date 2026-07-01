import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus, CheckSquare, Square, Trash2, Flag, Calendar,
  Loader2, AlertCircle, CheckCircle2, Clock, ListTodo,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  is_done: boolean;
  due_date?: string | null;
  created_at: string;
}

type Priority = "high" | "medium" | "low";

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string }> = {
  high:   { label: "High",   color: "text-red-600",    bg: "bg-red-50 border-red-200"    },
  medium: { label: "Medium", color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  low:    { label: "Low",    color: "text-green-600",  bg: "bg-green-50 border-green-200" },
};

// SQL to run once in Supabase SQL editor:
// create table if not exists user_tasks (
//   id          uuid primary key default gen_random_uuid(),
//   user_id     uuid not null references profiles(id) on delete cascade,
//   title       text not null,
//   description text,
//   priority    text not null default 'medium',
//   is_done     boolean not null default false,
//   due_date    date,
//   created_at  timestamptz not null default now()
// );
// alter table user_tasks enable row level security;
// create policy "own tasks" on user_tasks for all using (auth.uid() = user_id);

// ── TaskBoard ──────────────────────────────────────────────────────────────────
export default function TaskBoard({ userId }: { userId: string }) {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);
  const [dbReady, setDbReady]       = useState(true);
  const [filter, setFilter]         = useState<"all" | "pending" | "done">("all");
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);

  const [form, setForm] = useState<{
    title: string; description: string; priority: Priority; due_date: string;
  }>({ title: "", description: "", priority: "medium", due_date: "" });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") {
        setDbReady(false);
      } else {
        console.error("TaskBoard fetch error:", error);
      }
    } else {
      setTasks((data as Task[]) || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      user_id:     userId,
      title:       form.title.trim(),
      description: form.description.trim() || null,
      priority:    form.priority,
      is_done:     false,
    };
    if (form.due_date) payload.due_date = form.due_date;

    const { data, error } = await supabase
      .from("user_tasks")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("TaskBoard insert error:", error);
      toast.error(`Failed to create task: ${error.message}`);
    } else {
      setTasks((prev) => [data as Task, ...prev]);
      setForm({ title: "", description: "", priority: "medium", due_date: "" });
      setShowForm(false);
      toast.success("✅ Task created!");
    }
    setSaving(false);
  };

  // ── Toggle done ────────────────────────────────────────────────────────────
  const toggleDone = async (task: Task) => {
    const newDone = !task.is_done;
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, is_done: newDone } : t));
    const { error } = await supabase
      .from("user_tasks")
      .update({ is_done: newDone })
      .eq("id", task.id);
    if (error) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, is_done: task.is_done } : t));
      toast.error("Update failed: " + error.message);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("user_tasks").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed: " + error.message);
      fetchTasks();
    } else {
      toast.success("Task deleted");
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = tasks.filter((t) => {
    if (filter === "pending") return !t.is_done;
    if (filter === "done")    return t.is_done;
    return true;
  });

  const pending = tasks.filter((t) => !t.is_done).length;
  const done    = tasks.filter((t) => t.is_done).length;

  // ── No-DB state ────────────────────────────────────────────────────────────
  if (!dbReady) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle size={40} className="text-amber-500 mb-3" />
      <p className="text-lg font-black text-gray-800 mb-1">Database table not found</p>
      <p className="text-sm text-gray-500 mb-4">Run this SQL once in your Supabase SQL editor:</p>
      <pre className="text-left bg-gray-900 text-green-300 text-xs rounded-xl p-4 max-w-full overflow-x-auto whitespace-pre-wrap">{`create table if not exists user_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null,
  description text,
  priority    text not null default 'medium',
  is_done     boolean not null default false,
  due_date    date,
  created_at  timestamptz not null default now()
);
alter table user_tasks enable row level security;
create policy "own tasks" on user_tasks
  for all using (auth.uid() = user_id);`}</pre>
      <button onClick={fetchTasks} className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm active:scale-95">
        Retry
      </button>
    </div>
  );

  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-5 pb-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListTodo size={22} className="text-blue-600" />
            <h1 className="text-xl font-black text-gray-900">My Tasks</h1>
          </div>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm active:scale-95 shadow"
          >
            <Plus size={16} /> New Task
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          {[
            { label: "All",     value: tasks.length, key: "all"     },
            { label: "Pending", value: pending,       key: "pending" },
            { label: "Done",    value: done,          key: "done"    },
          ].map(({ label, value, key }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`flex-1 rounded-xl py-1.5 text-xs font-black transition-all border ${
                filter === key
                  ? "bg-blue-600 text-white border-blue-600 shadow"
                  : "bg-gray-100 text-gray-500 border-transparent"
              }`}
            >
              {value} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white border-b border-gray-100 shadow-sm"
          >
            <div className="px-4 py-4 space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Task title *"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)"
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 outline-none resize-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                {/* Priority */}
                <div className="flex-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Priority</p>
                  <div className="flex gap-1">
                    {(["high", "medium", "low"] as Priority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-black border transition-all ${
                          form.priority === p
                            ? PRIORITY_CFG[p].bg + " " + PRIORITY_CFG[p].color + " border-current"
                            : "bg-gray-100 text-gray-400 border-transparent"
                        }`}
                      >
                        {PRIORITY_CFG[p].label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Due date */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Due Date</p>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 bg-white active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-black active:scale-95 disabled:opacity-50 shadow"
                >
                  {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create Task"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list */}
      <div className="px-4 pt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <CheckCircle2 size={40} className="text-gray-200 mb-3" />
            <p className="text-base font-black text-gray-400">
              {filter === "done" ? "No completed tasks yet" : "No tasks — add one!"}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((task) => {
              const pCfg = PRIORITY_CFG[task.priority as Priority] ?? PRIORITY_CFG.medium;
              const isOverdue =
                !task.is_done && task.due_date &&
                new Date(task.due_date) < new Date(new Date().toDateString());

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  className={`bg-white rounded-2xl border shadow-sm p-4 flex gap-3 items-start transition-opacity ${
                    task.is_done ? "opacity-60" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleDone(task)}
                    className="mt-0.5 shrink-0 active:scale-90 transition-transform"
                  >
                    {task.is_done
                      ? <CheckSquare size={22} className="text-blue-500" />
                      : <Square     size={22} className="text-gray-300" />
                    }
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black text-gray-800 leading-tight ${task.is_done ? "line-through text-gray-400" : ""}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {/* Priority badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${pCfg.bg} ${pCfg.color}`}>
                        <Flag size={8} className="inline mr-0.5" />{pCfg.label}
                      </span>
                      {/* Due date */}
                      {task.due_date && (
                        <span className={`flex items-center gap-1 text-[10px] font-bold ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                          <Clock size={9} />
                          {isOverdue ? "Overdue · " : ""}
                          {new Date(task.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
