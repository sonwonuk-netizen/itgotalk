import "server-only";
import { asAnon } from "@/lib/db/client";

export type Board = "notice" | "faq" | "education";
export const BOARDS: Board[] = ["notice", "faq", "education"];
export const BOARD_LABEL: Record<Board, string> = { notice: "공지사항", faq: "자주하는 질문", education: "교육이야기" };
export const BOARD_PATH: Record<Board, string> = { notice: "/notice", faq: "/FAQ", education: "/education" };
export const toBoard = (v: unknown): Board => (BOARDS.includes(v as Board) ? (v as Board) : "notice");

export interface Post {
  id: string;
  board: Board;
  title: string;
  body: string;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Pinned first, then newest (notice) — FAQ keeps the same order so pinned questions lead. */
export async function listPosts(board: Board): Promise<Post[]> {
  return asAnon(async (tx) =>
    (await tx.query<Post>(
      "select id, board, title, body, pinned, created_at, updated_at from posts where board = $1 order by pinned desc, created_at desc limit 500",
      [board],
    )).rows,
  );
}

export async function getPost(id: string): Promise<Post | null> {
  return asAnon(async (tx) =>
    (await tx.query<Post>("select id, board, title, body, pinned, created_at, updated_at from posts where id = $1", [id])).rows[0] ?? null,
  );
}
