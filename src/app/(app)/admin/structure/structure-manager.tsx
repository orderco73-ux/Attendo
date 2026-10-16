"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import type { Structure } from "@/server/services/academic";
import { Tabs, TabsContent, TabsList, TabsTrigger, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlay";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/misc";
import { Field, handleResult } from "@/components/shared/form";
import { ActiveBadge } from "@/components/shared/badges";
import { EmptyState, Section } from "@/components/shared/page";
import { SPECIALIZATION_POLICY_LABELS, SPECIALIZATION_POLICIES, type SpecializationPolicy } from "@/lib/constants";
import { saveCollegeAction, saveDepartmentAction, saveSectionAction, saveYearAction } from "@/server/actions/admin";
import type { ActionResult } from "@/server/actions/_run";

type Kind = "college" | "year" | "department" | "section";
type Editing = { kind: Kind; id?: string; values: Record<string, string | boolean | number> } | null;

export function StructureManager({ structure }: { structure: Structure }) {
  const [editing, setEditing] = useState<Editing>(null);
  const collegeName = (id: string) => structure.colleges.find((c) => c.id === id)?.name ?? "—";
  const yearName = (id: string) => structure.years.find((c) => c.id === id)?.name ?? "—";
  const deptName = (id: string | null) => (id ? structure.departments.find((c) => c.id === id)?.name ?? "—" : "كل الأقسام");
  const firstCollege = structure.colleges[0]?.id ?? "";

  const add = (kind: Kind, values: Record<string, string | boolean | number>) => setEditing({ kind, values });

  return (
    <>
      <Tabs defaultValue="years">
        <TabsList>
          <TabsTrigger value="colleges">الكليات ({structure.colleges.length})</TabsTrigger>
          <TabsTrigger value="years">السنوات الدراسية ({structure.years.length})</TabsTrigger>
          <TabsTrigger value="departments">الأقسام والتخصصات ({structure.departments.length})</TabsTrigger>
          <TabsTrigger value="sections">الشُعب ({structure.sections.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="colleges">
          <Section title="الكليات" actions={<Button size="sm" onClick={() => add("college", { name: "", code: "", active: true })}><Plus /> إضافة كلية</Button>}>
            {structure.colleges.length === 0 ? (
              <EmptyState title="لا توجد كليات" description="أضف أول كلية أو شغّل سكربت الإعداد الأولي (npm run seed)." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الرمز</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structure.colleges.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="ltr text-xs">{c.code}</TableCell>
                      <TableCell><ActiveBadge active={c.active} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="تعديل" onClick={() => setEditing({ kind: "college", id: c.id, values: { name: c.name, code: c.code, active: c.active } })}>
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="years">
          <Section title="السنوات الدراسية" description="سياسة التخصص تحدد الأقسام المسموحة لطلاب كل سنة ويتم فرضها على الخادم." actions={<Button size="sm" disabled={!firstCollege} onClick={() => add("year", { college: firstCollege, name: "", level: structure.years.length + 1, specializationPolicy: "any", active: true })}><Plus /> إضافة سنة</Button>}>
            {structure.years.length === 0 ? (
              <EmptyState title="لا توجد سنوات دراسية" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستوى</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الكلية</TableHead>
                    <TableHead>سياسة التخصص</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structure.years.map((y) => (
                    <TableRow key={y.id}>
                      <TableCell className="tabular-nums">{y.level}</TableCell>
                      <TableCell className="font-medium">{y.name}</TableCell>
                      <TableCell className="text-muted-foreground">{collegeName(y.college)}</TableCell>
                      <TableCell><Badge variant={y.specializationPolicy === "general_only" ? "muted" : "default"}>{SPECIALIZATION_POLICY_LABELS[y.specializationPolicy]}</Badge></TableCell>
                      <TableCell><ActiveBadge active={y.active} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="تعديل" onClick={() => setEditing({ kind: "year", id: y.id, values: { college: y.college, name: y.name, level: y.level, specializationPolicy: y.specializationPolicy, active: y.active } })}>
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="departments">
          <Section title="الأقسام والتخصصات" actions={<Button size="sm" disabled={!firstCollege} onClick={() => add("department", { college: firstCollege, name: "", code: "", isGeneral: false, active: true })}><Plus /> إضافة قسم</Button>}>
            {structure.departments.length === 0 ? (
              <EmptyState title="لا توجد أقسام" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الرمز</TableHead>
                    <TableHead>الكلية</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structure.departments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="ltr text-xs">{d.code}</TableCell>
                      <TableCell className="text-muted-foreground">{collegeName(d.college)}</TableCell>
                      <TableCell>{d.isGeneral ? <Badge variant="muted">بدون تخصص (عام)</Badge> : <Badge>تخصص</Badge>}</TableCell>
                      <TableCell><ActiveBadge active={d.active} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="تعديل" onClick={() => setEditing({ kind: "department", id: d.id, values: { college: d.college, name: d.name, code: d.code, isGeneral: d.isGeneral, active: d.active } })}>
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="sections">
          <Section title="الشُعب / الفصول" description="اختيارية: تستخدم لتقسيم طلاب السنة إلى مجموعات." actions={<Button size="sm" disabled={!structure.years.length} onClick={() => add("section", { academicYear: structure.years[0]?.id ?? "", department: "", name: "", active: true })}><Plus /> إضافة شعبة</Button>}>
            {structure.sections.length === 0 ? (
              <EmptyState title="لا توجد شُعب" description="يمكن تشغيل النظام بدون شُعب." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>السنة</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structure.sections.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{yearName(s.academicYear)}</TableCell>
                      <TableCell className="text-muted-foreground">{deptName(s.department)}</TableCell>
                      <TableCell><ActiveBadge active={s.active} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="تعديل" onClick={() => setEditing({ kind: "section", id: s.id, values: { academicYear: s.academicYear, department: s.department ?? "", name: s.name, active: s.active } })}>
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
        </TabsContent>
      </Tabs>
      {editing && <EditDialog editing={editing} structure={structure} onClose={() => setEditing(null)} />}
    </>
  );
}

const TITLES: Record<Kind, string> = { college: "كلية", year: "سنة دراسية", department: "قسم / تخصص", section: "شعبة" };

function EditDialog({ editing, structure, onClose }: { editing: NonNullable<Editing>; structure: Structure; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(editing.values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: string, val: string | boolean | number) => setV((p) => ({ ...p, [k]: val }));
  const s = (k: string) => String(v[k] ?? "");

  const submit = () =>
    start(async () => {
      const actions: Record<Kind, (i: unknown, id?: string) => Promise<ActionResult<string>>> = {
        college: saveCollegeAction,
        year: saveYearAction,
        department: saveDepartmentAction,
        section: saveSectionAction,
      };
      const res = await actions[editing.kind](v, editing.id);
      setErrors(res.ok ? {} : res.fieldErrors ?? {});
      if (handleResult(null, res, "تم الحفظ")) {
        onClose();
        router.refresh();
      }
    });

  const collegeSelect = (
    <Field label="الكلية" required error={errors.college}>
      <NativeSelect value={s("college")} onChange={(e) => set("college", e.target.value)}>
        {structure.colleges.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing.id ? "تعديل" : "إضافة"} {TITLES[editing.kind]}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {editing.kind === "college" && (
            <>
              <Field label="اسم الكلية" required error={errors.name}><Input value={s("name")} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="الرمز (لاتيني)" required error={errors.code}><Input dir="ltr" value={s("code")} onChange={(e) => set("code", e.target.value)} /></Field>
            </>
          )}
          {editing.kind === "year" && (
            <>
              {collegeSelect}
              <div className="grid grid-cols-3 gap-3">
                <Field label="الاسم" required error={errors.name} className="col-span-2"><Input value={s("name")} onChange={(e) => set("name", e.target.value)} /></Field>
                <Field label="المستوى" required error={errors.level}><Input type="number" min={1} max={12} value={s("level")} onChange={(e) => set("level", Number(e.target.value))} /></Field>
              </div>
              <Field label="سياسة التخصص" error={errors.specializationPolicy} hint="مثال: الفرقة الأولى والثانية «بدون تخصص فقط»، الثالثة والرابعة «تخصص إلزامي».">
                <NativeSelect value={s("specializationPolicy")} onChange={(e) => set("specializationPolicy", e.target.value as SpecializationPolicy)}>
                  {SPECIALIZATION_POLICIES.map((p) => (
                    <option key={p} value={p}>{SPECIALIZATION_POLICY_LABELS[p]}</option>
                  ))}
                </NativeSelect>
              </Field>
            </>
          )}
          {editing.kind === "department" && (
            <>
              {collegeSelect}
              <div className="grid grid-cols-3 gap-3">
                <Field label="الاسم" required error={errors.name} className="col-span-2"><Input value={s("name")} onChange={(e) => set("name", e.target.value)} /></Field>
                <Field label="الرمز" required error={errors.code}><Input dir="ltr" value={s("code")} onChange={(e) => set("code", e.target.value)} /></Field>
              </div>
              <label className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm">
                <span>
                  قسم عام «بدون تخصص»
                  <span className="block text-xs text-muted-foreground">قسم واحد فقط لكل كلية. يُستخدم تلقائيًا للسنوات بدون تخصص.</span>
                </span>
                <Switch checked={!!v.isGeneral} onCheckedChange={(c) => set("isGeneral", c)} />
              </label>
            </>
          )}
          {editing.kind === "section" && (
            <>
              <Field label="السنة الدراسية" required error={errors.academicYear}>
                <NativeSelect value={s("academicYear")} onChange={(e) => set("academicYear", e.target.value)}>
                  {structure.years.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="القسم (اختياري)" error={errors.department}>
                <NativeSelect value={s("department")} onChange={(e) => set("department", e.target.value)}>
                  <option value="">كل الأقسام</option>
                  {structure.departments.filter((d) => d.college === structure.years.find((y) => y.id === s("academicYear"))?.college).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="اسم الشعبة" required error={errors.name}><Input value={s("name")} onChange={(e) => set("name", e.target.value)} placeholder="مثال: أ" /></Field>
            </>
          )}
          <label className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm">
            مفعل
            <Switch checked={!!v.active} onCheckedChange={(c) => set("active", c)} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" loading={pending}>حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
