/** "글을 쓰는 아이들" site structure and company info (from ilgotalk.com). */

export const SITE_NAME = "글을 쓰는 아이들";
export const BRAND = "책을 쓰는 아이들";

export const MENU: { label: string; href: string; children?: { label: string; href: string }[] }[] = [
  { label: "책을 쓰는 아이들", href: "/inroduce" },
  { label: "대표프로그램", href: "/program" },
  { label: "BOOK", href: "/book" },
  { label: "교육원", href: "/institute" },
  { label: "교육이야기", href: "/education" },
  { label: "학습자료실", href: "/studyroom" },
  {
    label: "고객센터",
    href: "/notice",
    children: [
      { label: "공지사항", href: "/notice" },
      { label: "자주하는 질문", href: "/FAQ" },
      { label: "상담신청", href: "/qa" },
    ],
  },
];

export const COMPANY = {
  name: "책을 쓰는 아이들",
  ceo: "손원욱",
  address: "(07563) 서울특별시 강서구 공항대로59길 8, 598호(등촌동, 우현빌딩)",
  tel: "02-2202-4095",
  email: "wonukson@naver.com",
  publisherNo: "제2025-000047호",
  bizNo: "211-37-61224",
  bizCheckUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2113761224",
  mailOrderNo: "제2025-서울강서-1505호",
  authority: "서울특별시 강서구청",
  copyright: "Copyright All Rights Reserved © 2025 Writing children",
};
