"use client";

import { useState } from "react";
import { BookMarked, Database, Plus, ShieldAlert, Users, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Difficulty, Role, SheetStatus, VerificationStatus } from "@prisma/client";
import type { AdminData, AdminTab } from "./types";
import type { AdminSheetQuestion } from "./types";
import { OverviewTab } from "./OverviewTab";
import { QuestionsTab } from "./QuestionsTab";
import { SheetsTab } from "./SheetsTab";
import { AccountsTab } from "./AccountsTab";
import { AdminsTab } from "./AdminsTab";
import { AddQuestionModal, ParsedProblem } from "./AddQuestionModal";
import { CreateSheetModal, SheetModalValues } from "./CreateSheetModal";
import { DEFAULT_SHEET_SCORING } from "@/lib/scoring/global";
import { EditQuestionModal } from "./EditQuestionModal";
import { AchievementsTab } from "./AchievementsTab";

const tabs: { id: AdminTab; label: string; icon: typeof Plus }[] = [
  { id: "overview", label: "Overview Metrics", icon: Database },
  { id: "questions", label: "Questions DB", icon: Plus },
  { id: "sheets", label: "DSA Sheets", icon: BookMarked },
  { id: "accounts", label: "LeetCode Accounts", icon: Users },
  { id: "admins", label: "Admins & Roles", icon: UsersRound },
  { id: "achievements", label: "Achievements", icon: ShieldAlert },
];

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Client container for the admin console: tabs, modals and mutation handlers. */
export function AdminView({ data }: { data: AdminData }) {
  const router = useRouter();
  const { overview, sheets, questions, platformAccounts, syncLogs, profiles, currentAdminId } = data;

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [actionError, setActionError] = useState<string | null>(null);

  // Add Question modal state
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [problemUrl, setProblemUrl] = useState("");
  const [parsingUrl, setParsingUrl] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedProblem | null>(null);
  const [selectedSheetId, setSelectedSheetId] = useState(sheets[0]?.id || "");
  const [customTitle, setCustomTitle] = useState("");
  const [customTopic, setCustomTopic] = useState("Arrays");
  const [customDifficulty, setCustomDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [modalError, setModalError] = useState<string | null>(null);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Edit Question modal state
  const [editingQuestion, setEditingQuestion] = useState<AdminSheetQuestion | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [editPosition, setEditPosition] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  // Create/Edit Sheet modal state
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [sheetForm, setSheetForm] = useState<SheetModalValues>({
    name: "",
    slug: "",
    description: "",
    ...DEFAULT_SHEET_SCORING,
  });
  const [savingSheet, setSavingSheet] = useState(false);

  // Questions table filters
  const [questionSearch, setQuestionSearch] = useState("");
  const [filterSheetId, setFilterSheetId] = useState("ALL");

  // Admins & Roles tab state
  const [adminsError, setAdminsError] = useState<string | null>(null);

  const postJson = async (url: string, body: unknown, method = "POST") => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const handleParseUrl = async () => {
    if (!problemUrl.trim()) return;
    setParsingUrl(true);
    setModalError(null);
    try {
      const data = await postJson("/api/admin/questions/parse-url", { url: problemUrl.trim() });
      setParsedData(data);
      setCustomTitle(data.title);
      setCustomTopic(data.topic || "General");
      setCustomDifficulty((data.difficulty as Difficulty) || Difficulty.EASY);
    } catch (err: any) {
      setModalError(err.message || "Failed to parse URL");
    } finally {
      setParsingUrl(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!parsedData || !selectedSheetId) return;
    setSavingQuestion(true);
    setModalError(null);
    try {
      await postJson("/api/admin/questions", {
        url: parsedData.normalizedUrl,
        title: customTitle || parsedData.title,
        topic: customTopic || "General",
        tags: parsedData.tags || [],
        difficulty: customDifficulty,
        sheetId: selectedSheetId,
      });
      setShowAddQuestionModal(false);
      setProblemUrl("");
      setParsedData(null);
      router.refresh();
    } catch (err: any) {
      setModalError(err.message || "Failed to save question");
    } finally {
      setSavingQuestion(false);
    }
  };

  const openEditQuestion = (sq: AdminSheetQuestion) => {
    setEditingQuestion(sq);
    setEditTitle(sq.question.title);
    setEditTopic(sq.question.topic);
    setEditDifficulty(sq.question.difficulty);
    setEditPosition(sq.position);
  };

  const handleSaveEditQuestion = async () => {
    if (!editingQuestion) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      await postJson(
        `/api/admin/questions/${editingQuestion.id}`,
        {
          title: editTitle.trim(),
          topic: editTopic.trim(),
          difficulty: editDifficulty,
          position: editPosition,
        },
        "PATCH"
      );
      setEditingQuestion(null);
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to update question");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemoveQuestion = async (sheetQuestionId: string) => {
    if (!confirm("Remove this question from the sheet?")) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/questions/${sheetQuestionId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove question");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to remove question");
    }
  };

  const openCreateSheet = () => {
    setEditingSheetId(null);
    setSheetForm({ name: "", slug: "", description: "", ...DEFAULT_SHEET_SCORING });
    setShowSheetModal(true);
  };

  const openEditSheet = (sheet: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    easyPoints: number;
    mediumPoints: number;
    hardPoints: number;
  }) => {
    setEditingSheetId(sheet.id);
    setSheetForm({
      name: sheet.name,
      slug: sheet.slug,
      description: sheet.description || "",
      easyPoints: sheet.easyPoints,
      mediumPoints: sheet.mediumPoints,
      hardPoints: sheet.hardPoints,
    });
    setShowSheetModal(true);
  };

  const handleSaveSheet = async () => {
    if (!sheetForm.name.trim() || (!editingSheetId && !sheetForm.slug.trim())) return;
    setSavingSheet(true);
    setActionError(null);
    try {
      const pointsPayload = {
        easyPoints: Number.isFinite(sheetForm.easyPoints) ? sheetForm.easyPoints : DEFAULT_SHEET_SCORING.easyPoints,
        mediumPoints: Number.isFinite(sheetForm.mediumPoints)
          ? sheetForm.mediumPoints
          : DEFAULT_SHEET_SCORING.mediumPoints,
        hardPoints: Number.isFinite(sheetForm.hardPoints) ? sheetForm.hardPoints : DEFAULT_SHEET_SCORING.hardPoints,
      };
      if (editingSheetId) {
        await postJson(
          `/api/admin/sheets/${editingSheetId}`,
          {
            name: sheetForm.name.trim(),
            description: sheetForm.description.trim(),
            ...pointsPayload,
          },
          "PATCH"
        );
      } else {
        await postJson("/api/admin/sheets", {
          name: sheetForm.name.trim(),
          slug: sheetForm.slug.trim().toLowerCase(),
          description: sheetForm.description.trim(),
          status: SheetStatus.PUBLISHED,
          ...pointsPayload,
        });
      }
      setShowSheetModal(false);
      setEditingSheetId(null);
      setSheetForm({ name: "", slug: "", description: "", ...DEFAULT_SHEET_SCORING });
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to save sheet");
    } finally {
      setSavingSheet(false);
    }
  };

  const handleDeleteSheet = async (sheet: { id: string; name: string; questionCount: number }) => {
    if (
      !confirm(
        `Permanently delete "${sheet.name}" and all its question assignments? The canonical questions are kept. This cannot be undone.`
      )
    )
      return;
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/sheets/${sheet.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete sheet");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to delete sheet");
    }
  };

  const handleToggleSheetStatus = async (sheetId: string, currentStatus: SheetStatus) => {
    const nextStatus =
      currentStatus === SheetStatus.PUBLISHED ? SheetStatus.ARCHIVED : SheetStatus.PUBLISHED;
    setActionError(null);
    try {
      await postJson(`/api/admin/sheets/${sheetId}`, { status: nextStatus }, "PATCH");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to update sheet");
    }
  };

  const handleAccountStatus = async (accountId: string, status: VerificationStatus) => {
    setActionError(null);
    try {
      await postJson("/api/admin/platform-accounts", { accountId, status }, "PATCH");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to update account status");
    }
  };

  const handleSetRole = async (userId: string, role: Role) => {
    const verb = role === Role.ADMIN ? "promote this user to administrator" : "demote this user to a regular member";
    if (!confirm(`Are you sure you want to ${verb}?`)) return;
    setAdminsError(null);
    try {
      await postJson("/api/admin/admins", { userId, role }, "PATCH");
      router.refresh();
    } catch (err: any) {
      setAdminsError(err.message || "Failed to update role");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !confirm(
        "Permanently delete this user, all their synced platform data, and unlink their Google account? This cannot be undone."
      )
    )
      return;
    setAdminsError(null);
    try {
      await postJson("/api/admin/admins", { userId }, "DELETE");
      router.refresh();
    } catch (err: any) {
      setAdminsError(err.message || "Failed to delete user");
    }
  };

  const handleSystemSync = async () => {
    setActionError(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sync failed");
      alert(data.message || "System synchronization finished.");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "System sync failed");
    }
  };

  const tabCounts: Record<AdminTab, string> = {
    overview: "",
    questions: ` (${questions.length})`,
    sheets: ` (${sheets.length})`,
    accounts: ` (${platformAccounts.length})`,
    admins: ` (${profiles.length})`,
    achievements: "",
  };

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="glass-card p-6 rounded-2xl border-l-4 border-l-brand-primary flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-content-primary flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-brand-primary" />
            <span>Admin Management Console</span>
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1">
            Manage LeetCode questions, sheets, verified student accounts, and roles. Each sheet can set its own Easy/Medium/Hard points (default 1 · 4 · 8).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddQuestionModal(true)}
            className="px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-hover text-content-primary font-bold text-xs flex items-center gap-2 transition shadow-md shadow-brand-primary/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add DSA Question</span>
          </button>
          <button
            onClick={openCreateSheet}
            className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-outline-subtle text-content-primary font-bold text-xs border border-outline-subtle flex items-center gap-2 transition"
          >
            <BookMarked className="w-4 h-4 text-brand-primary" />
            <span>Create Sheet</span>
          </button>
        </div>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="p-4 rounded-xl bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-subtle pb-3">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === id
                ? "bg-brand-primary text-content-primary shadow-md shadow-brand-primary/20"
                : "bg-surface-elevated/80 text-content-muted hover:text-content-primary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>
              {label}
              {tabCounts[id]}
            </span>
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          overview={overview}
          syncLogs={syncLogs}
          syncingAll={false}
          onSystemSync={handleSystemSync}
        />
      )}
      {activeTab === "questions" && (
        <QuestionsTab
          sheets={sheets}
          questions={questions}
          filterSheetId={filterSheetId}
          onFilterSheetChange={setFilterSheetId}
          search={questionSearch}
          onSearchChange={setQuestionSearch}
          onAddQuestion={() => setShowAddQuestionModal(true)}
          onEditQuestion={openEditQuestion}
          onRemoveQuestion={handleRemoveQuestion}
        />
      )}
      {activeTab === "sheets" && (
        <SheetsTab
          sheets={sheets}
          onCreateSheet={openCreateSheet}
          onEditSheet={openEditSheet}
          onDeleteSheet={(s) =>
            handleDeleteSheet({ id: s.id, name: s.name, questionCount: s._count.sheetQuestions })
          }
          onToggleStatus={handleToggleSheetStatus}
        />
      )}
      {activeTab === "accounts" && (
        <AccountsTab accounts={platformAccounts} onSetStatus={handleAccountStatus} />
      )}
      {activeTab === "admins" && (
        <AdminsTab
          profiles={profiles}
          currentAdminId={currentAdminId}
          error={adminsError}
          onSetRole={handleSetRole}
          onDeleteUser={handleDeleteUser}
        />
      )}
      {activeTab === "achievements" && <AchievementsTab />}

      {/* MODAL: ADD QUESTION */}
      {showAddQuestionModal && (
        <AddQuestionModal
          sheets={sheets}
          problemUrl={problemUrl}
          parsingUrl={parsingUrl}
          parsedData={parsedData}
          selectedSheetId={selectedSheetId}
          customTitle={customTitle}
          customTopic={customTopic}
          customDifficulty={customDifficulty}
          modalError={modalError}
          savingQuestion={savingQuestion}
          onProblemUrlChange={setProblemUrl}
          onParseUrl={handleParseUrl}
          onSelectedSheetChange={setSelectedSheetId}
          onCustomTitleChange={setCustomTitle}
          onCustomTopicChange={setCustomTopic}
          onCustomDifficultyChange={setCustomDifficulty}
          onSave={handleSaveQuestion}
          onClose={() => setShowAddQuestionModal(false)}
        />
      )}

      {/* MODAL: EDIT QUESTION */}
      {editingQuestion && (
        <EditQuestionModal
          sheetQuestion={editingQuestion}
          title={editTitle}
          topic={editTopic}
          difficulty={editDifficulty}
          position={editPosition}
          saving={savingEdit}
          onTitleChange={setEditTitle}
          onTopicChange={setEditTopic}
          onDifficultyChange={setEditDifficulty}
          onPositionChange={setEditPosition}
          onSave={handleSaveEditQuestion}
          onClose={() => setEditingQuestion(null)}
        />
      )}

      {/* MODAL: CREATE / EDIT SHEET */}
      {showSheetModal && (
        <CreateSheetModal
          initial={editingSheetId ? sheetForm : null}
          name={sheetForm.name}
          slug={sheetForm.slug}
          description={sheetForm.description}
          easyPoints={sheetForm.easyPoints}
          mediumPoints={sheetForm.mediumPoints}
          hardPoints={sheetForm.hardPoints}
          saving={savingSheet}
          onNameChange={(name) => setSheetForm((p) => ({ ...p, name }))}
          onSlugChange={(slug) =>
            setSheetForm((p) => ({ ...p, slug: editingSheetId ? p.slug : slug || slugify(p.name) }))
          }
          onDescriptionChange={(description) => setSheetForm((p) => ({ ...p, description }))}
          onPointsChange={(field, value) => setSheetForm((p) => ({ ...p, [field]: value }))}
          onCreate={handleSaveSheet}
          onClose={() => {
            setShowSheetModal(false);
            setEditingSheetId(null);
          }}
        />
      )}
    </div>
  );
}
