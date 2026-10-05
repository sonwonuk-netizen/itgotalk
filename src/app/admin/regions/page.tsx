import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { addRegionAction, addSchoolAction, renameAction, toggleActiveAction } from "../actions";
import { PageTitle } from "@/components/StaffShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, inputClass } from "@/components/ui";

const LEVEL = { elementary: "초", middle: "중", high: "고" } as const;

export default async function RegionsPage() {
  const user = await requireRole("admin");
  const { regions, schools } = await asUser(user.id, async (tx) => ({
    regions: (await tx.query<{ id: string; name: string; is_active: boolean }>("select id, name, is_active from regions order by name")).rows,
    schools: (await tx.query<{ id: string; region_id: string; name: string; level: keyof typeof LEVEL; is_active: boolean }>(
      "select id, region_id, name, level, is_active from schools order by name",
    )).rows,
  }));

  return (
    <>
      <PageTitle>지역 · 학교 관리</PageTitle>
      <Card className="mb-4">
        <form action={addRegionAction} className="flex gap-2">
          <input name="name" placeholder="새 지역 (예: 경기 양평군)" aria-label="새 지역" className={inputClass} required />
          <SubmitButton>지역 추가</SubmitButton>
        </form>
      </Card>
      <div className="space-y-4">
        {regions.map((r) => (
          <Card key={r.id} className={r.is_active ? "" : "opacity-60"}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <form action={renameAction} className="flex flex-1 gap-2">
                <input type="hidden" name="table" value="regions" />
                <input type="hidden" name="id" value={r.id} />
                <input name="name" defaultValue={r.name} aria-label="지역 이름" className={`${inputClass} max-w-xs font-bold`} />
                <SubmitButton size="sm" tone="ghost">이름 저장</SubmitButton>
              </form>
              {!r.is_active && <Badge>비활성</Badge>}
              <form action={toggleActiveAction}>
                <input type="hidden" name="table" value="regions" />
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton size="sm" tone={r.is_active ? "danger" : "secondary"}>{r.is_active ? "비활성화" : "활성화"}</SubmitButton>
              </form>
            </div>
            <ul className="mb-3 divide-y text-sm">
              {schools.filter((s) => s.region_id === r.id).map((s) => (
                <li key={s.id} className={`flex items-center gap-2 py-1.5 ${s.is_active ? "" : "opacity-60"}`}>
                  <Badge tone="blue">{LEVEL[s.level]}</Badge>
                  <form action={renameAction} className="flex flex-1 gap-2">
                    <input type="hidden" name="table" value="schools" />
                    <input type="hidden" name="id" value={s.id} />
                    <input name="name" defaultValue={s.name} aria-label="학교 이름" className="flex-1 rounded border border-transparent px-2 py-1 hover:border-gray-300" />
                    <SubmitButton size="sm" tone="ghost">저장</SubmitButton>
                  </form>
                  <form action={toggleActiveAction}>
                    <input type="hidden" name="table" value="schools" />
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton size="sm" tone="ghost">{s.is_active ? "비활성화" : "활성화"}</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addSchoolAction} className="flex gap-2">
              <input type="hidden" name="regionId" value={r.id} />
              <select name="level" aria-label="학교급" className={`${inputClass} w-24`} defaultValue="elementary">
                <option value="elementary">초</option>
                <option value="middle">중</option>
                <option value="high">고</option>
              </select>
              <input name="name" placeholder="학교 추가" aria-label="새 학교" className={inputClass} required />
              <SubmitButton tone="secondary">추가</SubmitButton>
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}
