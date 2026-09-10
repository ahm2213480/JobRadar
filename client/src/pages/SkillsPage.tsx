import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import type { LearningGoal, SkillGapItem, SkillsGapResponse } from '../types/application';

function DemandBar({ item }: { item: SkillGapItem }) {
  const color = item.owned
    ? 'bg-emerald-500'
    : item.demandPct >= 60
      ? 'bg-rose-500'
      : item.demandPct >= 40
        ? 'bg-amber-500'
        : 'bg-blue-500';
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 truncate text-sm font-medium">{item.name}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${item.demandPct}%` }} />
      </div>
      <span className="w-14 text-right text-xs text-slate-500 dark:text-slate-400">
        {item.demandPct}%
      </span>
    </div>
  );
}

export function SkillsPage() {
  const [gap, setGap] = useState<SkillsGapResponse | null>(null);
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newSkillName, setNewSkillName] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [goalBusy, setGoalBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gapData, goalData] = await Promise.all([
        api.getSkillsGap(),
        api.listLearningGoals().catch(() => [] as LearningGoal[]),
      ]);
      setGap(gapData);
      setGoals(goalData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  async function handleAddGoal() {
    if (!gap || !newSkillName.trim()) return;
    const match = [...gap.gaps, ...gap.strengths].find(
      (item) => item.name.toLowerCase() === newSkillName.trim().toLowerCase(),
    );
    setGoalBusy(true);
    setError(null);
    try {
      const goal = await api.createLearningGoal({
        skillId: match?.skillId ?? '',
        ...(newDueDate ? { dueDate: new Date(newDueDate).toISOString() } : {}),
      });
      setGoals((prev) => [goal, ...prev]);
      setNewSkillName('');
      setNewDueDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add learning goal');
    } finally {
      setGoalBusy(false);
    }
  }

  async function toggleGoal(goal: LearningGoal) {
    const next = goal.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
    try {
      const updated = await api.updateLearningGoal(goal.id, { status: next });
      setGoals((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal');
    }
  }

  async function removeGoal(goal: LearningGoal) {
    if (!window.confirm(`Delete the learning goal for “${goal.skillName}”?`)) return;
    try {
      await api.deleteLearningGoal(goal.id);
      setGoals((prev) => prev.filter((entry) => entry.id !== goal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
    }
  }
  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading skills data…
      </p>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Skills & learning</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          See where you fall short against your target jobs and track learning goals.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Skills gap
        </h2>
        {gap && gap.gaps.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            No gap detected — your skills match your target jobs. 🎉
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {gap?.gaps.map((item) => <DemandBar key={item.skillId} item={item} />)}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Strengths
        </h2>
        <div className="mt-4 space-y-3">
          {gap?.strengths.map((item) => <DemandBar key={item.skillId} item={item} />)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Learning goals
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            id="newSkill"
            label="Add a skill to learn"
            placeholder="e.g. Docker"
            value={newSkillName}
            onChange={(event) => setNewSkillName(event.target.value)}
          />
          <TextField
            id="newDueDate"
            label="Due date"
            type="date"
            value={newDueDate}
            onChange={(event) => setNewDueDate(event.target.value)}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={handleAddGoal} disabled={goalBusy || !newSkillName.trim()}>
            {goalBusy ? 'Adding…' : 'Add goal'}
          </Button>
        </div>
        {goals.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No learning goals yet — add one above to start tracking.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {goals.map((goal) => (
              <li key={goal.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className={`text-sm font-medium ${goal.status === 'COMPLETED' ? 'text-slate-400 line-through' : ''}`}>
                    {goal.skillName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {goal.dueDate ? `Due ${new Date(goal.dueDate).toLocaleDateString()}` : 'No due date'}
                    {' · '}
                    {goal.status === 'COMPLETED' ? 'Completed' : 'Active'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => toggleGoal(goal)}>
                    {goal.status === 'COMPLETED' ? 'Reopen' : 'Complete'}
                  </Button>
                  <Button variant="ghost" onClick={() => removeGoal(goal)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}