export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/((?!login|api/auth|api/proxy|_next/static|_next/image|favicon.ico).*)"],
};
