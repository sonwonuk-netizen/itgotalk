/** The three 학습자료실 tiles shown on the home page and /studyroom (icons from ilgotalk.com). */
export const STUDY_ROOM_CARDS = [
  {
    key: "addsub",
    title: "덧셈과 뺄셈",
    icon: "/site/icon-addsub.png",
    short: "10 이하 덧셈부터 한 단계씩",
    available: true,
  },
  {
    key: "muldiv",
    title: "곱셈과 나눗셈",
    icon: "/site/icon-muldiv.png",
    short: "구구단 2단부터 9단까지",
    available: true,
  },
  {
    key: "arith",
    title: "수학연산",
    icon: "/site/icon-arith.png",
    short: "1~9 빨리 누르기 · 진단 테스트",
    available: true,
  },
] as const;
