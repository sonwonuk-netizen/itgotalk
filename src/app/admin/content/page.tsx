import { requireRole } from "@/lib/auth/session";
import { asUser } from "@/lib/db/client";
import { displayParts, type Blank, type Op } from "@/lib/content/items";
import { PageTitle, Table, td } from "@/components/StaffShell";
import { UploadForm } from "./UploadForm";

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ skill?: string }> }) {
  const user = await requireRole("admin");
  const { skill: selected } = await searchParams;
  const { skills, items } = await asUser(user.id, async (tx) => ({
    skills: (await tx.query<{ id: string; ord: number; name: string; track: string; pattern: string; time_rule: string; time_limit_sec: string; practice_required: number; sets: number; items: number }>(
      `select k.id, k.ord, k.name, t.name as track, k.pattern, k.time_rule, k.time_limit_sec, k.practice_required,
              count(distinct s.id)::int as sets, count(i.id)::int as items
       from skills k join tracks t on t.id = k.track_id
       left join item_sets s on s.skill_id = k.id left join items i on i.set_id = s.id
       group by k.id, t.name, t.ord order by t.ord, k.ord`,
    )).rows,
    items: selected
      ? (await tx.query<{ set_id: string; ord: number; a: number; op: Op; b: number; blank: Blank; answer: number }>(
          "select i.set_id, i.ord, i.a, i.op, i.b, i.blank, i.answer from items i join item_sets s on s.id = i.set_id where s.skill_id = $1 order by s.ord, i.ord",
          [selected],
        )).rows
      : [],
  }));

  return (
    <>
      <PageTitle>콘텐츠</PageTitle>
      <UploadForm />
      <Table head={["순서", "과정", "스킬", "패턴", "통과 기준", "연습", "세트", "문항"]}>
        {skills.map((k) => (
          <tr key={k.id} className={k.id === selected ? "bg-brand-50" : ""}>
            <td className={td}>{k.ord}</td>
            <td className={td}>{k.track}</td>
            <td className={td}>
              <a href={`?skill=${k.id}`} className="font-semibold text-brand-700 hover:underline">{k.name}</a>
              <div className="font-mono text-xs text-gray-500">{k.id}</div>
            </td>
            <td className={td}>{k.pattern}</td>
            <td className={td}>{k.time_rule === "per_set" ? `세트 ${Number(k.time_limit_sec)}초` : `문항당 ${Number(k.time_limit_sec)}초`}</td>
            <td className={td}>{k.practice_required}회</td>
            <td className={td}>{k.sets}</td>
            <td className={td}>{k.items}</td>
          </tr>
        ))}
      </Table>
      {selected && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((i) => {
            const p = displayParts(i);
            return (
              <div key={`${i.set_id}-${i.ord}`} className="rounded-lg bg-white p-2 text-center shadow-sm">
                <div className="text-xs text-gray-400">{i.set_id} #{i.ord}</div>
                <div className="text-lg font-semibold">{p.before} <span className="text-emerald-700">[{i.answer}]</span> {p.after}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
